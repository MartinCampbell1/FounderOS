import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");
const contractPath = join(appRoot, "lib", "shell-browser-contract.json");
const contract = JSON.parse(readFileSync(contractPath, "utf8"));
const externalBaseUrl = (process.env.FOUNDEROS_PARITY_BASE_URL || "")
  .trim()
  .replace(/\/$/, "");
const buildIdPath = join(appRoot, ".next", "BUILD_ID");

if (!externalBaseUrl && !existsSync(buildIdPath)) {
  console.error(
    "Missing production build for @founderos/web. Run `npm run build --workspace @founderos/web` first.",
  );
  process.exit(1);
}

const host = process.env.FOUNDEROS_WEB_HOST ?? "127.0.0.1";
const port =
  process.env.FOUNDEROS_WEB_PORT ??
  String(3920 + Math.floor(Math.random() * 100));
const baseUrl = externalBaseUrl || `http://${host}:${port}`;
const shellAdminToken = (
  process.env.FOUNDEROS_SHELL_ADMIN_TOKEN || "shell-review-preset-admin-token"
).trim();
const requestedMinScenarioVariantCount = Number.parseInt(
  process.env.FOUNDEROS_PARITY_MIN_SCENARIO_VARIANT_COUNT || "2",
  10,
);
const minScenarioVariantCount =
  Number.isInteger(requestedMinScenarioVariantCount) &&
  requestedMinScenarioVariantCount > 0
    ? requestedMinScenarioVariantCount
    : 2;
const SUITE_PRESETS = ["discovery-pass", "critical-pass", "decision-pass"];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function firstString(value) {
  return String(value || "").trim();
}

function parseSuiteTargets(rawValue) {
  const trimmed = (rawValue || "").trim();
  if (!trimmed) {
    throw new Error(
      "FOUNDEROS_REVIEW_SUITE_TARGETS_JSON is required for the live review preset suite.",
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    throw new Error(
      `FOUNDEROS_REVIEW_SUITE_TARGETS_JSON must contain valid JSON. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const normalized = {};
  for (const preset of SUITE_PRESETS) {
    const target = parsed?.[preset];
    assert(
      target && typeof target === "object",
      `Missing suite target for ${preset}.`,
    );
    normalized[preset] = {
      preset,
      role: firstString(target.role),
      scenario: firstString(target.scenario),
      routeScope: {
        projectId: firstString(target.routeScope?.projectId),
        intakeSessionId: firstString(target.routeScope?.intakeSessionId),
      },
      parityTargets: {
        discoverySessionId: firstString(
          target.parityTargets?.discoverySessionId,
        ),
        discoveryIdeaId: firstString(target.parityTargets?.discoveryIdeaId),
      },
      actionTargets: target.actionTargets ?? {},
    };
  }

  return normalized;
}

async function waitForServer(url, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the timeout is reached.
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }

  throw new Error(`Timed out waiting for shell server at ${url}.`);
}

async function fetchJson(path, init) {
  const method = String(init?.method || "GET").toUpperCase();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(shellAdminToken
        ? { "x-founderos-shell-admin-token": shellAdminToken }
        : {}),
      ...(!["GET", "HEAD", "OPTIONS"].includes(method)
        ? { Origin: baseUrl }
        : {}),
    },
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  return {
    response,
    json: payload,
  };
}

function runPresetStep(target) {
  return new Promise((resolveResult, rejectResult) => {
    const child = spawn(
      process.execPath,
      [join(appRoot, "scripts", "check-live-review-playbook.mjs")],
      {
        cwd: appRoot,
        env: {
          ...process.env,
          FOUNDEROS_PARITY_BASE_URL: baseUrl,
          FOUNDEROS_REVIEW_PRESET: target.preset,
          FOUNDEROS_PARITY_PROJECT_ID: target.routeScope.projectId,
          FOUNDEROS_PARITY_INTAKE_SESSION_ID: target.routeScope.intakeSessionId,
          FOUNDEROS_PARITY_DISCOVERY_SESSION_ID:
            target.parityTargets.discoverySessionId,
          FOUNDEROS_PARITY_DISCOVERY_IDEA_ID:
            target.parityTargets.discoveryIdeaId,
          FOUNDEROS_SHELL_ADMIN_TOKEN: shellAdminToken,
          FOUNDEROS_REVIEW_ACTION_TARGETS_JSON: JSON.stringify(
            target.actionTargets || {},
          ),
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.once("error", rejectResult);
    child.once("exit", (code, signal) => {
      if (signal) {
        rejectResult(
          new Error(`${target.preset} exited from signal ${signal}.`),
        );
        return;
      }
      if ((code ?? 1) !== 0) {
        rejectResult(
          new Error(
            `${target.preset} exited with code ${code ?? "unknown"}.\nstdout:\n${stdout}\nstderr:\n${stderr}`,
          ),
        );
        return;
      }

      try {
        resolveResult(JSON.parse(stdout.trim()));
      } catch (error) {
        rejectResult(
          new Error(
            `${target.preset} returned invalid JSON.\nstdout:\n${stdout}\nstderr:\n${stderr}\nerror:${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }
    });
  });
}

let lastStdout = "";
let lastStderr = "";
const server = externalBaseUrl
  ? null
  : spawn("npm", ["run", "start"], {
      cwd: appRoot,
      env: {
        ...process.env,
        FOUNDEROS_WEB_HOST: host,
        FOUNDEROS_WEB_PORT: port,
        FOUNDEROS_SHELL_ADMIN_TOKEN: shellAdminToken,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

server?.stdout.on("data", (chunk) => {
  lastStdout += chunk.toString();
  lastStdout = lastStdout.slice(-4000);
});
server?.stderr.on("data", (chunk) => {
  lastStderr += chunk.toString();
  lastStderr = lastStderr.slice(-4000);
});

const teardown = async () => {
  if (!server || server.killed || server.exitCode !== null) {
    return;
  }

  server.kill("SIGINT");
  await new Promise((resolveExit) => {
    server.once("exit", () => resolveExit());
    setTimeout(resolveExit, 2000);
  });
};

try {
  await waitForServer(`${baseUrl}${contract.liveRoutes.runtime}`);

  const suiteTargets = parseSuiteTargets(
    process.env.FOUNDEROS_REVIEW_SUITE_TARGETS_JSON || "",
  );
  const results = [];

  for (const preset of SUITE_PRESETS) {
    const result = await runPresetStep(suiteTargets[preset]);
    results.push({
      preset,
      role: suiteTargets[preset].role,
      scenario: suiteTargets[preset].scenario,
      scope: result.scope,
      selected: result.selected,
      processed: result.processed,
      surfacesBefore: result.surfacesBefore,
      surfacesAfter: result.surfacesAfter,
    });
  }

  const discoveryResult = results.find(
    (result) => result.preset === "discovery-pass",
  );
  const criticalResult = results.find(
    (result) => result.preset === "critical-pass",
  );
  const decisionResult = results.find(
    (result) => result.preset === "decision-pass",
  );
  assert(
    Number(discoveryResult?.processed?.discoveryConfirmCount || 0) > 0,
    "Discovery-pass did not confirm any discovery review records.",
  );
  assert(
    Number(criticalResult?.processed?.issueResolveCount || 0) > 0,
    "Critical-pass did not resolve any execution issues.",
  );
  assert(
    Number(decisionResult?.processed?.approvalApproveCount || 0) > 0,
    "Decision-pass did not approve any execution approvals.",
  );

  const parityTargetsSnapshot = await fetchJson(
    contract.liveRoutes.parityTargets,
  );
  assert(
    parityTargetsSnapshot.response.status === 200,
    "Shell parity target route must return 200 after the preset suite.",
  );

  const coverage = parityTargetsSnapshot.json.coverage || {};
  assert(
    Number(coverage.completeLinkedChainCount || 0) >= 2,
    "Preset suite must leave at least two complete linked chains available for parity.",
  );
  assert(
    Number(coverage.completeLinkedScenarioVariantCount || 0) >=
      minScenarioVariantCount,
    `Preset suite must leave at least ${minScenarioVariantCount} linked scenario variants for parity.`,
  );
  assert(
    Number(coverage.operatorAttentionChainCount || 0) >= 1,
    "Preset suite must leave at least one operator-attention chain after the targeted preset runs.",
  );

  console.log(
    JSON.stringify({
      status: "ok",
      baseUrl,
      presetCount: results.length,
      presets: results,
      remainingCoverage: coverage,
    }),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  if (lastStdout.trim()) {
    console.error("\nRecent shell stdout:\n" + lastStdout.trim());
  }
  if (lastStderr.trim()) {
    console.error("\nRecent shell stderr:\n" + lastStderr.trim());
  }
  process.exitCode = 1;
} finally {
  await teardown();
}
