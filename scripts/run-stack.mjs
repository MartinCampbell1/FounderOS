#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const quorumRoot = join(repoRoot, "quorum");
const autopilotRoot = join(repoRoot, "autopilot");
const webRoot = join(repoRoot, "apps", "web");

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const mode = (process.argv[2] || "dev").trim();
const validModes = new Set([
  "dev",
  "serve",
  "parity",
  "review-actions",
  "review-batch-routes",
  "review-memory",
  "review-pressure-actions",
  "review-pressure-entry-links",
  "settings-parity-links",
  "review-playbooks",
  "review-preset-suite",
]);
const readyTimeoutMs = Number.parseInt(
  process.env.FOUNDEROS_STACK_READY_TIMEOUT_MS || "45000",
  10,
);
const submoduleHelp =
  "Run `bash scripts/bootstrap_founderos_local.sh` or `git submodule update --init --recursive` before starting the stack.";

if (!validModes.has(mode)) {
  console.error(
    `[stack] Unsupported mode "${mode}". Use one of: ${[...validModes].join(", ")}.`,
  );
  process.exit(1);
}

let shuttingDown = false;
let fatalError = null;
const managedProcesses = [];
let stackStateRoot = null;

function log(message) {
  console.log(`[stack] ${message}`);
}

function requirePath(path, description) {
  if (existsSync(path)) {
    return;
  }

  throw new Error(`${description} is missing at ${path}. ${submoduleHelp}`);
}

function assertRuntimeLayout() {
  requirePath(quorumRoot, "Quorum runtime root");
  requirePath(join(quorumRoot, "gateway.py"), "Quorum gateway entrypoint");
  requirePath(join(quorumRoot, "pyproject.toml"), "Quorum package metadata");
  requirePath(autopilotRoot, "Autopilot runtime root");
  requirePath(
    join(autopilotRoot, "pyproject.toml"),
    "Autopilot package metadata",
  );
}

function trimTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function envValue(key, fallback) {
  const value = (process.env[key] || "").trim();
  return value || fallback;
}

function defaultPortForProtocol(protocol) {
  return protocol === "https:" ? "443" : "80";
}

function parseLocalBaseUrl(name, rawValue, expectedPathname) {
  let url;

  try {
    url = new URL(rawValue);
  } catch {
    throw new Error(`${name} must be an absolute URL. Received: ${rawValue}`);
  }

  if (url.protocol !== "http:") {
    throw new Error(
      `${name} must use http:// for the local stack. Received: ${rawValue}`,
    );
  }

  const normalizedPath = trimTrailingSlash(url.pathname || "/") || "/";
  if (normalizedPath !== expectedPathname) {
    throw new Error(
      `${name} must use pathname "${expectedPathname}" for the local stack. Received: ${url.pathname || "/"}`,
    );
  }

  return {
    raw: trimTrailingSlash(rawValue),
    origin: url.origin,
    host: url.hostname,
    port: url.port || defaultPortForProtocol(url.protocol),
    pathname: normalizedPath,
    healthUrl: new URL("health", `${trimTrailingSlash(rawValue)}/`).toString(),
  };
}

function buildBaseUrlWithPort(rawValue, port) {
  const url = new URL(rawValue);
  url.port = String(port);
  return trimTrailingSlash(url.toString());
}

function resolvePythonBinary(envKey, defaultPath) {
  const fromEnv = (process.env[envKey] || "").trim();
  if (fromEnv) {
    return fromEnv;
  }
  if (existsSync(defaultPath)) {
    return defaultPath;
  }
  return "python3";
}

function pipeWithPrefix(stream, label, writer) {
  let buffer = "";

  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line) {
        continue;
      }
      writer.write(`[${label}] ${line}\n`);
    }
  });

  stream.on("end", () => {
    if (!buffer) {
      return;
    }
    writer.write(`[${label}] ${buffer}\n`);
    buffer = "";
  });
}

function describeCommand(command, args) {
  return [command, ...args].join(" ");
}

function startManagedProcess({ name, command, args, cwd, env }) {
  const child = spawn(command, args, {
    cwd,
    env: {
      ...process.env,
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  pipeWithPrefix(child.stdout, name, process.stdout);
  pipeWithPrefix(child.stderr, name, process.stderr);

  const descriptor = {
    name,
    child,
    command,
    args,
    cwd,
  };
  managedProcesses.push(descriptor);

  child.on("error", (error) => {
    if (shuttingDown) {
      return;
    }
    fatalError = error instanceof Error ? error : new Error(String(error));
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    const reason =
      signal !== null
        ? `${name} exited from signal ${signal}`
        : `${name} exited with code ${code ?? "unknown"}`;
    fatalError = new Error(reason);
  });

  log(`started ${name}: ${describeCommand(command, args)}`);
  return descriptor;
}

async function stopManagedProcess(processRef) {
  const { child, name } = processRef;
  if (child.exitCode !== null || child.killed) {
    return;
  }

  const waitForExit = (timeoutMs) =>
    new Promise((resolveExit) => {
      const onExit = () => {
        clearTimeout(timeoutId);
        resolveExit(true);
      };
      const timeoutId = setTimeout(() => {
        child.off("exit", onExit);
        resolveExit(false);
      }, timeoutMs);
      child.once("exit", onExit);
    });

  child.kill("SIGINT");
  if (await waitForExit(2000)) {
    log(`stopped ${name}`);
    return;
  }

  if (child.exitCode === null && !child.killed) {
    log(`forcing ${name} to stop with SIGTERM`);
    child.kill("SIGTERM");
  }
  if (await waitForExit(2000)) {
    log(`stopped ${name}`);
    return;
  }

  if (child.exitCode === null && !child.killed) {
    log(`forcing ${name} to stop with SIGKILL`);
    child.kill("SIGKILL");
  }
  await waitForExit(1000);

  log(`stopped ${name}`);
}

async function teardown(code = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  for (const processRef of [...managedProcesses].reverse()) {
    await stopManagedProcess(processRef);
  }

  if (stackStateRoot) {
    const keepState =
      process.env.FOUNDEROS_STACK_KEEP_STATE === "1" ||
      process.env.FOUNDEROS_STACK_KEEP_STATE === "true";
    if (keepState) {
      log(`preserved stack state at ${stackStateRoot}`);
    } else {
      rmSync(stackStateRoot, { recursive: true, force: true });
      log(`removed stack state at ${stackStateRoot}`);
    }
  }

  process.exitCode = code;
}

function sleep(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function isPortAvailable(host, port) {
  return await new Promise((resolveAvailability) => {
    const server = net.createServer();

    server.once("error", () => {
      resolveAvailability(false);
    });

    server.once("listening", () => {
      server.close(() => resolveAvailability(true));
    });

    server.listen({
      host,
      port,
      exclusive: true,
    });
  });
}

async function chooseShellPort(host) {
  const explicitPort = (process.env.FOUNDEROS_WEB_PORT || "").trim();
  if (explicitPort) {
    const parsedPort = Number.parseInt(explicitPort, 10);
    if (
      !Number.isInteger(parsedPort) ||
      parsedPort <= 0 ||
      parsedPort > 65535
    ) {
      throw new Error(
        `FOUNDEROS_WEB_PORT must be a valid TCP port. Received: ${explicitPort}.`,
      );
    }

    const available = await isPortAvailable(host, parsedPort);
    if (!available) {
      throw new Error(
        `FOUNDEROS_WEB_PORT=${explicitPort} is already in use on ${host}. Choose a different port and retry.`,
      );
    }
    return explicitPort;
  }

  const preferredPort = "3737";
  if (
    mode !== "parity" &&
    mode !== "review-actions" &&
    mode !== "review-batch-routes" &&
    mode !== "review-memory" &&
    mode !== "review-pressure-actions" &&
    mode !== "review-pressure-entry-links" &&
    mode !== "settings-parity-links" &&
    mode !== "review-playbooks" &&
    mode !== "review-preset-suite"
  ) {
    const preferredAvailable = await isPortAvailable(
      host,
      Number(preferredPort),
    );
    if (preferredAvailable) {
      return preferredPort;
    }
  }

  const startPort =
    mode === "parity" ||
    mode === "review-actions" ||
    mode === "review-batch-routes" ||
    mode === "review-memory" ||
    mode === "review-pressure-actions" ||
    mode === "review-pressure-entry-links" ||
    mode === "settings-parity-links" ||
    mode === "review-playbooks" ||
    mode === "review-preset-suite"
      ? 3860
      : 3738;
  const endPort =
    mode === "parity" ||
    mode === "review-actions" ||
    mode === "review-batch-routes" ||
    mode === "review-memory" ||
    mode === "review-pressure-actions" ||
    mode === "review-pressure-entry-links" ||
    mode === "settings-parity-links" ||
    mode === "review-playbooks" ||
    mode === "review-preset-suite"
      ? 3999
      : 3799;

  for (let port = startPort; port <= endPort; port += 1) {
    const available = await isPortAvailable(host, port);
    if (available) {
      return String(port);
    }
  }

  throw new Error(`Unable to find a free shell port on ${host}.`);
}

async function chooseManagedBaseUrl({
  name,
  envKey,
  fallbackRawValue,
  expectedPathname,
  fallbackPortRange,
}) {
  const explicitRawValue = (process.env[envKey] || "").trim();
  const preferredBase = parseLocalBaseUrl(
    name,
    explicitRawValue || fallbackRawValue,
    expectedPathname,
  );
  const preferredPort = Number.parseInt(preferredBase.port, 10);

  if (
    !Number.isInteger(preferredPort) ||
    preferredPort <= 0 ||
    preferredPort > 65535
  ) {
    throw new Error(
      `${name} must use a valid TCP port. Received: ${preferredBase.port}.`,
    );
  }

  if (explicitRawValue) {
    const available = await isPortAvailable(preferredBase.host, preferredPort);
    if (!available) {
      throw new Error(
        `${envKey}=${preferredBase.raw} cannot be used because ${preferredBase.host}:${preferredBase.port} is already occupied.`,
      );
    }
    return preferredBase;
  }

  const preferredAvailable = await isPortAvailable(
    preferredBase.host,
    preferredPort,
  );
  if (preferredAvailable) {
    return preferredBase;
  }

  const [startPort, endPort] = fallbackPortRange;
  for (let port = startPort; port <= endPort; port += 1) {
    const available = await isPortAvailable(preferredBase.host, port);
    if (!available) {
      continue;
    }

    return parseLocalBaseUrl(
      name,
      buildBaseUrlWithPort(preferredBase.raw, port),
      expectedPathname,
    );
  }

  throw new Error(
    `Unable to find a free port for ${name} on ${preferredBase.host} in range ${startPort}-${endPort}.`,
  );
}

async function waitForHttpOk(label, url, timeoutMs = readyTimeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (fatalError) {
      throw fatalError;
    }

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(1500),
      });

      if (response.ok) {
        log(`${label} is healthy at ${url}`);
        return;
      }
    } catch {
      // keep polling
    }

    await sleep(300);
  }

  throw new Error(`Timed out waiting for ${label} at ${url}`);
}

async function runOneOff({ label, command, args, cwd, env }) {
  return await new Promise((resolveExit, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        ...env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    pipeWithPrefix(child.stdout, label, process.stdout);
    pipeWithPrefix(child.stderr, label, process.stderr);

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${label} exited from signal ${signal}`));
        return;
      }
      resolveExit(code ?? 1);
    });
  });
}

async function runOneOffJson({ label, command, args, cwd, env }) {
  return await new Promise((resolveJson, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        ...env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
    });

    pipeWithPrefix(child.stdout, label, process.stdout);
    pipeWithPrefix(child.stderr, label, process.stderr);

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${label} exited from signal ${signal}`));
        return;
      }
      if ((code ?? 1) !== 0) {
        reject(
          new Error(
            `${label} exited with code ${code ?? "unknown"}.\nstdout:\n${stdout}\nstderr:\n${stderr}`,
          ),
        );
        return;
      }

      try {
        resolveJson(JSON.parse(stdout.trim()));
      } catch (error) {
        reject(
          new Error(
            `${label} returned invalid JSON.\nstdout:\n${stdout}\nstderr:\n${stderr}\nerror:${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        );
      }
    });
  });
}

async function ensureWebBuild(forceBuild) {
  const buildIdPath = join(webRoot, ".next", "BUILD_ID");
  if (!forceBuild && existsSync(buildIdPath)) {
    return;
  }

  log(
    forceBuild ? "running fresh web build" : "web build missing, running build",
  );
  const code = await runOneOff({
    label: "build",
    command: npmCommand,
    args: ["run", "build", "--workspace", "@founderos/web"],
    cwd: repoRoot,
  });

  if (code !== 0) {
    throw new Error(`web build failed with exit code ${code}`);
  }
}

async function waitUntilStopped() {
  while (!shuttingDown) {
    if (fatalError) {
      throw fatalError;
    }
    await sleep(500);
  }
}

const webHost = envValue("FOUNDEROS_WEB_HOST", "127.0.0.1");
const webPort = await chooseShellPort(webHost);
const shellBaseUrl = `http://${webHost}:${webPort}`;
const quorumBase = await chooseManagedBaseUrl({
  name: "QUORUM_API_BASE_URL",
  envKey: "QUORUM_API_BASE_URL",
  fallbackRawValue: "http://127.0.0.1:8800",
  expectedPathname: "/",
  fallbackPortRange: [8801, 8899],
});
const autopilotBase = await chooseManagedBaseUrl({
  name: "AUTOPILOT_API_BASE_URL",
  envKey: "AUTOPILOT_API_BASE_URL",
  fallbackRawValue: "http://127.0.0.1:8420/api",
  expectedPathname: "/api",
  fallbackPortRange: [8421, 8499],
});

const quorumPython = resolvePythonBinary(
  "QUORUM_PYTHON_BIN",
  join(quorumRoot, ".venv", "bin", "python"),
);
const autopilotPython = resolvePythonBinary(
  "AUTOPILOT_PYTHON_BIN",
  join(autopilotRoot, ".venv", "bin", "python"),
);
assertRuntimeLayout();

if (
  mode === "parity" ||
  mode === "review-actions" ||
  mode === "review-batch-routes" ||
  mode === "review-memory" ||
  mode === "review-pressure-actions" ||
  mode === "review-pressure-entry-links" ||
  mode === "settings-parity-links" ||
  mode === "review-playbooks" ||
  mode === "review-preset-suite"
) {
  stackStateRoot = mkdtempSync(join(tmpdir(), "founderos-parity-stack-"));
  mkdirSync(join(stackStateRoot, "quorum"), { recursive: true });
  mkdirSync(join(stackStateRoot, "autopilot"), { recursive: true });
}

const stackStateEnv =
  (mode === "parity" ||
    mode === "review-actions" ||
    mode === "review-batch-routes" ||
    mode === "review-memory" ||
    mode === "review-pressure-actions" ||
    mode === "review-pressure-entry-links" ||
    mode === "settings-parity-links" ||
    mode === "review-playbooks" ||
    mode === "review-preset-suite") &&
  stackStateRoot
    ? {
        MULTI_AGENT_STATE_DB: join(stackStateRoot, "quorum", "state.db"),
        AUTOPILOT_HOME: join(stackStateRoot, "autopilot"),
        FOUNDEROS_STACK_STATE_ROOT: stackStateRoot,
      }
    : {};

const rootEnv = {
  QUORUM_API_BASE_URL: quorumBase.raw,
  AUTOPILOT_API_BASE_URL: autopilotBase.raw,
  FOUNDEROS_WEB_HOST: webHost,
  FOUNDEROS_WEB_PORT: webPort,
  ...stackStateEnv,
};

process.on("SIGINT", async () => {
  await teardown(0);
});

process.on("SIGTERM", async () => {
  await teardown(0);
});

try {
  if (!(process.env.FOUNDEROS_WEB_PORT || "").trim() && webPort !== "3737") {
    log(`selected available shell port ${webPort} on ${webHost}`);
  }
  if (
    !(process.env.QUORUM_API_BASE_URL || "").trim() &&
    quorumBase.port !== "8800"
  ) {
    log(
      `selected available quorum port ${quorumBase.port} on ${quorumBase.host}`,
    );
  }
  if (
    !(process.env.AUTOPILOT_API_BASE_URL || "").trim() &&
    autopilotBase.port !== "8420"
  ) {
    log(
      `selected available autopilot port ${autopilotBase.port} on ${autopilotBase.host}`,
    );
  }

  if (
    mode === "serve" ||
    mode === "parity" ||
    mode === "review-actions" ||
    mode === "review-batch-routes" ||
    mode === "review-memory" ||
    mode === "review-pressure-actions" ||
    mode === "review-pressure-entry-links" ||
    mode === "settings-parity-links" ||
    mode === "review-playbooks" ||
    mode === "review-preset-suite"
  ) {
    await ensureWebBuild(process.env.FOUNDEROS_STACK_FORCE_BUILD === "1");
  }

  startManagedProcess({
    name: "quorum",
    command: quorumPython,
    args: ["gateway.py"],
    cwd: quorumRoot,
    env: {
      ...rootEnv,
      GATEWAY_HOST: quorumBase.host,
      GATEWAY_PORT: quorumBase.port,
    },
  });

  startManagedProcess({
    name: "autopilot",
    command: autopilotPython,
    args: ["-m", "autopilot.api.serve"],
    cwd: autopilotRoot,
    env: {
      ...rootEnv,
      AUTOPILOT_API_HOST: autopilotBase.host,
      AUTOPILOT_API_PORT: autopilotBase.port,
    },
  });

  await Promise.all([
    waitForHttpOk("quorum", quorumBase.healthUrl),
    waitForHttpOk("autopilot", autopilotBase.healthUrl),
  ]);

  startManagedProcess({
    name: "shell",
    command: npmCommand,
    args:
      mode === "dev"
        ? ["run", "dev", "--workspace", "@founderos/web"]
        : ["run", "start", "--workspace", "@founderos/web"],
    cwd: repoRoot,
    env: rootEnv,
  });

  await waitForHttpOk("shell", `${shellBaseUrl}/api/shell/runtime`);

  log(`stack ready`);
  log(`shell: ${shellBaseUrl}`);
  log(`quorum: ${quorumBase.raw}`);
  log(`autopilot: ${autopilotBase.raw}`);
  if (stackStateRoot) {
    log(`state: ${stackStateRoot}`);
  }

  if (
    mode === "parity" ||
    mode === "review-actions" ||
    mode === "review-batch-routes" ||
    mode === "review-memory" ||
    mode === "review-pressure-actions" ||
    mode === "review-pressure-entry-links" ||
    mode === "settings-parity-links" ||
    mode === "review-playbooks" ||
    mode === "review-preset-suite"
  ) {
    const reviewSuiteSeedMode =
      mode === "review-preset-suite" ||
      mode === "review-batch-routes" ||
      mode === "review-memory" ||
      mode === "review-pressure-actions" ||
      mode === "review-pressure-entry-links" ||
      mode === "settings-parity-links";
    const reviewHarnessMode =
      mode === "review-actions" ||
      mode === "review-batch-routes" ||
      mode === "review-memory" ||
      mode === "review-pressure-actions" ||
      mode === "review-pressure-entry-links" ||
      mode === "settings-parity-links" ||
      mode === "review-playbooks" ||
      mode === "review-preset-suite";
    const defaultParityChainCount = reviewSuiteSeedMode ? "4" : "2";
    const parityChainCount =
      (process.env.FOUNDEROS_PARITY_CHAIN_COUNT || "").trim() ||
      defaultParityChainCount;
    const parityMinCompleteChainCount =
      (process.env.FOUNDEROS_PARITY_MIN_COMPLETE_CHAIN_COUNT || "").trim() ||
      parityChainCount;
    const parityMinScenarioVariantCount =
      (process.env.FOUNDEROS_PARITY_MIN_SCENARIO_VARIANT_COUNT || "").trim() ||
      (reviewSuiteSeedMode ? "4" : "2");

    if (
      reviewSuiteSeedMode &&
      (!Number.isInteger(Number(parityChainCount)) ||
        Number(parityChainCount) < 4)
    ) {
      throw new Error(`${mode} requires FOUNDEROS_PARITY_CHAIN_COUNT >= 4.`);
    }

    const seedResult = await runOneOffJson({
      label: "seed",
      command: process.execPath,
      args: [join(repoRoot, "scripts", "seed-parity-linked-chain.mjs")],
      cwd: repoRoot,
      env: {
        ...rootEnv,
        FOUNDEROS_PARITY_BASE_URL: shellBaseUrl,
        FOUNDEROS_PARITY_CHAIN_COUNT: parityChainCount,
        FOUNDEROS_REVIEW_SUITE_MODE: reviewSuiteSeedMode ? "1" : "0",
        QUORUM_PYTHON_BIN: quorumPython,
        AUTOPILOT_PYTHON_BIN: autopilotPython,
      },
    });

    const parityEnv = {
      ...rootEnv,
      FOUNDEROS_PARITY_BASE_URL: shellBaseUrl,
      FOUNDEROS_PARITY_PROJECT_ID: String(
        seedResult.routeScope?.projectId || "",
      ).trim(),
      FOUNDEROS_PARITY_INTAKE_SESSION_ID: String(
        seedResult.routeScope?.intakeSessionId || "",
      ).trim(),
      FOUNDEROS_PARITY_DISCOVERY_SESSION_ID: String(
        seedResult.parityTargets?.discoverySessionId || "",
      ).trim(),
      FOUNDEROS_PARITY_DISCOVERY_IDEA_ID: String(
        seedResult.parityTargets?.discoveryIdeaId || "",
      ).trim(),
      FOUNDEROS_PARITY_MIN_COMPLETE_CHAIN_COUNT: parityMinCompleteChainCount,
      FOUNDEROS_PARITY_MIN_SCENARIO_VARIANT_COUNT:
        parityMinScenarioVariantCount,
      FOUNDEROS_PARITY_REQUIRE_COMPLETE_CHAIN:
        (process.env.FOUNDEROS_PARITY_REQUIRE_COMPLETE_CHAIN || "").trim() ||
        "1",
      FOUNDEROS_PARITY_REQUIRE_OPERATOR_DATA:
        (process.env.FOUNDEROS_PARITY_REQUIRE_OPERATOR_DATA || "").trim() ||
        "1",
      FOUNDEROS_PARITY_REQUIRE_DIVERSE_SCENARIOS:
        (process.env.FOUNDEROS_PARITY_REQUIRE_DIVERSE_SCENARIOS || "").trim() ||
        "1",
    };

    const parityExitCode = await runOneOff({
      label: "parity",
      command: npmCommand,
      args: ["run", "test:live-parity", "--workspace", "@founderos/web"],
      cwd: repoRoot,
      env: parityEnv,
    });

    if (parityExitCode !== 0) {
      await teardown(parityExitCode);
    } else if (reviewHarnessMode) {
      const reviewActionsEnv = {
        ...rootEnv,
        FOUNDEROS_PARITY_BASE_URL: shellBaseUrl,
        FOUNDEROS_PARITY_PROJECT_ID: String(
          seedResult.routeScope?.projectId || "",
        ).trim(),
        FOUNDEROS_PARITY_INTAKE_SESSION_ID: String(
          seedResult.routeScope?.intakeSessionId || "",
        ).trim(),
        FOUNDEROS_PARITY_DISCOVERY_SESSION_ID: String(
          seedResult.parityTargets?.discoverySessionId || "",
        ).trim(),
        FOUNDEROS_PARITY_DISCOVERY_IDEA_ID: String(
          seedResult.parityTargets?.discoveryIdeaId || "",
        ).trim(),
        FOUNDEROS_REVIEW_ACTION_TARGETS_JSON: JSON.stringify(
          seedResult.actionTargets || {},
        ),
        FOUNDEROS_REVIEW_SUITE_TARGETS_JSON: JSON.stringify(
          seedResult.presetTargets || {},
        ),
        FOUNDEROS_PARITY_MIN_SCENARIO_VARIANT_COUNT:
          parityMinScenarioVariantCount,
        FOUNDEROS_REVIEW_PRESET:
          (process.env.FOUNDEROS_REVIEW_PRESET || "").trim() ||
          (mode === "review-playbooks" ? "chain-pass" : ""),
      };

      const reviewActionsExitCode = await runOneOff({
        label:
          mode === "review-playbooks"
            ? "review-playbook"
            : mode === "review-batch-routes"
              ? "review-batch-routes"
              : mode === "review-memory"
                ? "review-memory"
                : mode === "review-pressure-actions"
                  ? "review-pressure-actions"
                  : mode === "review-pressure-entry-links"
                    ? "review-pressure-entry-links"
                    : mode === "settings-parity-links"
                      ? "settings-parity-links"
                      : mode === "review-preset-suite"
                        ? "review-preset-suite"
                        : "review-actions",
        command: npmCommand,
        args: [
          "run",
          mode === "review-playbooks"
            ? "test:live-review-playbook"
            : mode === "review-batch-routes"
              ? "test:live-review-batch-routes"
              : mode === "review-memory"
                ? "test:live-review-memory"
                : mode === "review-pressure-actions"
                  ? "test:live-review-pressure-actions"
                  : mode === "review-pressure-entry-links"
                    ? "test:live-review-pressure-entry-links"
                    : mode === "settings-parity-links"
                      ? "test:live-settings-parity-links"
                      : mode === "review-preset-suite"
                        ? "test:live-review-preset-suite"
                        : "test:live-review-actions",
          "--workspace",
          "@founderos/web",
        ],
        cwd: repoRoot,
        env: reviewActionsEnv,
      });

      if (reviewActionsExitCode !== 0) {
        await teardown(reviewActionsExitCode);
      } else {
        const postActionParityEnv =
          mode === "review-playbooks"
            ? {
                ...parityEnv,
                FOUNDEROS_PARITY_REQUIRE_OPERATOR_DATA: "0",
                FOUNDEROS_PARITY_REQUIRE_DIVERSE_SCENARIOS: "0",
              }
            : parityEnv;

        const postActionParityExitCode = await runOneOff({
          label: "parity-post-actions",
          command: npmCommand,
          args: ["run", "test:live-parity", "--workspace", "@founderos/web"],
          cwd: repoRoot,
          env: postActionParityEnv,
        });

        await teardown(postActionParityExitCode);
      }
    } else {
      await teardown(parityExitCode);
    }
  } else {
    await waitUntilStopped();
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[stack] ${message}`);
  await teardown(1);
}
