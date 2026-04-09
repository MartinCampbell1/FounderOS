import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
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

const port =
  process.env.FOUNDEROS_WEB_PORT ??
  String(3860 + Math.floor(Math.random() * 100));
const host = process.env.FOUNDEROS_WEB_HOST ?? "127.0.0.1";
const baseUrl = externalBaseUrl || `http://${host}:${port}`;
const shellAdminToken = (
  process.env.FOUNDEROS_SHELL_ADMIN_TOKEN || "shell-parity-admin-token"
).trim();
const allowBlocked =
  process.env.FOUNDEROS_PARITY_ALLOW_BLOCKED === "1" ||
  process.env.FOUNDEROS_PARITY_ALLOW_BLOCKED === "true";
const requireCompleteChain =
  process.env.FOUNDEROS_PARITY_REQUIRE_COMPLETE_CHAIN === "1" ||
  process.env.FOUNDEROS_PARITY_REQUIRE_COMPLETE_CHAIN === "true";
const requireOperatorData =
  process.env.FOUNDEROS_PARITY_REQUIRE_OPERATOR_DATA === "1" ||
  process.env.FOUNDEROS_PARITY_REQUIRE_OPERATOR_DATA === "true";
const requireDiverseScenarios =
  process.env.FOUNDEROS_PARITY_REQUIRE_DIVERSE_SCENARIOS === "1" ||
  process.env.FOUNDEROS_PARITY_REQUIRE_DIVERSE_SCENARIOS === "true";
const requestedMinCompleteChainCount = Number.parseInt(
  process.env.FOUNDEROS_PARITY_MIN_COMPLETE_CHAIN_COUNT || "0",
  10,
);
const requestedMinScenarioVariantCount = Number.parseInt(
  process.env.FOUNDEROS_PARITY_MIN_SCENARIO_VARIANT_COUNT || "2",
  10,
);
const minCompleteChainCount =
  Number.isInteger(requestedMinCompleteChainCount) &&
  requestedMinCompleteChainCount > 0
    ? requestedMinCompleteChainCount
    : 0;
const minScenarioVariantCount =
  Number.isInteger(requestedMinScenarioVariantCount) &&
  requestedMinScenarioVariantCount > 0
    ? requestedMinScenarioVariantCount
    : 2;

const explicitParityScope = {
  project_id: (process.env.FOUNDEROS_PARITY_PROJECT_ID || "").trim(),
  intake_session_id: (
    process.env.FOUNDEROS_PARITY_INTAKE_SESSION_ID || ""
  ).trim(),
  session_id: (process.env.FOUNDEROS_PARITY_DISCOVERY_SESSION_ID || "").trim(),
  idea_id: (process.env.FOUNDEROS_PARITY_DISCOVERY_IDEA_ID || "").trim(),
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function hasParityScope(scope) {
  return Object.values(scope).some(Boolean);
}

function mergeParityScope(preferred, fallback) {
  return {
    project_id: preferred.project_id || fallback.project_id || "",
    intake_session_id:
      preferred.intake_session_id || fallback.intake_session_id || "",
    session_id: preferred.session_id || fallback.session_id || "",
    idea_id: preferred.idea_id || fallback.idea_id || "",
  };
}

function buildParityPath(scope) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(scope)) {
    if (value) {
      params.set(key, value);
    }
  }

  return params.toString()
    ? `${contract.liveRoutes.parityAudit}?${params.toString()}`
    : contract.liveRoutes.parityAudit;
}

function findAudit(audits, label) {
  return audits.find((audit) => audit.label === label) ?? null;
}

function findParityRecord(audits, label, key) {
  return (
    findAudit(audits, label)?.json?.records?.find(
      (record) => record.key === key,
    ) ?? null
  );
}

function hasCompleteParityScope(scope) {
  return Boolean(
    scope.project_id &&
    scope.intake_session_id &&
    scope.session_id &&
    scope.idea_id,
  );
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
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(shellAdminToken
        ? { "x-founderos-shell-admin-token": shellAdminToken }
        : {}),
    },
  });
  const json = await response.json();
  return { response, json };
}

function collectStatus(records, status, auditLabel) {
  return records
    .filter((record) => record.status === status)
    .map((record) => ({
      audit: auditLabel,
      key: record.key,
      label: record.label,
      shellSurfaceHref: record.shellSurfaceHref,
      detail: record.detail,
    }));
}

function validateParityAudit(payload, label, requiresDrilldowns) {
  assert(
    payload.response.status === 200,
    `${label} parity route must return 200.`,
  );
  assert(
    Array.isArray(payload.json.records) && payload.json.records.length > 0,
    `${label} parity route must include parity records.`,
  );
  assert(
    payload.json.summary && payload.json.drilldownSummary,
    `${label} parity route must include summary counts.`,
  );

  if (requiresDrilldowns) {
    assert(
      Array.isArray(payload.json.drilldowns) &&
        payload.json.drilldowns.length > 0,
      `${label} parity route must include detail drilldowns.`,
    );
  }
}

function buildDiscoveredParityScope(snapshot) {
  return {
    project_id: snapshot.routeScope?.projectId || "",
    intake_session_id: snapshot.routeScope?.intakeSessionId || "",
    session_id: snapshot.parityTargets?.discoverySessionId || "",
    idea_id: snapshot.parityTargets?.discoveryIdeaId || "",
  };
}

let lastStdout = "";
let lastStderr = "";
let diagnostics = null;
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

  const parityTargetsSnapshot = await fetchJson(
    contract.liveRoutes.parityTargets,
  );
  assert(
    parityTargetsSnapshot.response.status === 200,
    "Shell parity target route must return 200.",
  );
  assert(
    parityTargetsSnapshot.json.routeScope &&
      parityTargetsSnapshot.json.parityTargets,
    "Shell parity target route must include route scope and parity targets.",
  );
  assert(
    Array.isArray(parityTargetsSnapshot.json.records),
    "Shell parity target route must include parity target records.",
  );
  assert(
    parityTargetsSnapshot.json.coverage &&
      typeof parityTargetsSnapshot.json.coverage.candidateCount === "number" &&
      typeof parityTargetsSnapshot.json.coverage.completeLinkedChainCount ===
        "number",
    "Shell parity target route must include target resolution coverage diagnostics.",
  );

  const discoveredParityScope = buildDiscoveredParityScope(
    parityTargetsSnapshot.json,
  );
  const targetCoverage = parityTargetsSnapshot.json.coverage;
  const resolvedParityScope = mergeParityScope(
    explicitParityScope,
    discoveredParityScope,
  );
  const parityPath = buildParityPath(resolvedParityScope);
  const resolvedCompleteChain = hasCompleteParityScope(resolvedParityScope);

  if (requireCompleteChain && !resolvedCompleteChain) {
    throw new Error(
      `Live parity requires a complete linked chain target, but only resolved project=${resolvedParityScope.project_id || "n/a"}, intake=${resolvedParityScope.intake_session_id || "n/a"}, session=${resolvedParityScope.session_id || "n/a"}, idea=${resolvedParityScope.idea_id || "n/a"} with ${targetCoverage.completeLinkedChainCount}/${targetCoverage.linkedChainCandidateCount} complete chain candidates.`,
    );
  }

  const requiredCompleteChainCount = Math.max(
    minCompleteChainCount,
    requireCompleteChain ? 1 : 0,
  );
  if (
    requiredCompleteChainCount > 0 &&
    Number(targetCoverage.completeLinkedChainCount || 0) <
      requiredCompleteChainCount
  ) {
    throw new Error(
      `Live parity requires at least ${requiredCompleteChainCount} complete linked chains, but only found ${targetCoverage.completeLinkedChainCount}/${targetCoverage.linkedChainCandidateCount} complete chain candidates.`,
    );
  }

  if (requireDiverseScenarios) {
    const diversityExpectations = [
      {
        key: "completeLinkedScenarioVariantCount",
        label: "scenario variants",
        min: minScenarioVariantCount,
      },
      {
        key: "operatorAttentionChainCount",
        label: "chains with execution attention",
        min: 1,
      },
      {
        key: "cleanExecutionChainCount",
        label: "clean execution chains",
        min: 1,
      },
      {
        key: "pausedProjectChainCount",
        label: "paused execution chains",
        min: 1,
      },
      {
        key: "idleProjectChainCount",
        label: "idle execution chains",
        min: 1,
      },
      {
        key: "founderCommittedChainCount",
        label: "founder-committed discovery chains",
        min: 1,
      },
      {
        key: "founderReviewChainCount",
        label: "founder-review discovery chains",
        min: 1,
      },
    ];

    for (const expectation of diversityExpectations) {
      assert(
        Number(targetCoverage[expectation.key] || 0) >= expectation.min,
        `Live parity requires ${expectation.label} >= ${expectation.min}, received ${targetCoverage[expectation.key] || 0}.`,
      );
    }
  }

  const audits = [];

  const globalParityAudit = await fetchJson(contract.liveRoutes.parityAudit);
  validateParityAudit(globalParityAudit, "Global shell", false);
  audits.push({
    label: "global",
    path: contract.liveRoutes.parityAudit,
    json: globalParityAudit.json,
  });

  if (hasParityScope(resolvedParityScope)) {
    const scopedParityPath = buildParityPath(resolvedParityScope);
    const scopedParityAudit = await fetchJson(scopedParityPath);
    validateParityAudit(scopedParityAudit, "Scoped shell", true);
    audits.push({
      label: "scoped",
      path: scopedParityPath,
      json: scopedParityAudit.json,
    });
  }

  const driftRecords = audits.flatMap((audit) =>
    collectStatus(audit.json.records, "drift", audit.label),
  );
  const driftDrilldowns = audits.flatMap((audit) =>
    collectStatus(audit.json.drilldowns ?? [], "drift", audit.label),
  );
  const blockedRecords = audits.flatMap((audit) =>
    collectStatus(audit.json.records, "blocked", audit.label),
  );
  const blockedDrilldowns = audits.flatMap((audit) =>
    collectStatus(audit.json.drilldowns ?? [], "blocked", audit.label),
  );
  const errorRecords = audits.flatMap((audit) =>
    collectStatus(audit.json.records, "error", audit.label),
  );
  const errorDrilldowns = audits.flatMap((audit) =>
    collectStatus(audit.json.drilldowns ?? [], "error", audit.label),
  );

  const totalDrift = driftRecords.length + driftDrilldowns.length;
  const totalBlocked = blockedRecords.length + blockedDrilldowns.length;
  const totalError = errorRecords.length + errorDrilldowns.length;

  diagnostics = {
    targetCoverage,
    resolvedParityScope,
    explicitParityScope,
    discoveredParityScope,
    audits: audits.map((audit) => ({
      label: audit.label,
      path: audit.path,
      summary: audit.json.summary,
      drilldownSummary: audit.json.drilldownSummary,
    })),
    drift: {
      records: driftRecords,
      drilldowns: driftDrilldowns,
    },
    blocked: {
      records: blockedRecords,
      drilldowns: blockedDrilldowns,
    },
    errors: {
      records: errorRecords,
      drilldowns: errorDrilldowns,
    },
  };

  if (totalError > 0) {
    throw new Error(
      `Live parity check hit ${totalError} shell parity error record(s).`,
    );
  }

  if (totalDrift > 0) {
    throw new Error(
      `Live parity check found ${totalDrift} shell parity drift record(s).`,
    );
  }

  if (totalBlocked > 0 && !allowBlocked) {
    throw new Error(
      `Live parity check is blocked by ${totalBlocked} unavailable upstream record(s). Re-run with FOUNDEROS_PARITY_ALLOW_BLOCKED=1 to inspect blocked output without failing.`,
    );
  }

  if (requireOperatorData) {
    const minGlobalCount = Math.max(requiredCompleteChainCount, 1);
    const minExecutionAttentionCount = requireDiverseScenarios
      ? Math.max(Number(targetCoverage.operatorAttentionChainCount || 0), 1)
      : minGlobalCount;
    const expectations = [
      {
        label: "global",
        key: "portfolioChains",
        minShellCount: minGlobalCount,
        minUpstreamCount: minGlobalCount,
      },
      {
        label: "global",
        key: "executionIssues",
        minShellCount: minExecutionAttentionCount,
        minUpstreamCount: minExecutionAttentionCount,
      },
      {
        label: "global",
        key: "executionApprovals",
        minShellCount: minExecutionAttentionCount,
        minUpstreamCount: minExecutionAttentionCount,
      },
      {
        label: "global",
        key: "executionRuntimes",
        minShellCount: minExecutionAttentionCount,
        minUpstreamCount: minExecutionAttentionCount,
      },
      {
        label: "global",
        key: "discoveryAuthoringQueue",
        minShellCount: minGlobalCount,
        minUpstreamCount: minGlobalCount,
      },
      {
        label: "global",
        key: "discoveryReviewQueue",
        minShellCount: minGlobalCount,
        minUpstreamCount: minGlobalCount,
      },
      {
        label: "global",
        key: "discoveryTracesSurface",
        minShellCount: minGlobalCount,
        minUpstreamCount: minGlobalCount,
      },
      {
        label: "global",
        key: "discoveryReplaySurface",
        minShellCount: minGlobalCount,
        minUpstreamCount: minGlobalCount,
      },
      {
        label: "global",
        key: "discoveryBoardSimulationsSurface",
        minShellCount: minGlobalCount,
        minUpstreamCount: minGlobalCount,
      },
      {
        label: "scoped",
        key: "executionReviewQueue",
        minShellCount: 3,
        minUpstreamCount: 3,
      },
      {
        label: "scoped",
        key: "reviewCenterExecution",
        minShellCount: 3,
        minUpstreamCount: 3,
      },
      {
        label: "scoped",
        key: "reviewCenterDiscovery",
        minShellCount: 1,
        minUpstreamCount: 1,
      },
      {
        label: "scoped",
        key: "dashboardAttentionQueue",
        minShellCount: 3,
        minUpstreamCount: 3,
      },
      {
        label: "scoped",
        key: "inboxAttentionQueue",
        minShellCount: 3,
        minUpstreamCount: 3,
      },
    ];

    for (const expectation of expectations) {
      const record = findParityRecord(
        audits,
        expectation.label,
        expectation.key,
      );
      assert(
        record,
        `Live parity requires operator-rich record ${expectation.label}:${expectation.key}.`,
      );
      assert(
        record.status === "ok",
        `Live parity requires ${expectation.label}:${expectation.key} to be ok, received ${record.status}.`,
      );
      assert(
        Number(record.shellCount || 0) >= expectation.minShellCount,
        `Live parity requires ${expectation.label}:${expectation.key} to expose at least ${expectation.minShellCount} shell record(s), received ${record.shellCount || 0}.`,
      );
      assert(
        Number(record.upstreamCount || 0) >= expectation.minUpstreamCount,
        `Live parity requires ${expectation.label}:${expectation.key} to expose at least ${expectation.minUpstreamCount} upstream record(s), received ${record.upstreamCount || 0}.`,
      );
    }
  }

  console.log(
    JSON.stringify({
      status: totalBlocked > 0 ? "blocked" : "ok",
      baseUrl,
      externalShell: Boolean(externalBaseUrl),
      parityPath,
      allowBlocked,
      requireCompleteChain,
      requireOperatorData,
      requireDiverseScenarios,
      minCompleteChainCount,
      minScenarioVariantCount,
      requiredCompleteChainCount,
      scope: resolvedParityScope,
      explicitScope: explicitParityScope,
      discoveredScope: discoveredParityScope,
      targetQuality: resolvedCompleteChain
        ? "complete-linked-chain"
        : "partial-fallback",
      targetSnapshot: {
        generatedAt: parityTargetsSnapshot.json.generatedAt,
        loadState: parityTargetsSnapshot.json.loadState,
        errors: parityTargetsSnapshot.json.errors,
        records: parityTargetsSnapshot.json.records,
        coverage: targetCoverage,
      },
      audits: audits.map((audit) => ({
        label: audit.label,
        path: audit.path,
        summary: audit.json.summary,
        drilldownSummary: audit.json.drilldownSummary,
      })),
      drift: {
        records: driftRecords,
        drilldowns: driftDrilldowns,
      },
      blocked: {
        records: blockedRecords,
        drilldowns: blockedDrilldowns,
      },
      errors: {
        records: errorRecords,
        drilldowns: errorDrilldowns,
      },
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify(
      {
        status: "error",
        baseUrl,
        parityPath: buildParityPath(explicitParityScope),
        allowBlocked,
        requireCompleteChain,
        requireOperatorData,
        requireDiverseScenarios,
        minCompleteChainCount,
        minScenarioVariantCount,
        scope: explicitParityScope,
        error: error instanceof Error ? error.message : String(error),
        diagnostics,
        stdout: lastStdout,
        stderr: lastStderr,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  await teardown();
}
