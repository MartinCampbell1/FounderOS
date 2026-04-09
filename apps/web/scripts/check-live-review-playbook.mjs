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

const VALID_PRESETS = new Set([
  "discovery-pass",
  "critical-pass",
  "decision-pass",
  "chain-pass",
]);
const preset = String(process.env.FOUNDEROS_REVIEW_PRESET || "chain-pass")
  .trim()
  .toLowerCase();

if (!VALID_PRESETS.has(preset)) {
  console.error(
    `Unsupported FOUNDEROS_REVIEW_PRESET "${preset}". Use one of: ${[
      ...VALID_PRESETS,
    ].join(", ")}.`,
  );
  process.exit(1);
}

const port =
  process.env.FOUNDEROS_WEB_PORT ??
  String(3910 + Math.floor(Math.random() * 100));
const host = process.env.FOUNDEROS_WEB_HOST ?? "127.0.0.1";
const baseUrl = externalBaseUrl || `http://${host}:${port}`;
const shellAdminToken = (
  process.env.FOUNDEROS_SHELL_ADMIN_TOKEN || "shell-review-playbook-admin-token"
).trim();

const explicitScope = {
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

function firstString(value) {
  return String(value || "").trim();
}

function mergeScope(preferred, fallback) {
  return {
    project_id: preferred.project_id || fallback.project_id || "",
    intake_session_id:
      preferred.intake_session_id || fallback.intake_session_id || "",
    session_id: preferred.session_id || fallback.session_id || "",
    idea_id: preferred.idea_id || fallback.idea_id || "",
  };
}

function parseActionTargets(rawValue) {
  const trimmed = (rawValue || "").trim();
  if (!trimmed) {
    return {
      discovery: null,
      execution: null,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    throw new Error(
      `FOUNDEROS_REVIEW_ACTION_TARGETS_JSON must contain valid JSON. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return {
    discovery:
      parsed?.discovery && typeof parsed.discovery === "object"
        ? {
            itemId: firstString(parsed.discovery.itemId),
            ideaId: firstString(parsed.discovery.ideaId),
            kind: firstString(parsed.discovery.kind),
          }
        : null,
    execution:
      parsed?.execution && typeof parsed.execution === "object"
        ? {
            issue:
              parsed.execution.issue &&
              typeof parsed.execution.issue === "object"
                ? {
                    issueId: firstString(parsed.execution.issue.issueId),
                    projectId: firstString(parsed.execution.issue.projectId),
                    seedKey: firstString(parsed.execution.issue.seedKey),
                  }
                : null,
            approval:
              parsed.execution.approval &&
              typeof parsed.execution.approval === "object"
                ? {
                    approvalId: firstString(
                      parsed.execution.approval.approvalId,
                    ),
                    projectId: firstString(parsed.execution.approval.projectId),
                    seedKey: firstString(parsed.execution.approval.seedKey),
                  }
                : null,
            runtime:
              parsed.execution.runtime &&
              typeof parsed.execution.runtime === "object"
                ? {
                    runtimeId: firstString(parsed.execution.runtime.runtimeId),
                    projectId: firstString(parsed.execution.runtime.projectId),
                    seedKey: firstString(parsed.execution.runtime.seedKey),
                  }
                : null,
          }
        : null,
  };
}

function buildDiscoveredScope(snapshot) {
  return {
    project_id: firstString(snapshot.routeScope?.projectId),
    intake_session_id: firstString(snapshot.routeScope?.intakeSessionId),
    session_id: firstString(snapshot.parityTargets?.discoverySessionId),
    idea_id: firstString(snapshot.parityTargets?.discoveryIdeaId),
  };
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

function buildExecutionAttentionKey(record) {
  if (record.type === "issue") {
    return `issue:${record.issue.id}`;
  }
  if (record.type === "approval") {
    return `approval:${record.approval.id}`;
  }
  return `runtime:${record.runtime.id}`;
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

function discoveryDecisionType(kind) {
  if (kind === "trace-review") return "trace_review_confirmed";
  if (kind === "handoff-ready") return "handoff_ready_confirmed";
  if (kind === "execution-followthrough") {
    return "execution_followthrough_confirmed";
  }
  return "authoring_review_confirmed";
}

function discoveryDecisionRationale(record) {
  if (record.kind === "authoring") {
    return "Live review playbook confirmed this dossier still needs authoring work before it should move forward.";
  }
  if (record.kind === "trace-review") {
    return "Live review playbook confirmed the latest discovery trace signals were reviewed in the unified shell.";
  }
  if (record.kind === "handoff-ready") {
    return "Live review playbook confirmed the dossier is ready for execution handoff review.";
  }
  return "Live review playbook confirmed execution-linked discovery follow-through is still the correct review stance.";
}

function discoveryDecisionMetadata(record) {
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
    operator_note: `Live review playbook (${preset}) confirmed this review record.`,
    route: "discovery_review",
    preset,
    source: "live-review-playbook",
  };
}

function buildPresetNeeds(activePreset) {
  return {
    discovery:
      activePreset === "discovery-pass" || activePreset === "chain-pass",
    issues: activePreset === "critical-pass" || activePreset === "chain-pass",
    approvals:
      activePreset === "decision-pass" || activePreset === "chain-pass",
    runtimes: activePreset === "decision-pass" || activePreset === "chain-pass",
  };
}

function matchesDiscoveryRecord(record, scope) {
  const ideaId = firstString(record?.dossier?.idea?.idea_id);
  const chainProjectId = firstString(record?.chain?.project?.id);
  const chainIntakeSessionId =
    firstString(record?.chain?.intakeSession?.id) ||
    firstString(record?.chain?.intakeSessionId);
  const linkedSessionIds = Array.isArray(record?.trace?.linkedSessionIds)
    ? record.trace.linkedSessionIds.map((item) => firstString(item))
    : [];

  if (scope.idea_id && ideaId === scope.idea_id) {
    return true;
  }
  if (scope.project_id && chainProjectId === scope.project_id) {
    return true;
  }
  if (
    scope.intake_session_id &&
    chainIntakeSessionId === scope.intake_session_id
  ) {
    return true;
  }
  if (scope.session_id && linkedSessionIds.includes(scope.session_id)) {
    return true;
  }
  return false;
}

function matchesExecutionRecord(record, scope) {
  const projectId = firstString(record?.source?.projectId);
  const intakeSessionId = firstString(
    record?.source?.intakeSession?.id ||
      (record?.source?.sourceKind === "intake_session"
        ? record?.source?.sourceExternalId
        : ""),
  );
  const discoveryIdeaId = firstString(record?.source?.discoveryIdeaId);

  if (scope.project_id && projectId === scope.project_id) {
    return true;
  }
  if (scope.intake_session_id && intakeSessionId === scope.intake_session_id) {
    return true;
  }
  if (scope.idea_id && discoveryIdeaId === scope.idea_id) {
    return true;
  }
  return false;
}

function summarizeSurfaceCounts(payloads) {
  const portfolioRecord = findPortfolioRecord(
    payloads.portfolio?.json?.records,
    payloads.projectId,
  );

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
    inboxDiscoveryOpenCount: getNestedCollectionLength(payloads.inbox, [
      "discoveryFeed",
      "items",
    ]),
    inboxIssueCount: getCollectionLength(payloads.inbox, "issues"),
    inboxApprovalCount: getCollectionLength(payloads.inbox, "approvals"),
    inboxRuntimeCount: getCollectionLength(payloads.inbox, "runtimes"),
    dashboardDiscoveryOpenCount: getNestedCollectionLength(payloads.dashboard, [
      "discoveryFeed",
      "items",
    ]),
    dashboardIssueCount: getCollectionLength(payloads.dashboard, "issues"),
    dashboardApprovalCount: getCollectionLength(
      payloads.dashboard,
      "approvals",
    ),
    dashboardRuntimeCount: getCollectionLength(payloads.dashboard, "runtimes"),
    portfolioAttentionTotal: portfolioRecord?.attention?.total ?? 0,
  };
}

async function resolveProjectId(scope, explicitTargets, needs) {
  const explicitProjectId =
    explicitTargets.execution?.issue?.projectId ||
    explicitTargets.execution?.approval?.projectId ||
    explicitTargets.execution?.runtime?.projectId ||
    scope.project_id;

  if (explicitProjectId) {
    return explicitProjectId;
  }

  if (!needs.issues && !needs.approvals && !needs.runtimes) {
    return "";
  }

  throw new Error(
    "Could not resolve a project_id for execution review playbook.",
  );
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

async function postDiscoveryConfirm(record) {
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
        rationale: discoveryDecisionRationale(record),
        actor: "founder",
        metadata: discoveryDecisionMetadata(record),
      }),
    },
  );

  assert(
    response.response.status === 200,
    `Discovery review confirm failed for ${record.dossier.idea.idea_id} with ${response.response.status}.`,
  );

  return response.json;
}

async function postExecutionIssueResolve(record) {
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
        note: `Live review playbook (${preset}) resolved this execution issue.`,
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

async function postExecutionApprovalApprove(record) {
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
        note: `Live review playbook (${preset}) approved this execution approval.`,
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

async function postExecutionRuntimeAllow(record) {
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
        note: `Live review playbook (${preset}) allowed this tool permission runtime.`,
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
  assert(
    String(
      response.json.runtime?.resolved_behavior ||
        response.json.runtime?.metadata?.pending?.resolved_behavior ||
        response.json.runtime?.outcome ||
        "",
    ) === "allow",
    `Execution runtime ${record.runtime.id} did not settle with allow semantics.`,
  );

  return { skipped: false };
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

  const parityTargetsSnapshot = await fetchJson(
    contract.liveRoutes.parityTargets,
  );
  assert(
    parityTargetsSnapshot.response.status === 200,
    "Shell parity target route must return 200.",
  );

  const discoveredScope = buildDiscoveredScope(parityTargetsSnapshot.json);
  const resolvedScope = mergeScope(explicitScope, discoveredScope);
  const explicitTargets = parseActionTargets(
    process.env.FOUNDEROS_REVIEW_ACTION_TARGETS_JSON || "",
  );
  const needs = buildPresetNeeds(preset);
  const projectId = await resolveProjectId(
    resolvedScope,
    explicitTargets,
    needs,
  );
  const discoveryIdeaId =
    explicitTargets.discovery?.ideaId || resolvedScope.idea_id || "";

  if (needs.discovery) {
    assert(
      discoveryIdeaId,
      "Could not resolve a discovery idea target for the review playbook.",
    );
  }

  const before = {
    reviewCenter: await fetchJson("/api/shell/review"),
    discoveryReview: await fetchJson("/api/shell/discovery/review"),
    executionReview: await fetchJson("/api/shell/execution/review"),
    inbox: await fetchJson("/api/shell/inbox"),
    dashboard: await fetchJson("/api/shell/dashboard"),
    portfolio: await fetchJson("/api/shell/portfolio"),
    issuesOpen: projectId
      ? await fetchJson(
          `/api/shell/execution/attention${buildQuery({
            kind: "issues",
            project_id: projectId,
            status: "open",
          })}`,
        )
      : null,
    issuesAll: projectId
      ? await fetchJson(
          `/api/shell/execution/attention${buildQuery({
            kind: "issues",
            project_id: projectId,
          })}`,
        )
      : null,
    approvalsPending: projectId
      ? await fetchJson(
          `/api/shell/execution/attention${buildQuery({
            kind: "approvals",
            project_id: projectId,
            status: "pending",
          })}`,
        )
      : null,
    approvalsAll: projectId
      ? await fetchJson(
          `/api/shell/execution/attention${buildQuery({
            kind: "approvals",
            project_id: projectId,
          })}`,
        )
      : null,
    runtimesPending: projectId
      ? await fetchJson(
          `/api/shell/execution/attention${buildQuery({
            kind: "runtimes",
            project_id: projectId,
            status: "pending",
          })}`,
        )
      : null,
    runtimesAll: projectId
      ? await fetchJson(
          `/api/shell/execution/attention${buildQuery({
            kind: "runtimes",
            project_id: projectId,
          })}`,
        )
      : null,
  };

  assert(
    before.reviewCenter.response.status === 200,
    "Failed to read review center.",
  );
  assert(
    before.discoveryReview.response.status === 200,
    "Failed to read discovery review surface.",
  );
  assert(
    before.executionReview.response.status === 200,
    "Failed to read execution review surface.",
  );
  assert(before.inbox.response.status === 200, "Failed to read inbox surface.");
  assert(
    before.dashboard.response.status === 200,
    "Failed to read dashboard surface.",
  );
  assert(
    before.portfolio.response.status === 200,
    "Failed to read portfolio surface.",
  );

  if (before.issuesOpen) {
    assert(
      before.issuesOpen.response.status === 200,
      "Failed to read execution issues.",
    );
    assert(
      before.approvalsPending?.response.status === 200,
      "Failed to read execution approvals.",
    );
    assert(
      before.runtimesPending?.response.status === 200,
      "Failed to read execution runtimes.",
    );
  }

  const scopedDiscoveryScope = {
    ...resolvedScope,
    idea_id: discoveryIdeaId || resolvedScope.idea_id,
    project_id: projectId || resolvedScope.project_id,
  };
  const discoveryRecords = (before.discoveryReview.json.records || []).filter(
    (record) =>
      scopedDiscoveryScope.idea_id
        ? firstString(record?.dossier?.idea?.idea_id) ===
          scopedDiscoveryScope.idea_id
        : matchesDiscoveryRecord(record, scopedDiscoveryScope),
  );
  const executionRecords = (before.executionReview.json.records || []).filter(
    (record) =>
      matchesExecutionRecord(record, {
        ...resolvedScope,
        idea_id: discoveryIdeaId || resolvedScope.idea_id,
        project_id: projectId || resolvedScope.project_id,
      }),
  );
  const issueRecords = executionRecords.filter(
    (record) => record.type === "issue",
  );
  const criticalIssueRecords = issueRecords.filter(
    (record) =>
      String(record.issue?.severity || "").toLowerCase() === "critical",
  );
  const approvalRecords = executionRecords.filter(
    (record) => record.type === "approval",
  );
  const runtimeRecords = executionRecords.filter(
    (record) => record.type === "runtime",
  );

  if (needs.discovery) {
    assert(
      discoveryRecords.length > 0,
      `No scoped discovery review records matched preset ${preset}.`,
    );
  }
  if (preset === "critical-pass") {
    assert(
      criticalIssueRecords.length > 0,
      "No scoped critical execution issues matched the critical-pass preset.",
    );
  } else if (needs.issues) {
    assert(
      issueRecords.length > 0,
      `No scoped execution issues matched preset ${preset}.`,
    );
  }
  if (needs.approvals) {
    assert(
      approvalRecords.length > 0,
      `No scoped execution approvals matched preset ${preset}.`,
    );
  }
  if (needs.runtimes) {
    assert(
      runtimeRecords.length > 0,
      `No scoped execution runtimes matched preset ${preset}.`,
    );
  }

  if (explicitTargets.execution?.issue?.issueId && issueRecords.length > 0) {
    assert(
      Boolean(
        findById(
          issueRecords.map((record) => record.issue),
          "id",
          explicitTargets.execution.issue.issueId,
        ),
      ),
      `Scoped issue selection does not include deterministic issue ${explicitTargets.execution.issue.issueId}.`,
    );
  }
  if (
    explicitTargets.execution?.approval?.approvalId &&
    approvalRecords.length > 0
  ) {
    assert(
      Boolean(
        findById(
          approvalRecords.map((record) => record.approval),
          "id",
          explicitTargets.execution.approval.approvalId,
        ),
      ),
      `Scoped approval selection does not include deterministic approval ${explicitTargets.execution.approval.approvalId}.`,
    );
  }
  if (
    explicitTargets.execution?.runtime?.runtimeId &&
    runtimeRecords.length > 0
  ) {
    assert(
      Boolean(
        findById(
          runtimeRecords.map((record) => record.runtime),
          "id",
          explicitTargets.execution.runtime.runtimeId,
        ),
      ),
      `Scoped runtime selection does not include deterministic runtime ${explicitTargets.execution.runtime.runtimeId}.`,
    );
  }

  const selectedDiscoveryRecords =
    preset === "discovery-pass" || preset === "chain-pass"
      ? discoveryRecords
      : [];
  const selectedIssueRecords =
    preset === "chain-pass"
      ? issueRecords
      : preset === "critical-pass"
        ? criticalIssueRecords
        : [];
  const selectedApprovalRecords =
    preset === "decision-pass" || preset === "chain-pass"
      ? approvalRecords
      : [];
  const selectedRuntimeRecords =
    preset === "decision-pass" || preset === "chain-pass" ? runtimeRecords : [];

  const beforeDossiers = new Map();
  for (const record of selectedDiscoveryRecords) {
    beforeDossiers.set(
      record.dossier.idea.idea_id,
      await loadDossierSnapshot(record.dossier.idea.idea_id),
    );
  }

  const beforePortfolioRecord = projectId
    ? findPortfolioRecord(before.portfolio.json.records, projectId)
    : null;

  if (
    projectId &&
    (selectedIssueRecords.length > 0 ||
      selectedApprovalRecords.length > 0 ||
      selectedRuntimeRecords.length > 0)
  ) {
    assert(
      beforePortfolioRecord,
      `Project ${projectId} is not present in the portfolio snapshot.`,
    );
  }

  for (const record of selectedDiscoveryRecords) {
    assert(
      findByKey(before.reviewCenter.json.discovery?.records, record.key),
      `Discovery review record ${record.key} is not present in the unified review snapshot before playbook execution.`,
    );
  }
  for (const record of selectedIssueRecords) {
    assert(
      findByKey(
        before.reviewCenter.json.execution?.records,
        buildExecutionAttentionKey(record),
      ),
      `Execution issue ${record.issue.id} is not present in the unified review snapshot before playbook execution.`,
    );
    assert(
      findByKey(
        before.executionReview.json.records,
        buildExecutionAttentionKey(record),
      ),
      `Execution issue ${record.issue.id} is not present in the execution review snapshot before playbook execution.`,
    );
  }
  for (const record of selectedApprovalRecords) {
    assert(
      findByKey(
        before.reviewCenter.json.execution?.records,
        buildExecutionAttentionKey(record),
      ),
      `Execution approval ${record.approval.id} is not present in the unified review snapshot before playbook execution.`,
    );
    assert(
      findByKey(
        before.executionReview.json.records,
        buildExecutionAttentionKey(record),
      ),
      `Execution approval ${record.approval.id} is not present in the execution review snapshot before playbook execution.`,
    );
  }
  for (const record of selectedRuntimeRecords) {
    assert(
      findByKey(
        before.reviewCenter.json.execution?.records,
        buildExecutionAttentionKey(record),
      ),
      `Execution runtime ${record.runtime.id} is not present in the unified review snapshot before playbook execution.`,
    );
    assert(
      findByKey(
        before.executionReview.json.records,
        buildExecutionAttentionKey(record),
      ),
      `Execution runtime ${record.runtime.id} is not present in the execution review snapshot before playbook execution.`,
    );
  }

  for (const record of selectedIssueRecords) {
    assert(
      findById(before.issuesOpen?.json?.issues || [], "id", record.issue.id),
      `Execution issue ${record.issue.id} is not present in the raw open issue feed before playbook execution.`,
    );
    assert(
      findById(before.inbox.json.issues || [], "id", record.issue.id),
      `Execution issue ${record.issue.id} is not present in the shell inbox snapshot before playbook execution.`,
    );
    assert(
      findById(before.dashboard.json.issues || [], "id", record.issue.id),
      `Execution issue ${record.issue.id} is not present in the shell dashboard snapshot before playbook execution.`,
    );
  }
  for (const record of selectedApprovalRecords) {
    assert(
      findById(
        before.approvalsPending?.json?.approvals || [],
        "id",
        record.approval.id,
      ),
      `Execution approval ${record.approval.id} is not present in the raw pending approval feed before playbook execution.`,
    );
    assert(
      findById(before.inbox.json.approvals || [], "id", record.approval.id),
      `Execution approval ${record.approval.id} is not present in the shell inbox snapshot before playbook execution.`,
    );
    assert(
      findById(before.dashboard.json.approvals || [], "id", record.approval.id),
      `Execution approval ${record.approval.id} is not present in the shell dashboard snapshot before playbook execution.`,
    );
  }
  for (const record of selectedRuntimeRecords) {
    assert(
      findById(
        before.runtimesPending?.json?.runtimes || [],
        "id",
        record.runtime.id,
      ),
      `Execution runtime ${record.runtime.id} is not present in the raw pending runtime feed before playbook execution.`,
    );
    assert(
      findById(before.inbox.json.runtimes || [], "id", record.runtime.id),
      `Execution runtime ${record.runtime.id} is not present in the shell inbox snapshot before playbook execution.`,
    );
    assert(
      findById(before.dashboard.json.runtimes || [], "id", record.runtime.id),
      `Execution runtime ${record.runtime.id} is not present in the shell dashboard snapshot before playbook execution.`,
    );
  }

  if (beforePortfolioRecord) {
    for (const record of selectedIssueRecords) {
      assert(
        findById(
          beforePortfolioRecord.attention?.issues || [],
          "id",
          record.issue.id,
        ),
        `Execution issue ${record.issue.id} is not present in the portfolio attention rollup before playbook execution.`,
      );
    }
    for (const record of selectedApprovalRecords) {
      assert(
        findById(
          beforePortfolioRecord.attention?.approvals || [],
          "id",
          record.approval.id,
        ),
        `Execution approval ${record.approval.id} is not present in the portfolio attention rollup before playbook execution.`,
      );
    }
    for (const record of selectedRuntimeRecords) {
      assert(
        findById(
          beforePortfolioRecord.attention?.runtimes || [],
          "id",
          record.runtime.id,
        ),
        `Execution runtime ${record.runtime.id} is not present in the portfolio attention rollup before playbook execution.`,
      );
    }
  }

  const processedDiscovery = [];
  const performedIssueIds = [];
  const performedApprovalIds = [];
  const performedRuntimeIds = [];
  for (const record of selectedDiscoveryRecords) {
    processedDiscovery.push({
      key: record.key,
      kind: record.kind,
      ideaId: record.dossier.idea.idea_id,
      decision: await postDiscoveryConfirm(record),
    });
  }
  for (const record of selectedIssueRecords) {
    const result = await postExecutionIssueResolve(record);
    if (!result.skipped) {
      performedIssueIds.push(record.issue.id);
    }
  }
  for (const record of selectedApprovalRecords) {
    const result = await postExecutionApprovalApprove(record);
    if (!result.skipped) {
      performedApprovalIds.push(record.approval.id);
    }
  }
  for (const record of selectedRuntimeRecords) {
    const result = await postExecutionRuntimeAllow(record);
    if (!result.skipped) {
      performedRuntimeIds.push(record.runtime.id);
    }
  }

  const after = {
    reviewCenter: await fetchJson("/api/shell/review"),
    discoveryReview: await fetchJson("/api/shell/discovery/review"),
    executionReview: await fetchJson("/api/shell/execution/review"),
    inbox: await fetchJson("/api/shell/inbox"),
    dashboard: await fetchJson("/api/shell/dashboard"),
    portfolio: await fetchJson("/api/shell/portfolio"),
    issuesOpen: projectId
      ? await fetchJson(
          `/api/shell/execution/attention${buildQuery({
            kind: "issues",
            project_id: projectId,
            status: "open",
          })}`,
        )
      : null,
    issuesAll: projectId
      ? await fetchJson(
          `/api/shell/execution/attention${buildQuery({
            kind: "issues",
            project_id: projectId,
          })}`,
        )
      : null,
    approvalsPending: projectId
      ? await fetchJson(
          `/api/shell/execution/attention${buildQuery({
            kind: "approvals",
            project_id: projectId,
            status: "pending",
          })}`,
        )
      : null,
    approvalsAll: projectId
      ? await fetchJson(
          `/api/shell/execution/attention${buildQuery({
            kind: "approvals",
            project_id: projectId,
          })}`,
        )
      : null,
    runtimesPending: projectId
      ? await fetchJson(
          `/api/shell/execution/attention${buildQuery({
            kind: "runtimes",
            project_id: projectId,
            status: "pending",
          })}`,
        )
      : null,
    runtimesAll: projectId
      ? await fetchJson(
          `/api/shell/execution/attention${buildQuery({
            kind: "runtimes",
            project_id: projectId,
          })}`,
        )
      : null,
  };

  const afterPortfolioRecord = projectId
    ? findPortfolioRecord(after.portfolio.json.records, projectId)
    : null;
  const performedRuntimeIdSet = new Set(performedRuntimeIds);

  for (const record of selectedDiscoveryRecords) {
    const beforeDossierPayload = beforeDossiers.get(
      record.dossier.idea.idea_id,
    );
    const beforeDossier = beforeDossierPayload.json.dossier;
    const afterDossierPayload = await loadDossierSnapshot(
      record.dossier.idea.idea_id,
    );
    const afterDossier = afterDossierPayload.json.dossier;
    const beforeDecisionIds = new Set(
      (beforeDossier.decisions || []).map((decision) => decision.decision_id),
    );
    const expectedDecisionType = discoveryDecisionType(record.kind);
    const createdDecision =
      (afterDossier.decisions || []).find(
        (decision) =>
          !beforeDecisionIds.has(decision.decision_id) &&
          decision.decision_type === expectedDecisionType &&
          String(decision.metadata?.route || "") === "discovery_review" &&
          String(decision.metadata?.preset || "") === preset,
      ) ?? null;

    assert(
      createdDecision,
      `Discovery playbook did not append a new ${expectedDecisionType} decision for ${record.dossier.idea.idea_id}.`,
    );
  }

  for (const record of selectedIssueRecords) {
    assert(
      !findById(after.issuesOpen?.json?.issues || [], "id", record.issue.id),
      `Execution issue ${record.issue.id} still appears in the raw open issue feed after the playbook.`,
    );
    assert(
      findById(after.issuesAll?.json?.issues || [], "id", record.issue.id)
        ?.status === "resolved",
      `Execution issue ${record.issue.id} is missing from the all-issues feed with resolved status after the playbook.`,
    );
    assert(
      !findById(after.inbox.json.issues || [], "id", record.issue.id),
      `Execution issue ${record.issue.id} still appears in the shell inbox snapshot after the playbook.`,
    );
    assert(
      !findById(after.dashboard.json.issues || [], "id", record.issue.id),
      `Execution issue ${record.issue.id} still appears in the shell dashboard snapshot after the playbook.`,
    );
    assert(
      !findByKey(
        after.reviewCenter.json.execution?.records,
        buildExecutionAttentionKey(record),
      ),
      `Execution issue ${record.issue.id} still appears in the unified review snapshot after the playbook.`,
    );
    assert(
      !findByKey(
        after.executionReview.json.records,
        buildExecutionAttentionKey(record),
      ),
      `Execution issue ${record.issue.id} still appears in the execution review snapshot after the playbook.`,
    );
  }

  for (const record of selectedApprovalRecords) {
    assert(
      !findById(
        after.approvalsPending?.json?.approvals || [],
        "id",
        record.approval.id,
      ),
      `Execution approval ${record.approval.id} still appears in the raw pending approvals feed after the playbook.`,
    );
    assert(
      findById(
        after.approvalsAll?.json?.approvals || [],
        "id",
        record.approval.id,
      )?.status === "approved",
      `Execution approval ${record.approval.id} is missing from the all-approvals feed with approved status after the playbook.`,
    );
    assert(
      !findById(after.inbox.json.approvals || [], "id", record.approval.id),
      `Execution approval ${record.approval.id} still appears in the shell inbox snapshot after the playbook.`,
    );
    assert(
      !findById(after.dashboard.json.approvals || [], "id", record.approval.id),
      `Execution approval ${record.approval.id} still appears in the shell dashboard snapshot after the playbook.`,
    );
    assert(
      !findByKey(
        after.reviewCenter.json.execution?.records,
        buildExecutionAttentionKey(record),
      ),
      `Execution approval ${record.approval.id} still appears in the unified review snapshot after the playbook.`,
    );
    assert(
      !findByKey(
        after.executionReview.json.records,
        buildExecutionAttentionKey(record),
      ),
      `Execution approval ${record.approval.id} still appears in the execution review snapshot after the playbook.`,
    );
  }

  for (const record of selectedRuntimeRecords) {
    assert(
      !findById(
        after.runtimesPending?.json?.runtimes || [],
        "id",
        record.runtime.id,
      ),
      `Execution runtime ${record.runtime.id} still appears in the raw pending runtime feed after the playbook.`,
    );
    const resolvedRuntime = findById(
      after.runtimesAll?.json?.runtimes || [],
      "id",
      record.runtime.id,
    );
    assert(
      resolvedRuntime?.status === "resolved",
      `Execution runtime ${record.runtime.id} is missing from the all-runtimes feed with resolved status after the playbook.`,
    );
    if (performedRuntimeIdSet.has(record.runtime.id)) {
      assert(
        String(
          resolvedRuntime?.resolved_behavior ||
            resolvedRuntime?.metadata?.pending?.resolved_behavior ||
            resolvedRuntime?.outcome ||
            "",
        ) === "allow",
        `Execution runtime ${record.runtime.id} is not marked as allowed in the stored runtime feed after the playbook.`,
      );
    }
    assert(
      !findById(after.inbox.json.runtimes || [], "id", record.runtime.id),
      `Execution runtime ${record.runtime.id} still appears in the shell inbox snapshot after the playbook.`,
    );
    assert(
      !findById(after.dashboard.json.runtimes || [], "id", record.runtime.id),
      `Execution runtime ${record.runtime.id} still appears in the shell dashboard snapshot after the playbook.`,
    );
    assert(
      !findByKey(
        after.reviewCenter.json.execution?.records,
        buildExecutionAttentionKey(record),
      ),
      `Execution runtime ${record.runtime.id} still appears in the unified review snapshot after the playbook.`,
    );
    assert(
      !findByKey(
        after.executionReview.json.records,
        buildExecutionAttentionKey(record),
      ),
      `Execution runtime ${record.runtime.id} still appears in the execution review snapshot after the playbook.`,
    );
  }

  if (afterPortfolioRecord) {
    for (const record of selectedIssueRecords) {
      assert(
        !findById(
          afterPortfolioRecord.attention?.issues || [],
          "id",
          record.issue.id,
        ),
        `Execution issue ${record.issue.id} still appears in the portfolio attention rollup after the playbook.`,
      );
    }
    for (const record of selectedApprovalRecords) {
      assert(
        !findById(
          afterPortfolioRecord.attention?.approvals || [],
          "id",
          record.approval.id,
        ),
        `Execution approval ${record.approval.id} still appears in the portfolio attention rollup after the playbook.`,
      );
    }
    for (const record of selectedRuntimeRecords) {
      assert(
        !findById(
          afterPortfolioRecord.attention?.runtimes || [],
          "id",
          record.runtime.id,
        ),
        `Execution runtime ${record.runtime.id} still appears in the portfolio attention rollup after the playbook.`,
      );
    }

    const expectedAttentionDrop =
      selectedIssueRecords.length +
      selectedApprovalRecords.length +
      selectedRuntimeRecords.length;
    if (expectedAttentionDrop > 0) {
      assert(
        (afterPortfolioRecord.attention?.total ?? 0) <=
          (beforePortfolioRecord?.attention?.total ?? 0) -
            expectedAttentionDrop,
        "Portfolio chain attention total did not drop after the review playbook.",
      );
    }
  }

  console.log(
    JSON.stringify({
      status: "ok",
      preset,
      baseUrl,
      scope: {
        ...resolvedScope,
        project_id: projectId || resolvedScope.project_id,
        idea_id: discoveryIdeaId || resolvedScope.idea_id,
      },
      selected: {
        discoveryKeys: selectedDiscoveryRecords.map((record) => record.key),
        issueIds: selectedIssueRecords.map((record) => record.issue.id),
        approvalIds: selectedApprovalRecords.map(
          (record) => record.approval.id,
        ),
        runtimeIds: selectedRuntimeRecords.map((record) => record.runtime.id),
      },
      processed: {
        discoveryConfirmCount: processedDiscovery.length,
        issueResolveCount: performedIssueIds.length,
        approvalApproveCount: performedApprovalIds.length,
        runtimeAllowCount: performedRuntimeIds.length,
      },
      surfacesBefore: summarizeSurfaceCounts({
        ...before,
        projectId,
      }),
      surfacesAfter: summarizeSurfaceCounts({
        ...after,
        projectId,
      }),
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
