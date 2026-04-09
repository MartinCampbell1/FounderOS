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
  String(3930 + Math.floor(Math.random() * 100));
const baseUrl = externalBaseUrl || `http://${host}:${port}`;
const shellAdminToken = (
  process.env.FOUNDEROS_SHELL_ADMIN_TOKEN || "shell-review-batch-admin-token"
).trim();
const SUITE_TARGET_KEYS = ["discovery-pass", "critical-pass", "decision-pass"];
const ROUTE_DIAGNOSTIC_KEYS = [
  "review",
  "discovery-review",
  "execution-review",
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function firstString(value) {
  return String(value || "").trim();
}

function buildQuery(entries) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    if (!value) {
      continue;
    }
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function buildExecutionAttentionKey(record) {
  if (record.type === "issue") {
    return `issue:${record.issue.id}`;
  }
  if (record.type === "approval") {
    return `approval:${record.approval.id}`;
  }
  return `runtime:${record.runtime.id}`;
}

function findById(items, key, expectedId) {
  return items.find((item) => String(item?.[key] || "") === expectedId) ?? null;
}

function findByKey(records, expectedKey) {
  if (!Array.isArray(records)) {
    return null;
  }
  return (
    records.find((record) => String(record?.key || "") === expectedKey) ?? null
  );
}

function findPortfolioRecord(records, projectId) {
  if (!Array.isArray(records)) {
    return null;
  }

  return (
    records.find((record) => String(record?.project?.id || "") === projectId) ??
    null
  );
}

function getCollectionLength(payload, key) {
  const collection = payload?.json?.[key];
  return Array.isArray(collection) ? collection.length : 0;
}

function getNestedCollectionLength(payload, keys) {
  let current = payload?.json;
  for (const key of keys) {
    current = current?.[key];
  }
  return Array.isArray(current) ? current.length : 0;
}

function sortedStrings(values) {
  return [...new Set((values || []).map((value) => String(value)))].sort();
}

function assertStringArrayEqual(actualValues, expectedValues, label) {
  const actual = sortedStrings(actualValues);
  const expected = sortedStrings(expectedValues);
  assert(
    actual.length === expected.length &&
      actual.every((value, index) => value === expected[index]),
    `${label} mismatch. Expected [${expected.join(", ")}], received [${actual.join(", ")}].`,
  );
}

function summarizeSurfaceCounts(payloads) {
  return {
    reviewDiscoveryCount: getNestedCollectionLength(payloads.reviewCenter, [
      "discovery",
      "records",
    ]),
    reviewExecutionCount: getNestedCollectionLength(payloads.reviewCenter, [
      "execution",
      "records",
    ]),
    discoveryReviewCount: getCollectionLength(
      payloads.discoveryReview,
      "records",
    ),
    executionReviewCount: getCollectionLength(
      payloads.executionReview,
      "records",
    ),
    inboxIssueCount: getCollectionLength(payloads.inbox, "issues"),
    inboxApprovalCount: getCollectionLength(payloads.inbox, "approvals"),
    inboxRuntimeCount: getCollectionLength(payloads.inbox, "runtimes"),
    dashboardIssueCount: getCollectionLength(payloads.dashboard, "issues"),
    dashboardApprovalCount: getCollectionLength(
      payloads.dashboard,
      "approvals",
    ),
    dashboardRuntimeCount: getCollectionLength(payloads.dashboard, "runtimes"),
  };
}

function parseSuiteTargets(rawValue) {
  const trimmed = (rawValue || "").trim();
  if (!trimmed) {
    throw new Error(
      "FOUNDEROS_REVIEW_SUITE_TARGETS_JSON is required for route-native live review batch checks.",
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
  for (const preset of SUITE_TARGET_KEYS) {
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

function hasScope(scope) {
  return Boolean(scope?.projectId || scope?.intakeSessionId);
}

function matchesChainScope(chain, scope) {
  if (!hasScope(scope)) {
    return true;
  }

  const chainProjectId = firstString(chain?.project?.id || chain?.projectId);
  const chainIntakeSessionId = firstString(
    chain?.intakeSession?.id || chain?.intakeSessionId,
  );

  if (scope.projectId && chainProjectId !== scope.projectId) {
    return false;
  }

  if (scope.intakeSessionId && chainIntakeSessionId !== scope.intakeSessionId) {
    return false;
  }

  return true;
}

function matchesAttentionScope(record, scope) {
  if (!hasScope(scope)) {
    return true;
  }

  const projectId = firstString(record?.source?.projectId);
  if (scope.projectId && projectId !== scope.projectId) {
    return false;
  }

  if (!scope.intakeSessionId) {
    return true;
  }

  const intakeSessionId = firstString(
    record?.source?.intakeSession?.id ||
      (record?.source?.sourceKind === "intake_session"
        ? record?.source?.sourceExternalId
        : ""),
  );

  return intakeSessionId === scope.intakeSessionId;
}

function matchesDiscoveryFilter(record, filter) {
  if (filter === "all") return true;
  if (filter === "authoring") return record.kind === "authoring";
  if (filter === "trace") return record.kind === "trace-review";
  if (filter === "handoff") return record.kind === "handoff-ready";
  if (filter === "execution") return record.kind === "execution-followthrough";
  if (filter === "linked") return Boolean(record.chain);
  return (record.trace?.linkedSessionIds.length ?? 0) > 0;
}

function matchesExecutionFilter(record, filter) {
  if (filter === "all") return true;
  if (filter === "issues") return record.type === "issue";
  if (filter === "approvals") return record.type === "approval";
  if (filter === "runtimes") return record.type === "runtime";
  if (filter === "decisions") {
    return record.type === "approval" || record.type === "runtime";
  }
  if (filter === "intake") {
    return record.source?.sourceKind === "intake_session";
  }
  if (filter === "linked") {
    return record.source?.chainKind !== "unlinked";
  }
  return false;
}

function matchesDiscoveryLane(record, lane) {
  if (lane === "all" || lane === "discovery") return true;
  if (lane === "authoring") return record.kind === "authoring";
  if (lane === "trace") return record.kind === "trace-review";
  if (lane === "handoff") return record.kind === "handoff-ready";
  if (lane === "followthrough")
    return record.kind === "execution-followthrough";
  if (lane === "linked") return Boolean(record.chain);
  return false;
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

async function fetchHtml(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: shellAdminToken
      ? { "x-founderos-shell-admin-token": shellAdminToken }
      : {},
  });
  const html = await response.text();

  return {
    response,
    html,
  };
}

function extractRouteDiagnostics(html, routeKey) {
  const pattern = new RegExp(
    `<script[^>]*data-founderos-route-diagnostics=["']${routeKey}["'][^>]*>([\\s\\S]*?)<\\/script>`,
    "i",
  );
  const match = html.match(pattern);
  assert(match, `Missing ${routeKey} route diagnostics payload.`);

  try {
    return JSON.parse(match[1]);
  } catch (error) {
    throw new Error(
      `Failed to parse ${routeKey} route diagnostics payload. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function loadRouteDiagnostics(path, routeKey) {
  assert(
    ROUTE_DIAGNOSTIC_KEYS.includes(routeKey),
    `Unsupported route diagnostics key ${routeKey}.`,
  );
  const payload = await fetchHtml(path);
  assert(
    payload.response.status === 200,
    `Failed to load route ${path} with ${payload.response.status}.`,
  );
  return extractRouteDiagnostics(payload.html, routeKey);
}

async function loadDossierSnapshot(ideaId) {
  const payload = await fetchJson(
    `/api/shell/discovery/ideas${buildQuery({
      ideaId,
      limit: 50,
    })}`,
  );
  assert(
    payload.response.status === 200,
    `Failed to load discovery dossier for ${ideaId}.`,
  );
  assert(
    payload.json?.dossier?.idea?.idea_id === ideaId,
    `Shell discovery dossier snapshot did not resolve ${ideaId}.`,
  );
  return payload;
}

function discoveryDecisionType(kind) {
  if (kind === "trace-review") return "trace_review_confirmed";
  if (kind === "handoff-ready") return "handoff_ready_confirmed";
  if (kind === "execution-followthrough") {
    return "execution_followthrough_confirmed";
  }
  return "authoring_review_confirmed";
}

function discoveryDecisionRationale(record, stepLabel) {
  return `Live review batch route check (${stepLabel}) confirmed this ${record.kind} record through visible-card batch triage.`;
}

function discoveryDecisionMetadata(record, stepLabel) {
  return {
    review_kind: record.kind,
    idea_id: record.dossier.idea.idea_id,
    brief_id: record.chain?.briefId ?? null,
    project_id: record.chain?.project?.id ?? null,
    intake_session_id:
      record.chain?.intakeSession?.id ?? record.chain?.intakeSessionId ?? null,
    linked_replay_session_ids: record.trace?.linkedSessionIds ?? [],
    latest_trace_kind: record.trace?.latestKind ?? null,
    latest_trace_title: record.trace?.latestTitle ?? null,
    review_reason: record.reason,
    recommended_action: record.recommendedAction,
    operator_note: `Live review batch route check (${stepLabel}) confirmed this record.`,
    route: "discovery_review",
    source: "live-review-batch-routes",
    step: stepLabel,
  };
}

async function postDiscoveryConfirm(record, stepLabel) {
  const response = await fetchJson(
    `/api/shell/discovery/actions/orchestrate/discovery/ideas/${encodeURIComponent(
      record.dossier.idea.idea_id,
    )}/decisions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        decision_type: discoveryDecisionType(record.kind),
        rationale: discoveryDecisionRationale(record, stepLabel),
        actor: "founder",
        metadata: discoveryDecisionMetadata(record, stepLabel),
      }),
    },
  );

  assert(
    response.response.status === 200,
    `Discovery review confirm failed for ${record.dossier.idea.idea_id} with ${response.response.status}.`,
  );

  return response.json;
}

async function postExecutionIssueResolve(record, stepLabel) {
  const response = await fetchJson(
    `/api/shell/execution/actions/execution-plane/issues/${encodeURIComponent(
      record.issue.id,
    )}/resolve`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actor: "founderos-shell",
        note: `Live review batch route check (${stepLabel}) resolved this execution issue.`,
      }),
    },
  );

  if (response.response.status === 409) {
    return { skipped: true };
  }

  assert(
    response.response.status === 200,
    `Execution issue resolve failed for ${record.issue.id} with ${response.response.status}.`,
  );
  assert(
    response.json.issue?.status === "resolved",
    `Execution issue ${record.issue.id} did not resolve.`,
  );

  return { skipped: false };
}

async function postExecutionApprovalApprove(record, stepLabel) {
  const response = await fetchJson(
    `/api/shell/execution/actions/execution-plane/approvals/${encodeURIComponent(
      record.approval.id,
    )}/approve`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actor: "founderos-shell",
        note: `Live review batch route check (${stepLabel}) approved this execution approval.`,
      }),
    },
  );

  if (response.response.status === 409) {
    return { skipped: true };
  }

  assert(
    response.response.status === 200,
    `Execution approval approve failed for ${record.approval.id} with ${response.response.status}.`,
  );
  assert(
    response.json.approval?.status === "approved",
    `Execution approval ${record.approval.id} did not transition to approved.`,
  );

  return { skipped: false };
}

async function postExecutionRuntimeAllow(record, stepLabel) {
  const response = await fetchJson(
    `/api/shell/execution/actions/execution-plane/tool-permission-runtimes/${encodeURIComponent(
      record.runtime.id,
    )}/allow`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actor: "founderos-shell",
        note: `Live review batch route check (${stepLabel}) allowed this tool permission runtime.`,
        source: "user",
      }),
    },
  );

  if (response.response.status === 409) {
    return { skipped: true };
  }

  assert(
    response.response.status === 200,
    `Execution runtime allow failed for ${record.runtime.id} with ${response.response.status}.`,
  );
  assert(
    response.json.runtime?.status === "resolved",
    `Execution runtime ${record.runtime.id} did not resolve.`,
  );

  return { skipped: false };
}

async function loadGlobalSurfaces() {
  const payloads = {
    reviewCenter: await fetchJson("/api/shell/review"),
    discoveryReview: await fetchJson("/api/shell/discovery/review"),
    executionReview: await fetchJson("/api/shell/execution/review"),
    inbox: await fetchJson("/api/shell/inbox"),
    dashboard: await fetchJson("/api/shell/dashboard"),
    portfolio: await fetchJson("/api/shell/portfolio"),
  };

  assert(
    payloads.reviewCenter.response.status === 200,
    "Failed to read review center.",
  );
  assert(
    payloads.discoveryReview.response.status === 200,
    "Failed to read discovery review surface.",
  );
  assert(
    payloads.executionReview.response.status === 200,
    "Failed to read execution review surface.",
  );
  assert(
    payloads.inbox.response.status === 200,
    "Failed to read inbox surface.",
  );
  assert(
    payloads.dashboard.response.status === 200,
    "Failed to read dashboard surface.",
  );
  assert(
    payloads.portfolio.response.status === 200,
    "Failed to read portfolio surface.",
  );

  return payloads;
}

async function loadExecutionFeeds(projectId) {
  assert(projectId, "Project id is required for execution feed checks.");
  const issuesOpen = await fetchJson(
    `/api/shell/execution/attention${buildQuery({
      kind: "issues",
      project_id: projectId,
      status: "open",
    })}`,
  );
  const issuesAll = await fetchJson(
    `/api/shell/execution/attention${buildQuery({
      kind: "issues",
      project_id: projectId,
    })}`,
  );
  const approvalsPending = await fetchJson(
    `/api/shell/execution/attention${buildQuery({
      kind: "approvals",
      project_id: projectId,
      status: "pending",
    })}`,
  );
  const approvalsAll = await fetchJson(
    `/api/shell/execution/attention${buildQuery({
      kind: "approvals",
      project_id: projectId,
    })}`,
  );
  const runtimesPending = await fetchJson(
    `/api/shell/execution/attention${buildQuery({
      kind: "runtimes",
      project_id: projectId,
      status: "pending",
    })}`,
  );
  const runtimesAll = await fetchJson(
    `/api/shell/execution/attention${buildQuery({
      kind: "runtimes",
      project_id: projectId,
    })}`,
  );

  assert(
    issuesOpen.response.status === 200,
    `Failed to read issues for ${projectId}.`,
  );
  assert(
    approvalsPending.response.status === 200,
    `Failed to read approvals for ${projectId}.`,
  );
  assert(
    runtimesPending.response.status === 200,
    `Failed to read runtimes for ${projectId}.`,
  );

  return {
    issuesOpen,
    issuesAll,
    approvalsPending,
    approvalsAll,
    runtimesPending,
    runtimesAll,
  };
}

function selectUnifiedDiscoveryBatchRecords(snapshot, target) {
  return selectUnifiedDiscoveryLaneRecords(snapshot, target, "linked");
}

function selectUnifiedDiscoveryLaneRecords(snapshot, target, lane) {
  return (snapshot.reviewCenter.json.discovery?.records || []).filter(
    (record) =>
      Boolean(record.chain) &&
      matchesChainScope(record.chain, target.routeScope) &&
      matchesDiscoveryLane(record, lane),
  );
}

function selectUnifiedExecutionLaneRecords(snapshot, target, lane) {
  return (snapshot.reviewCenter.json.execution?.records || []).filter(
    (record) => {
      if (!matchesAttentionScope(record, target.routeScope)) {
        return false;
      }
      if (lane === "critical") {
        return record.type === "issue" && record.issue?.severity === "critical";
      }
      return matchesExecutionFilter(record, lane);
    },
  );
}

function selectDiscoveryReviewBatchRecords(snapshot, target) {
  return (snapshot.discoveryReview.json.records || []).filter(
    (record) =>
      Boolean(record.chain) &&
      matchesChainScope(record.chain, target.routeScope) &&
      matchesDiscoveryFilter(record, "linked"),
  );
}

function selectExecutionIssueBatchRecords(snapshot, target) {
  return (snapshot.executionReview.json.records || []).filter(
    (record) =>
      matchesAttentionScope(record, target.routeScope) &&
      matchesExecutionFilter(record, "issues"),
  );
}

function selectExecutionDecisionBatchRecords(snapshot, target) {
  const visible = (snapshot.executionReview.json.records || []).filter(
    (record) =>
      matchesAttentionScope(record, target.routeScope) &&
      matchesExecutionFilter(record, "decisions"),
  );

  return {
    approvals: visible.filter((record) => record.type === "approval"),
    runtimes: visible.filter((record) => record.type === "runtime"),
  };
}

function assertReviewRouteDiagnostics(diag, args) {
  assert(diag?.route === "review", "Unexpected review route payload.");
  assert(
    diag?.lane === args.lane,
    `Review route lane mismatch for ${args.label}.`,
  );
  assert(
    firstString(diag?.routeScope?.projectId) ===
      firstString(args.target.routeScope.projectId),
    `Review route project scope mismatch for ${args.label}.`,
  );
  assert(
    firstString(diag?.routeScope?.intakeSessionId) ===
      firstString(args.target.routeScope.intakeSessionId),
    `Review route intake scope mismatch for ${args.label}.`,
  );
  assertStringArrayEqual(
    diag?.discovery?.keys,
    args.discoveryRecords.map((record) => record.key),
    `${args.label} discovery keys`,
  );
  assertStringArrayEqual(
    diag?.discovery?.ideaIds,
    args.discoveryRecords.map((record) => record.dossier.idea.idea_id),
    `${args.label} discovery idea ids`,
  );
  assertStringArrayEqual(
    diag?.execution?.keys,
    args.executionRecords.map((record) => record.key),
    `${args.label} execution keys`,
  );
  assertStringArrayEqual(
    diag?.execution?.issueIds,
    args.executionRecords
      .filter((record) => record.type === "issue")
      .map((record) => record.issue.id),
    `${args.label} execution issue ids`,
  );
  assertStringArrayEqual(
    diag?.execution?.approvalIds,
    args.executionRecords
      .filter((record) => record.type === "approval")
      .map((record) => record.approval.id),
    `${args.label} execution approval ids`,
  );
  assertStringArrayEqual(
    diag?.execution?.runtimeIds,
    args.executionRecords
      .filter((record) => record.type === "runtime")
      .map((record) => record.runtime.id),
    `${args.label} execution runtime ids`,
  );
}

function assertDiscoveryReviewRouteDiagnostics(diag, args) {
  assert(
    diag?.route === "discovery-review",
    "Unexpected discovery review route payload.",
  );
  assert(
    diag?.filter === args.filter,
    `Discovery review filter mismatch for ${args.label}.`,
  );
  assert(
    firstString(diag?.routeScope?.projectId) ===
      firstString(args.target.routeScope.projectId),
    `Discovery review project scope mismatch for ${args.label}.`,
  );
  assert(
    firstString(diag?.routeScope?.intakeSessionId) ===
      firstString(args.target.routeScope.intakeSessionId),
    `Discovery review intake scope mismatch for ${args.label}.`,
  );
  assertStringArrayEqual(
    diag?.visible?.keys,
    args.records.map((record) => record.key),
    `${args.label} discovery review keys`,
  );
  assertStringArrayEqual(
    diag?.visible?.ideaIds,
    args.records.map((record) => record.dossier.idea.idea_id),
    `${args.label} discovery review idea ids`,
  );
}

function assertExecutionReviewRouteDiagnostics(diag, args) {
  assert(
    diag?.route === "execution-review",
    "Unexpected execution review route payload.",
  );
  assert(
    diag?.filter === args.filter,
    `Execution review filter mismatch for ${args.label}.`,
  );
  assert(
    firstString(diag?.routeScope?.projectId) ===
      firstString(args.target.routeScope.projectId),
    `Execution review project scope mismatch for ${args.label}.`,
  );
  assert(
    firstString(diag?.routeScope?.intakeSessionId) ===
      firstString(args.target.routeScope.intakeSessionId),
    `Execution review intake scope mismatch for ${args.label}.`,
  );
  assertStringArrayEqual(
    diag?.visible?.keys,
    args.records.map((record) => record.key),
    `${args.label} execution review keys`,
  );
  assertStringArrayEqual(
    diag?.visible?.issueIds,
    args.records
      .filter((record) => record.type === "issue")
      .map((record) => record.issue.id),
    `${args.label} execution review issue ids`,
  );
  assertStringArrayEqual(
    diag?.visible?.approvalIds,
    args.records
      .filter((record) => record.type === "approval")
      .map((record) => record.approval.id),
    `${args.label} execution review approval ids`,
  );
  assertStringArrayEqual(
    diag?.visible?.runtimeIds,
    args.records
      .filter((record) => record.type === "runtime")
      .map((record) => record.runtime.id),
    `${args.label} execution review runtime ids`,
  );
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

  const before = await loadGlobalSurfaces();
  const criticalProjectId = suiteTargets["critical-pass"].routeScope.projectId;
  const decisionProjectId = suiteTargets["decision-pass"].routeScope.projectId;

  const unifiedDiscoveryRecords = selectUnifiedDiscoveryBatchRecords(
    before,
    suiteTargets["discovery-pass"],
  );
  const unifiedReviewIssueRecords = selectUnifiedExecutionLaneRecords(
    before,
    suiteTargets["critical-pass"],
    "issues",
  );
  const unifiedReviewDecisionRecords = selectUnifiedExecutionLaneRecords(
    before,
    suiteTargets["decision-pass"],
    "decisions",
  );
  const unifiedReviewLinkedExecutionRecords = selectUnifiedExecutionLaneRecords(
    before,
    suiteTargets["discovery-pass"],
    "linked",
  );
  const discoveryReviewRecords = selectDiscoveryReviewBatchRecords(
    before,
    suiteTargets["critical-pass"],
  );
  const executionIssueRecords = selectExecutionIssueBatchRecords(
    before,
    suiteTargets["critical-pass"],
  );
  const executionDecisionRecords = selectExecutionDecisionBatchRecords(
    before,
    suiteTargets["decision-pass"],
  );

  assert(
    unifiedDiscoveryRecords.length > 0,
    "Unified /review linked lane did not expose any visible discovery records.",
  );
  assert(
    discoveryReviewRecords.length > 0,
    "Discovery review linked filter did not expose any visible records.",
  );
  assert(
    executionIssueRecords.length > 0,
    "Execution review issues filter did not expose any visible issue records.",
  );
  assert(
    executionDecisionRecords.approvals.length > 0,
    "Execution review decisions filter did not expose any visible approval records.",
  );
  assert(
    executionDecisionRecords.runtimes.length > 0,
    "Execution review decisions filter did not expose any visible runtime records.",
  );
  assert(
    unifiedReviewIssueRecords.length > 0,
    "Unified /review issues lane did not expose any visible issue records.",
  );
  assert(
    unifiedReviewDecisionRecords.length > 0,
    "Unified /review decisions lane did not expose any visible decision records.",
  );

  const deterministicCriticalIssueId = firstString(
    suiteTargets["critical-pass"].actionTargets?.execution?.issue?.issueId,
  );
  const deterministicDecisionApprovalId = firstString(
    suiteTargets["decision-pass"].actionTargets?.execution?.approval
      ?.approvalId,
  );
  const deterministicDecisionRuntimeId = firstString(
    suiteTargets["decision-pass"].actionTargets?.execution?.runtime?.runtimeId,
  );

  if (deterministicCriticalIssueId) {
    assert(
      Boolean(
        findById(
          executionIssueRecords.map((record) => record.issue),
          "id",
          deterministicCriticalIssueId,
        ),
      ),
      `Execution issue batch selection does not include deterministic issue ${deterministicCriticalIssueId}.`,
    );
  }
  if (deterministicDecisionApprovalId) {
    assert(
      Boolean(
        findById(
          executionDecisionRecords.approvals.map((record) => record.approval),
          "id",
          deterministicDecisionApprovalId,
        ),
      ),
      `Execution decision batch selection does not include deterministic approval ${deterministicDecisionApprovalId}.`,
    );
  }
  if (deterministicDecisionRuntimeId) {
    assert(
      Boolean(
        findById(
          executionDecisionRecords.runtimes.map((record) => record.runtime),
          "id",
          deterministicDecisionRuntimeId,
        ),
      ),
      `Execution decision batch selection does not include deterministic runtime ${deterministicDecisionRuntimeId}.`,
    );
  }

  const beforeReviewLinkedRoute = await loadRouteDiagnostics(
    `/review${buildQuery({
      lane: "linked",
      project_id: suiteTargets["discovery-pass"].routeScope.projectId,
      intake_session_id:
        suiteTargets["discovery-pass"].routeScope.intakeSessionId,
    })}`,
    "review",
  );
  const beforeReviewIssuesRoute = await loadRouteDiagnostics(
    `/review${buildQuery({
      lane: "issues",
      project_id: suiteTargets["critical-pass"].routeScope.projectId,
      intake_session_id:
        suiteTargets["critical-pass"].routeScope.intakeSessionId,
    })}`,
    "review",
  );
  const beforeReviewDecisionsRoute = await loadRouteDiagnostics(
    `/review${buildQuery({
      lane: "decisions",
      project_id: suiteTargets["decision-pass"].routeScope.projectId,
      intake_session_id:
        suiteTargets["decision-pass"].routeScope.intakeSessionId,
    })}`,
    "review",
  );
  const beforeDiscoveryReviewRoute = await loadRouteDiagnostics(
    `/discovery/review${buildQuery({
      filter: "linked",
      project_id: suiteTargets["critical-pass"].routeScope.projectId,
      intake_session_id:
        suiteTargets["critical-pass"].routeScope.intakeSessionId,
    })}`,
    "discovery-review",
  );
  const beforeExecutionIssuesRoute = await loadRouteDiagnostics(
    `/execution/review${buildQuery({
      filter: "issues",
      project_id: suiteTargets["critical-pass"].routeScope.projectId,
      intake_session_id:
        suiteTargets["critical-pass"].routeScope.intakeSessionId,
    })}`,
    "execution-review",
  );
  const beforeExecutionApprovalsRoute = await loadRouteDiagnostics(
    `/execution/review${buildQuery({
      filter: "approvals",
      project_id: suiteTargets["decision-pass"].routeScope.projectId,
      intake_session_id:
        suiteTargets["decision-pass"].routeScope.intakeSessionId,
    })}`,
    "execution-review",
  );
  const beforeExecutionRuntimesRoute = await loadRouteDiagnostics(
    `/execution/review${buildQuery({
      filter: "runtimes",
      project_id: suiteTargets["decision-pass"].routeScope.projectId,
      intake_session_id:
        suiteTargets["decision-pass"].routeScope.intakeSessionId,
    })}`,
    "execution-review",
  );
  const beforeExecutionDecisionsRoute = await loadRouteDiagnostics(
    `/execution/review${buildQuery({
      filter: "decisions",
      project_id: suiteTargets["decision-pass"].routeScope.projectId,
      intake_session_id:
        suiteTargets["decision-pass"].routeScope.intakeSessionId,
    })}`,
    "execution-review",
  );

  assertReviewRouteDiagnostics(beforeReviewLinkedRoute, {
    label: "/review?lane=linked",
    lane: "linked",
    target: suiteTargets["discovery-pass"],
    discoveryRecords: unifiedDiscoveryRecords,
    executionRecords: unifiedReviewLinkedExecutionRecords,
  });
  assertReviewRouteDiagnostics(beforeReviewIssuesRoute, {
    label: "/review?lane=issues",
    lane: "issues",
    target: suiteTargets["critical-pass"],
    discoveryRecords: [],
    executionRecords: unifiedReviewIssueRecords,
  });
  assertReviewRouteDiagnostics(beforeReviewDecisionsRoute, {
    label: "/review?lane=decisions",
    lane: "decisions",
    target: suiteTargets["decision-pass"],
    discoveryRecords: [],
    executionRecords: unifiedReviewDecisionRecords,
  });
  assertDiscoveryReviewRouteDiagnostics(beforeDiscoveryReviewRoute, {
    label: "/discovery/review?filter=linked",
    filter: "linked",
    target: suiteTargets["critical-pass"],
    records: discoveryReviewRecords,
  });
  assertExecutionReviewRouteDiagnostics(beforeExecutionIssuesRoute, {
    label: "/execution/review?filter=issues",
    filter: "issues",
    target: suiteTargets["critical-pass"],
    records: executionIssueRecords,
  });
  assertExecutionReviewRouteDiagnostics(beforeExecutionApprovalsRoute, {
    label: "/execution/review?filter=approvals",
    filter: "approvals",
    target: suiteTargets["decision-pass"],
    records: executionDecisionRecords.approvals,
  });
  assertExecutionReviewRouteDiagnostics(beforeExecutionRuntimesRoute, {
    label: "/execution/review?filter=runtimes",
    filter: "runtimes",
    target: suiteTargets["decision-pass"],
    records: executionDecisionRecords.runtimes,
  });
  assertExecutionReviewRouteDiagnostics(beforeExecutionDecisionsRoute, {
    label: "/execution/review?filter=decisions",
    filter: "decisions",
    target: suiteTargets["decision-pass"],
    records: [
      ...executionDecisionRecords.approvals,
      ...executionDecisionRecords.runtimes,
    ],
  });

  const discoveryRecordsByIdeaId = new Map();
  for (const record of [
    ...unifiedDiscoveryRecords,
    ...discoveryReviewRecords,
  ]) {
    const ideaId = record.dossier.idea.idea_id;
    if (!discoveryRecordsByIdeaId.has(ideaId)) {
      discoveryRecordsByIdeaId.set(ideaId, await loadDossierSnapshot(ideaId));
    }
  }

  const processedDiscoveryKeys = [];
  for (const record of unifiedDiscoveryRecords) {
    await postDiscoveryConfirm(record, "review-linked");
    processedDiscoveryKeys.push(record.key);
  }
  for (const record of discoveryReviewRecords) {
    await postDiscoveryConfirm(record, "discovery-review-linked");
    processedDiscoveryKeys.push(record.key);
  }

  const processedIssueIds = [];
  for (const record of executionIssueRecords) {
    const result = await postExecutionIssueResolve(
      record,
      "execution-review-issues",
    );
    if (!result.skipped) {
      processedIssueIds.push(record.issue.id);
    }
  }

  const processedApprovalIds = [];
  for (const record of executionDecisionRecords.approvals) {
    const result = await postExecutionApprovalApprove(
      record,
      "execution-review-decisions",
    );
    if (!result.skipped) {
      processedApprovalIds.push(record.approval.id);
    }
  }

  const processedRuntimeIds = [];
  for (const record of executionDecisionRecords.runtimes) {
    const result = await postExecutionRuntimeAllow(
      record,
      "execution-review-decisions",
    );
    if (!result.skipped) {
      processedRuntimeIds.push(record.runtime.id);
    }
  }

  const after = await loadGlobalSurfaces();
  const afterCriticalFeeds = await loadExecutionFeeds(criticalProjectId);
  const afterDecisionFeeds = await loadExecutionFeeds(decisionProjectId);
  const afterUnifiedDiscoveryRecords = selectUnifiedDiscoveryBatchRecords(
    after,
    suiteTargets["discovery-pass"],
  );
  const afterUnifiedReviewIssueRecords = selectUnifiedExecutionLaneRecords(
    after,
    suiteTargets["critical-pass"],
    "issues",
  );
  const afterUnifiedReviewDecisionRecords = selectUnifiedExecutionLaneRecords(
    after,
    suiteTargets["decision-pass"],
    "decisions",
  );
  const afterUnifiedReviewLinkedExecutionRecords =
    selectUnifiedExecutionLaneRecords(
      after,
      suiteTargets["discovery-pass"],
      "linked",
    );
  const afterDiscoveryReviewRecords = selectDiscoveryReviewBatchRecords(
    after,
    suiteTargets["critical-pass"],
  );
  const afterExecutionIssueRecords = selectExecutionIssueBatchRecords(
    after,
    suiteTargets["critical-pass"],
  );
  const afterExecutionDecisionRecords = selectExecutionDecisionBatchRecords(
    after,
    suiteTargets["decision-pass"],
  );

  const afterReviewLinkedRoute = await loadRouteDiagnostics(
    `/review${buildQuery({
      lane: "linked",
      project_id: suiteTargets["discovery-pass"].routeScope.projectId,
      intake_session_id:
        suiteTargets["discovery-pass"].routeScope.intakeSessionId,
    })}`,
    "review",
  );
  const afterReviewIssuesRoute = await loadRouteDiagnostics(
    `/review${buildQuery({
      lane: "issues",
      project_id: suiteTargets["critical-pass"].routeScope.projectId,
      intake_session_id:
        suiteTargets["critical-pass"].routeScope.intakeSessionId,
    })}`,
    "review",
  );
  const afterReviewDecisionsRoute = await loadRouteDiagnostics(
    `/review${buildQuery({
      lane: "decisions",
      project_id: suiteTargets["decision-pass"].routeScope.projectId,
      intake_session_id:
        suiteTargets["decision-pass"].routeScope.intakeSessionId,
    })}`,
    "review",
  );
  const afterDiscoveryReviewRoute = await loadRouteDiagnostics(
    `/discovery/review${buildQuery({
      filter: "linked",
      project_id: suiteTargets["critical-pass"].routeScope.projectId,
      intake_session_id:
        suiteTargets["critical-pass"].routeScope.intakeSessionId,
    })}`,
    "discovery-review",
  );
  const afterExecutionIssuesRoute = await loadRouteDiagnostics(
    `/execution/review${buildQuery({
      filter: "issues",
      project_id: suiteTargets["critical-pass"].routeScope.projectId,
      intake_session_id:
        suiteTargets["critical-pass"].routeScope.intakeSessionId,
    })}`,
    "execution-review",
  );
  const afterExecutionApprovalsRoute = await loadRouteDiagnostics(
    `/execution/review${buildQuery({
      filter: "approvals",
      project_id: suiteTargets["decision-pass"].routeScope.projectId,
      intake_session_id:
        suiteTargets["decision-pass"].routeScope.intakeSessionId,
    })}`,
    "execution-review",
  );
  const afterExecutionRuntimesRoute = await loadRouteDiagnostics(
    `/execution/review${buildQuery({
      filter: "runtimes",
      project_id: suiteTargets["decision-pass"].routeScope.projectId,
      intake_session_id:
        suiteTargets["decision-pass"].routeScope.intakeSessionId,
    })}`,
    "execution-review",
  );
  const afterExecutionDecisionsRoute = await loadRouteDiagnostics(
    `/execution/review${buildQuery({
      filter: "decisions",
      project_id: suiteTargets["decision-pass"].routeScope.projectId,
      intake_session_id:
        suiteTargets["decision-pass"].routeScope.intakeSessionId,
    })}`,
    "execution-review",
  );

  assertReviewRouteDiagnostics(afterReviewLinkedRoute, {
    label: "/review?lane=linked after batch triage",
    lane: "linked",
    target: suiteTargets["discovery-pass"],
    discoveryRecords: afterUnifiedDiscoveryRecords,
    executionRecords: afterUnifiedReviewLinkedExecutionRecords,
  });
  assertReviewRouteDiagnostics(afterReviewIssuesRoute, {
    label: "/review?lane=issues after batch triage",
    lane: "issues",
    target: suiteTargets["critical-pass"],
    discoveryRecords: [],
    executionRecords: afterUnifiedReviewIssueRecords,
  });
  assertReviewRouteDiagnostics(afterReviewDecisionsRoute, {
    label: "/review?lane=decisions after batch triage",
    lane: "decisions",
    target: suiteTargets["decision-pass"],
    discoveryRecords: [],
    executionRecords: afterUnifiedReviewDecisionRecords,
  });
  assertDiscoveryReviewRouteDiagnostics(afterDiscoveryReviewRoute, {
    label: "/discovery/review?filter=linked after batch triage",
    filter: "linked",
    target: suiteTargets["critical-pass"],
    records: afterDiscoveryReviewRecords,
  });
  assertExecutionReviewRouteDiagnostics(afterExecutionIssuesRoute, {
    label: "/execution/review?filter=issues after batch triage",
    filter: "issues",
    target: suiteTargets["critical-pass"],
    records: afterExecutionIssueRecords,
  });
  assertExecutionReviewRouteDiagnostics(afterExecutionApprovalsRoute, {
    label: "/execution/review?filter=approvals after batch triage",
    filter: "approvals",
    target: suiteTargets["decision-pass"],
    records: afterExecutionDecisionRecords.approvals,
  });
  assertExecutionReviewRouteDiagnostics(afterExecutionRuntimesRoute, {
    label: "/execution/review?filter=runtimes after batch triage",
    filter: "runtimes",
    target: suiteTargets["decision-pass"],
    records: afterExecutionDecisionRecords.runtimes,
  });
  assertExecutionReviewRouteDiagnostics(afterExecutionDecisionsRoute, {
    label: "/execution/review?filter=decisions after batch triage",
    filter: "decisions",
    target: suiteTargets["decision-pass"],
    records: [
      ...afterExecutionDecisionRecords.approvals,
      ...afterExecutionDecisionRecords.runtimes,
    ],
  });

  for (const [
    ideaId,
    beforeDossierPayload,
  ] of discoveryRecordsByIdeaId.entries()) {
    const beforeDecisionIds = new Set(
      (beforeDossierPayload.json.dossier?.decisions || []).map(
        (decision) => decision.decision_id,
      ),
    );
    const afterDossierPayload = await loadDossierSnapshot(ideaId);
    const afterDossier = afterDossierPayload.json.dossier;
    const relatedRecords = [
      ...unifiedDiscoveryRecords,
      ...discoveryReviewRecords,
    ].filter((record) => record.dossier.idea.idea_id === ideaId);

    for (const record of relatedRecords) {
      const expectedStep = unifiedDiscoveryRecords.some(
        (candidate) => candidate.key === record.key,
      )
        ? "review-linked"
        : "discovery-review-linked";
      const createdDecision =
        (afterDossier.decisions || []).find(
          (decision) =>
            !beforeDecisionIds.has(decision.decision_id) &&
            decision.decision_type === discoveryDecisionType(record.kind) &&
            String(decision.metadata?.source || "") ===
              "live-review-batch-routes" &&
            String(decision.metadata?.step || "") === expectedStep,
        ) ?? null;

      assert(
        createdDecision,
        `Discovery batch check did not append a new ${discoveryDecisionType(record.kind)} decision for ${ideaId} (${expectedStep}).`,
      );
    }
  }

  const afterCriticalPortfolioRecord = findPortfolioRecord(
    after.portfolio.json.records,
    criticalProjectId,
  );
  const afterDecisionPortfolioRecord = findPortfolioRecord(
    after.portfolio.json.records,
    decisionProjectId,
  );
  const beforeCriticalPortfolioRecord = findPortfolioRecord(
    before.portfolio.json.records,
    criticalProjectId,
  );
  const beforeDecisionPortfolioRecord = findPortfolioRecord(
    before.portfolio.json.records,
    decisionProjectId,
  );
  const processedRuntimeIdSet = new Set(processedRuntimeIds);

  for (const record of executionIssueRecords) {
    assert(
      !findById(
        afterCriticalFeeds.issuesOpen.json.issues || [],
        "id",
        record.issue.id,
      ),
      `Execution issue ${record.issue.id} still appears in the raw open issue feed after batch triage.`,
    );
    assert(
      findById(
        afterCriticalFeeds.issuesAll.json.issues || [],
        "id",
        record.issue.id,
      )?.status === "resolved",
      `Execution issue ${record.issue.id} is missing from the all-issues feed with resolved status after batch triage.`,
    );
    assert(
      !findById(after.inbox.json.issues || [], "id", record.issue.id),
      `Execution issue ${record.issue.id} still appears in the shell inbox snapshot after batch triage.`,
    );
    assert(
      !findById(after.dashboard.json.issues || [], "id", record.issue.id),
      `Execution issue ${record.issue.id} still appears in the shell dashboard snapshot after batch triage.`,
    );
    assert(
      !findByKey(
        after.reviewCenter.json.execution?.records,
        buildExecutionAttentionKey(record),
      ),
      `Execution issue ${record.issue.id} still appears in the unified review snapshot after batch triage.`,
    );
    assert(
      !findByKey(
        after.executionReview.json.records,
        buildExecutionAttentionKey(record),
      ),
      `Execution issue ${record.issue.id} still appears in the execution review snapshot after batch triage.`,
    );
    assert(
      !findById(
        afterCriticalPortfolioRecord?.attention?.issues || [],
        "id",
        record.issue.id,
      ),
      `Execution issue ${record.issue.id} still appears in the portfolio attention rollup after batch triage.`,
    );
  }

  for (const record of executionDecisionRecords.approvals) {
    assert(
      !findById(
        afterDecisionFeeds.approvalsPending.json.approvals || [],
        "id",
        record.approval.id,
      ),
      `Execution approval ${record.approval.id} still appears in the raw pending approval feed after batch triage.`,
    );
    assert(
      findById(
        afterDecisionFeeds.approvalsAll.json.approvals || [],
        "id",
        record.approval.id,
      )?.status === "approved",
      `Execution approval ${record.approval.id} is missing from the all-approvals feed with approved status after batch triage.`,
    );
    assert(
      !findById(after.inbox.json.approvals || [], "id", record.approval.id),
      `Execution approval ${record.approval.id} still appears in the shell inbox snapshot after batch triage.`,
    );
    assert(
      !findById(after.dashboard.json.approvals || [], "id", record.approval.id),
      `Execution approval ${record.approval.id} still appears in the shell dashboard snapshot after batch triage.`,
    );
    assert(
      !findByKey(
        after.reviewCenter.json.execution?.records,
        buildExecutionAttentionKey(record),
      ),
      `Execution approval ${record.approval.id} still appears in the unified review snapshot after batch triage.`,
    );
    assert(
      !findByKey(
        after.executionReview.json.records,
        buildExecutionAttentionKey(record),
      ),
      `Execution approval ${record.approval.id} still appears in the execution review snapshot after batch triage.`,
    );
    assert(
      !findById(
        afterDecisionPortfolioRecord?.attention?.approvals || [],
        "id",
        record.approval.id,
      ),
      `Execution approval ${record.approval.id} still appears in the portfolio attention rollup after batch triage.`,
    );
  }

  for (const record of executionDecisionRecords.runtimes) {
    assert(
      !findById(
        afterDecisionFeeds.runtimesPending.json.runtimes || [],
        "id",
        record.runtime.id,
      ),
      `Execution runtime ${record.runtime.id} still appears in the raw pending runtime feed after batch triage.`,
    );
    const resolvedRuntime = findById(
      afterDecisionFeeds.runtimesAll.json.runtimes || [],
      "id",
      record.runtime.id,
    );
    assert(
      resolvedRuntime?.status === "resolved",
      `Execution runtime ${record.runtime.id} is missing from the all-runtimes feed with resolved status after batch triage.`,
    );
    if (processedRuntimeIdSet.has(record.runtime.id)) {
      assert(
        String(
          resolvedRuntime?.resolved_behavior ||
            resolvedRuntime?.metadata?.pending?.resolved_behavior ||
            resolvedRuntime?.outcome ||
            "",
        ) === "allow",
        `Execution runtime ${record.runtime.id} is not marked as allowed after batch triage.`,
      );
    }
    assert(
      !findById(after.inbox.json.runtimes || [], "id", record.runtime.id),
      `Execution runtime ${record.runtime.id} still appears in the shell inbox snapshot after batch triage.`,
    );
    assert(
      !findById(after.dashboard.json.runtimes || [], "id", record.runtime.id),
      `Execution runtime ${record.runtime.id} still appears in the shell dashboard snapshot after batch triage.`,
    );
    assert(
      !findByKey(
        after.reviewCenter.json.execution?.records,
        buildExecutionAttentionKey(record),
      ),
      `Execution runtime ${record.runtime.id} still appears in the unified review snapshot after batch triage.`,
    );
    assert(
      !findByKey(
        after.executionReview.json.records,
        buildExecutionAttentionKey(record),
      ),
      `Execution runtime ${record.runtime.id} still appears in the execution review snapshot after batch triage.`,
    );
    assert(
      !findById(
        afterDecisionPortfolioRecord?.attention?.runtimes || [],
        "id",
        record.runtime.id,
      ),
      `Execution runtime ${record.runtime.id} still appears in the portfolio attention rollup after batch triage.`,
    );
  }

  assert(
    getCollectionLength(after.executionReview, "records") <=
      getCollectionLength(before.executionReview, "records") -
        (processedIssueIds.length +
          processedApprovalIds.length +
          processedRuntimeIds.length),
    "Execution review count did not drop after batch execution triage.",
  );

  if (beforeCriticalPortfolioRecord && afterCriticalPortfolioRecord) {
    assert(
      (afterCriticalPortfolioRecord.attention?.total ?? 0) <=
        (beforeCriticalPortfolioRecord.attention?.total ?? 0) -
          processedIssueIds.length,
      "Critical chain portfolio attention total did not drop after issue batch triage.",
    );
  }
  if (beforeDecisionPortfolioRecord && afterDecisionPortfolioRecord) {
    assert(
      (afterDecisionPortfolioRecord.attention?.total ?? 0) <=
        (beforeDecisionPortfolioRecord.attention?.total ?? 0) -
          (processedApprovalIds.length + processedRuntimeIds.length),
      "Decision chain portfolio attention total did not drop after decision batch triage.",
    );
  }

  console.log(
    JSON.stringify({
      status: "ok",
      baseUrl,
      routes: {
        review: {
          lane: "linked",
          role: suiteTargets["discovery-pass"].role,
          scenario: suiteTargets["discovery-pass"].scenario,
          routeScope: suiteTargets["discovery-pass"].routeScope,
          selectedDiscoveryKeys: unifiedDiscoveryRecords.map(
            (record) => record.key,
          ),
          selectedExecutionKeys: unifiedReviewLinkedExecutionRecords.map(
            (record) => record.key,
          ),
        },
        reviewIssues: {
          lane: "issues",
          role: suiteTargets["critical-pass"].role,
          scenario: suiteTargets["critical-pass"].scenario,
          routeScope: suiteTargets["critical-pass"].routeScope,
          selectedIssueIds: unifiedReviewIssueRecords.map(
            (record) => record.issue.id,
          ),
        },
        reviewDecisions: {
          lane: "decisions",
          role: suiteTargets["decision-pass"].role,
          scenario: suiteTargets["decision-pass"].scenario,
          routeScope: suiteTargets["decision-pass"].routeScope,
          selectedApprovalIds: unifiedReviewDecisionRecords
            .filter((record) => record.type === "approval")
            .map((record) => record.approval.id),
          selectedRuntimeIds: unifiedReviewDecisionRecords
            .filter((record) => record.type === "runtime")
            .map((record) => record.runtime.id),
        },
        discoveryReview: {
          filter: "linked",
          role: suiteTargets["critical-pass"].role,
          scenario: suiteTargets["critical-pass"].scenario,
          routeScope: suiteTargets["critical-pass"].routeScope,
          selectedDiscoveryKeys: discoveryReviewRecords.map(
            (record) => record.key,
          ),
        },
        executionReviewIssues: {
          filter: "issues",
          role: suiteTargets["critical-pass"].role,
          scenario: suiteTargets["critical-pass"].scenario,
          routeScope: suiteTargets["critical-pass"].routeScope,
          selectedIssueIds: executionIssueRecords.map(
            (record) => record.issue.id,
          ),
        },
        executionReviewDecisions: {
          filter: "decisions",
          role: suiteTargets["decision-pass"].role,
          scenario: suiteTargets["decision-pass"].scenario,
          routeScope: suiteTargets["decision-pass"].routeScope,
          selectedApprovalIds: executionDecisionRecords.approvals.map(
            (record) => record.approval.id,
          ),
          selectedRuntimeIds: executionDecisionRecords.runtimes.map(
            (record) => record.runtime.id,
          ),
        },
      },
      processed: {
        discoveryConfirmCount: processedDiscoveryKeys.length,
        issueResolveCount: processedIssueIds.length,
        approvalApproveCount: processedApprovalIds.length,
        runtimeAllowCount: processedRuntimeIds.length,
      },
      surfacesBefore: summarizeSurfaceCounts(before),
      surfacesAfter: summarizeSurfaceCounts(after),
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
