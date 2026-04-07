import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");
const contractPath = join(appRoot, "lib", "shell-browser-contract.json");
const contract = JSON.parse(readFileSync(contractPath, "utf8"));

const buildIdPath = join(appRoot, ".next", "BUILD_ID");
if (!existsSync(buildIdPath)) {
  console.error(
    "Missing production build for @founderos/web. Run `npm run build --workspace @founderos/web` first."
  );
  process.exit(1);
}

const port =
  process.env.FOUNDEROS_WEB_PORT ??
  String(3770 + Math.floor(Math.random() * 100));
const host = process.env.FOUNDEROS_WEB_HOST ?? "127.0.0.1";
const baseUrl = `http://${host}:${port}`;
const expectedParityRecordKeys = [
  "discoverySessions",
  "discoveryIdeas",
  "discoveryBoardSurface",
  "discoveryBoardRankingSurface",
  "discoveryBoardArchiveSurface",
  "discoveryBoardFinalsSurface",
  "discoveryBoardSimulationsSurface",
  "discoveryAuthoringQueue",
  "discoveryReviewQueue",
  "discoveryTracesSurface",
  "discoveryReplaySurface",
  "executionProjects",
  "executionIntakeSessions",
  "executionIssues",
  "executionApprovals",
  "executionRuntimes",
  "executionReviewQueue",
  "dashboardAttentionQueue",
  "dashboardReviewPressure",
  "inboxAttentionQueue",
  "portfolioChains",
  "reviewCenterDiscovery",
  "reviewCenterExecution",
  "reviewCenterTotal",
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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
      // Keep polling.
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }

  throw new Error(`Timed out waiting for shell server at ${url}.`);
}

async function fetchJson(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const json = await response.json();
  return { response, json };
}

async function fetchHtml(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const html = await response.text();
  return { response, html };
}

function signalServer(signal) {
  if (server.exitCode !== null || !server.pid) {
    return;
  }

  if (process.platform !== "win32") {
    try {
      process.kill(-server.pid, signal);
      return;
    } catch {
      // Fall back to the direct child process below.
    }
  }

  server.kill(signal);
}

async function waitForExit(timeoutMs) {
  if (server.exitCode !== null) {
    return true;
  }

  return new Promise((resolveExit) => {
    const onExit = () => {
      clearTimeout(timeoutId);
      resolveExit(true);
    };
    const timeoutId = setTimeout(() => {
      server.off("exit", onExit);
      resolveExit(false);
    }, timeoutMs);

    server.once("exit", onExit);
  });
}

const server = spawn("npm", ["run", "start"], {
  cwd: appRoot,
  env: {
    ...process.env,
    FOUNDEROS_WEB_HOST: host,
    FOUNDEROS_WEB_PORT: port,
  },
  detached: process.platform !== "win32",
  stdio: ["ignore", "pipe", "pipe"],
});

let lastStdout = "";
let lastStderr = "";
server.stdout.on("data", (chunk) => {
  lastStdout += chunk.toString();
  lastStdout = lastStdout.slice(-4000);
});
server.stderr.on("data", (chunk) => {
  lastStderr += chunk.toString();
  lastStderr = lastStderr.slice(-4000);
});

const teardown = async () => {
  if (server.killed || server.exitCode !== null) {
    return;
  }

  signalServer("SIGINT");
  if (await waitForExit(2000)) {
    return;
  }

  signalServer("SIGTERM");
  if (await waitForExit(2000)) {
    return;
  }

  signalServer("SIGKILL");
  await waitForExit(1000);

  server.stdout.destroy();
  server.stderr.destroy();
  server.unref();
};

try {
  await waitForServer(`${baseUrl}${contract.liveRoutes.runtime}`);

  const runtime = await fetchJson(contract.liveRoutes.runtime);
  assert(runtime.response.status === 200, "Shell runtime route must return 200.");
  assert(runtime.json.settings, "Shell runtime snapshot must include settings.");
  assert(runtime.json.health, "Shell runtime snapshot must include health.");
  assert(Array.isArray(runtime.json.errors), "Shell runtime snapshot must include errors.");

  const parityTargets = await fetchJson(contract.liveRoutes.parityTargets);
  assert(
    parityTargets.response.status === 200,
    "Shell parity targets route must return 200."
  );
  assert(
    Array.isArray(parityTargets.json.records) && parityTargets.json.records.length === 4,
    "Shell parity targets route must include the expected target records."
  );
  assert(
    parityTargets.json.routeScope && parityTargets.json.parityTargets,
    "Shell parity targets route must include route scope and parity targets."
  );
  assert(
    parityTargets.json.coverage &&
      typeof parityTargets.json.coverage.candidateCount === "number" &&
      typeof parityTargets.json.coverage.completeLinkedChainCount === "number",
    "Shell parity targets route must include target resolution coverage diagnostics."
  );

  const contractAudit = await fetchJson(contract.liveRoutes.contractAudit);
  assert(
    contractAudit.response.status === 200,
    "Shell contract audit route must return 200."
  );
  assert(
    contractAudit.json.summary,
    "Shell contract audit route must include summary counts."
  );
  assert(
    contractAudit.json.liveRoutes?.length === 9,
    "Shell contract audit route must include the expected live route checks."
  );
  assert(
    contractAudit.json.deprecatedRoutes?.length === contract.deprecatedRoutes.length,
    "Shell contract audit route must include the expected deprecated route checks."
  );

  const parityAudit = await fetchJson("/api/shell/parity");
  assert(
    parityAudit.response.status === 200,
    "Shell parity audit route must return 200."
  );
  assert(
    Array.isArray(parityAudit.json.records),
    "Shell parity audit route must include parity records."
  );
  assert(
    expectedParityRecordKeys.every((key) =>
      parityAudit.json.records.some((record) => record.key === key)
    ),
    "Shell parity audit route must include the expected parity record keys."
  );
  assert(
    parityAudit.json.summary,
    "Shell parity audit route must include summary counts."
  );
  assert(
    parityAudit.json.records.every(
      (record) =>
        typeof record.shellSurfaceHref === "string" &&
        record.shellSurfaceHref.startsWith("/") &&
        typeof record.upstreamRoute === "string" &&
        Array.isArray(record.shellSampleIds) &&
        Array.isArray(record.upstreamSampleIds) &&
        Array.isArray(record.missingInShellSampleIds) &&
        Array.isArray(record.missingInUpstreamSampleIds)
    ),
    "Shell parity audit route must include actionable route links and sample id arrays."
  );

  const scopedParityAudit = await fetchJson(
    "/api/shell/parity?project_id=demo-project&intake_session_id=demo-session&session_id=demo-session&idea_id=demo-idea"
  );
  assert(
    scopedParityAudit.response.status === 200,
    "Scoped shell parity audit route must return 200."
  );
  assert(
    Array.isArray(scopedParityAudit.json.drilldowns),
    "Scoped shell parity audit route must include drilldown records."
  );
  assert(
    scopedParityAudit.json.drilldowns.length >= 4,
    "Scoped shell parity audit route must include discovery and execution drilldowns."
  );
  assert(
    scopedParityAudit.json.drilldownSummary,
    "Scoped shell parity audit route must include drilldown summary counts."
  );

  const operatorPut = await fetchJson(contract.liveRoutes.operatorPreferences, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshProfile: "focused" }),
  });
  assert(
    operatorPut.response.status === 200,
    "Shell operator preferences PUT must return 200."
  );
  const operatorCookie = operatorPut.response.headers.get("set-cookie");
  assert(operatorCookie, "Shell operator preferences PUT must set a cookie.");

  const operatorGet = await fetchJson(contract.liveRoutes.operatorPreferences, {
    headers: { cookie: operatorCookie.split(";")[0] },
  });
  assert(
    operatorGet.response.status === 200,
    "Shell operator preferences GET must return 200."
  );
  assert(
    operatorGet.json.preferences?.refreshProfile === "focused",
    "Shell operator preferences GET must reflect the updated refresh profile."
  );

  for (const route of contract.deprecatedRoutes) {
    const deprecated = await fetchJson(route.legacyPath, {
      method: route.method,
    });
    assert(
      deprecated.response.status === 410,
      `${route.legacyPath} must return 410.`
    );
    assert(
      deprecated.json.shellNamespace === route.shellNamespace,
      `${route.legacyPath} must point callers to ${route.shellNamespace}.`
    );
  }

  const createHandoff = await fetchJson(contract.liveRoutes.handoffBase, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source_plane: "discovery",
      source_session_id: "demo-session",
      brief_kind: "shared_execution_brief",
      brief: {
        title: "Demo brief",
        summary: "Smoke test handoff",
      },
      default_project_name: "Demo Project",
      launch_intent: "launch",
    }),
  });
  assert(
    createHandoff.response.status === 200,
    "Shell handoff create route must return 200."
  );
  const handoffId = createHandoff.json.handoff?.id;
  assert(handoffId, "Shell handoff create route must return a handoff id.");

  const handoffDetail = await fetchJson(
    `${contract.liveRoutes.handoffBase}/${encodeURIComponent(handoffId)}`
  );
  assert(
    handoffDetail.response.status === 200,
    "Shell handoff detail route must return 200."
  );
  assert(
    handoffDetail.json.handoff?.id === handoffId,
    "Shell handoff detail route must return the created handoff."
  );

  const legacyHandoffDetail = await fetchJson(
    `/api/handoffs/execution-brief/${encodeURIComponent(handoffId)}`
  );
  assert(
    legacyHandoffDetail.response.status === 410,
    "Legacy handoff detail route must return 410."
  );
  assert(
    legacyHandoffDetail.json.shellNamespace ===
      `${contract.liveRoutes.handoffBase}/${encodeURIComponent(handoffId)}`,
    "Legacy handoff detail route must point callers to the shell handoff detail route."
  );

  const settingsPage = await fetchHtml(
    "/settings?project_id=demo-project&intake_session_id=demo-session&session_id=demo-session&idea_id=demo-idea"
  );
  assert(settingsPage.response.status === 200, "Scoped settings page must return 200.");
  assert(
    settingsPage.html.includes("Operator controls"),
    "Scoped settings HTML must include operator controls."
  );
  assert(
    settingsPage.html.includes(contract.liveRoutes.operatorPreferences),
    "Scoped settings HTML must mention the shell operator preferences namespace."
  );
  assert(
    settingsPage.html.includes("Browser contract audit"),
    "Scoped settings HTML must include the browser contract audit section."
  );
  assert(
    settingsPage.html.includes("Upstream parity audit"),
    "Scoped settings HTML must include the upstream parity audit section."
  );
  assert(
    settingsPage.html.includes("Resolved parity targets"),
    "Scoped settings HTML must include the resolved parity target section."
  );
  assert(
    settingsPage.html.includes("Detail drilldowns"),
    "Scoped settings HTML must include parity detail drilldowns."
  );
  assert(
    settingsPage.html.includes("Discovery session detail"),
    "Scoped settings HTML must include discovery session parity drilldown."
  );
  assert(
    settingsPage.html.includes("Discovery dossier detail"),
    "Scoped settings HTML must include discovery dossier parity drilldown."
  );
  assert(
    settingsPage.html.includes("Open shell surface"),
    "Scoped settings HTML must include actionable parity links."
  );
  assert(
    settingsPage.html.includes("Route scope"),
    "Scoped settings HTML must include the route scope banner."
  );

  const handoffPage = await fetchHtml(
    `/execution/handoffs/${encodeURIComponent(
      handoffId
    )}?project_id=demo-project&intake_session_id=demo-session`
  );
  assert(
    handoffPage.response.status === 200,
    "Scoped execution handoff page must return 200."
  );
  assert(
    handoffPage.html.includes("Execution brief"),
    "Scoped execution handoff HTML must include the execution brief."
  );
  assert(
    handoffPage.html.includes("Route scope"),
    "Scoped execution handoff HTML must include the route scope banner."
  );

  const discoverySimulationPage = await fetchHtml(
    "/discovery/board/simulations/demo-idea?project_id=demo-project&intake_session_id=demo-session"
  );
  assert(
    discoverySimulationPage.response.status === 200,
    "Scoped discovery simulation page must return 200."
  );
  assert(
    discoverySimulationPage.html.includes("Open scoped settings"),
    "Scoped discovery simulation HTML must include the scoped settings link."
  );
  assert(
    discoverySimulationPage.html.includes("idea_id=demo-idea"),
    "Scoped discovery simulation HTML must carry the discovery idea parity target into settings links."
  );

  console.log(
    JSON.stringify({
      status: "ok",
      baseUrl,
      checked: {
        runtime: contract.liveRoutes.runtime,
        contractAudit: contract.liveRoutes.contractAudit,
        parityTargets: contract.liveRoutes.parityTargets,
        parityAudit: "/api/shell/parity",
        operatorPreferences: contract.liveRoutes.operatorPreferences,
        handoffBase: contract.liveRoutes.handoffBase,
        deprecatedRoutes: contract.deprecatedRoutes.length,
      },
    })
  );
} catch (error) {
  console.error(
    JSON.stringify(
      {
        status: "error",
        baseUrl,
        error: error instanceof Error ? error.message : String(error),
        stdout: lastStdout,
        stderr: lastStderr,
      },
      null,
      2
    )
  );
  process.exitCode = 1;
} finally {
  await teardown();
}
