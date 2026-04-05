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
    "Missing production build for @founderos/web. Run `npm run build --workspace @founderos/web` first."
  );
  process.exit(1);
}

const host = process.env.FOUNDEROS_WEB_HOST ?? "127.0.0.1";
const port =
  process.env.FOUNDEROS_WEB_PORT ??
  String(3940 + Math.floor(Math.random() * 100));
const baseUrl = externalBaseUrl || `http://${host}:${port}`;
const SUITE_TARGET_KEYS = [
  "discovery-pass",
  "critical-pass",
  "decision-pass",
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
    executionReviewCount: getCollectionLength(payloads.executionReview, "records"),
    inboxIssueCount: getCollectionLength(payloads.inbox, "issues"),
    inboxApprovalCount: getCollectionLength(payloads.inbox, "approvals"),
    inboxRuntimeCount: getCollectionLength(payloads.inbox, "runtimes"),
    dashboardIssueCount: getCollectionLength(payloads.dashboard, "issues"),
    dashboardApprovalCount: getCollectionLength(payloads.dashboard, "approvals"),
    dashboardRuntimeCount: getCollectionLength(payloads.dashboard, "runtimes"),
  };
}

function parseSuiteTargets(rawValue) {
  const trimmed = (rawValue || "").trim();
  if (!trimmed) {
    throw new Error(
      "FOUNDEROS_REVIEW_SUITE_TARGETS_JSON is required for review-pressure live checks."
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    throw new Error(
      `FOUNDEROS_REVIEW_SUITE_TARGETS_JSON must contain valid JSON. ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  const normalized = {};
  for (const preset of SUITE_TARGET_KEYS) {
    const target = parsed?.[preset];
    assert(target && typeof target === "object", `Missing suite target for ${preset}.`);
    normalized[preset] = {
      preset,
      role: firstString(target.role),
      scenario: firstString(target.scenario),
      routeScope: {
        projectId: firstString(target.routeScope?.projectId),
        intakeSessionId: firstString(target.routeScope?.intakeSessionId),
      },
      parityTargets: {
        discoverySessionId: firstString(target.parityTargets?.discoverySessionId),
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
    chain?.intakeSession?.id || chain?.intakeSessionId
  );

  if (scope.projectId && chainProjectId !== scope.projectId) {
    return false;
  }

  if (scope.intakeSessionId && chainIntakeSessionId !== scope.intakeSessionId) {
    return false;
  }

  return true;
}

function matchesDiscoveryLane(record, lane) {
  if (lane === "authoring") return record.kind === "authoring";
  if (lane === "trace") return record.kind === "trace-review";
  if (lane === "handoff") return record.kind === "handoff-ready";
  if (lane === "followthrough") return record.kind === "execution-followthrough";
  if (lane === "linked") return Boolean(record.chain);
  return false;
}

function matchesExecutionHotspotRecord(record, chain) {
  if (chain?.project?.id && record.source?.projectId === chain.project.id) {
    return true;
  }
  if (
    chain?.intakeSessionId &&
    record.source?.sourceKind === "intake_session" &&
    record.source?.sourceExternalId === chain.intakeSessionId
  ) {
    return true;
  }
  return Boolean(chain?.briefId) && record.source?.briefId === chain.briefId;
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
      // Keep polling until timeout.
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }

  throw new Error(`Timed out waiting for shell server at ${url}.`);
}

async function fetchJson(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  return {
    response,
    json: payload,
  };
}

async function loadDossierSnapshot(ideaId) {
  const payload = await fetchJson(
    `/api/shell/discovery/ideas${buildQuery({
      ideaId,
      limit: 50,
    })}`
  );
  assert(
    payload.response.status === 200,
    `Failed to load discovery dossier for ${ideaId}.`
  );
  assert(
    payload.json?.dossier?.idea?.idea_id === ideaId,
    `Shell discovery dossier snapshot did not resolve ${ideaId}.`
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
  return `Live review pressure check (${stepLabel}) confirmed this ${record.kind} record through overview triage.`;
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
    operator_note: `Live review pressure check (${stepLabel}) confirmed this record.`,
    route: "review_pressure",
    source: "live-review-pressure-actions",
    step: stepLabel,
  };
}

async function postDiscoveryConfirm(record, stepLabel) {
  const response = await fetchJson(
    `/api/shell/discovery/actions/orchestrate/discovery/ideas/${encodeURIComponent(
      record.dossier.idea.idea_id
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
    }
  );

  assert(
    response.response.status === 200,
    `Discovery review confirm failed for ${record.dossier.idea.idea_id} with ${response.response.status}.`
  );

  return response.json;
}

async function postExecutionIssueResolve(record, stepLabel) {
  const response = await fetchJson(
    `/api/shell/execution/actions/execution-plane/issues/${encodeURIComponent(
      record.issue.id
    )}/resolve`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actor: "founderos-shell",
        note: `Live review pressure check (${stepLabel}) resolved this execution issue.`,
      }),
    }
  );

  if (response.response.status === 409) {
    return { skipped: true };
  }

  assert(
    response.response.status === 200,
    `Execution issue resolve failed for ${record.issue.id} with ${response.response.status}.`
  );
  assert(
    response.json.issue?.status === "resolved",
    `Execution issue ${record.issue.id} did not resolve.`
  );

  return { skipped: false };
}

async function postExecutionApprovalApprove(record, stepLabel) {
  const response = await fetchJson(
    `/api/shell/execution/actions/execution-plane/approvals/${encodeURIComponent(
      record.approval.id
    )}/approve`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actor: "founderos-shell",
        note: `Live review pressure check (${stepLabel}) approved this execution approval.`,
      }),
    }
  );

  if (response.response.status === 409) {
    return { skipped: true };
  }

  assert(
    response.response.status === 200,
    `Execution approval approve failed for ${record.approval.id} with ${response.response.status}.`
  );
  assert(
    response.json.approval?.status === "approved",
    `Execution approval ${record.approval.id} did not transition to approved.`
  );

  return { skipped: false };
}

async function postExecutionRuntimeAllow(record, stepLabel) {
  const response = await fetchJson(
    `/api/shell/execution/actions/execution-plane/tool-permission-runtimes/${encodeURIComponent(
      record.runtime.id
    )}/allow`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actor: "founderos-shell",
        note: `Live review pressure check (${stepLabel}) allowed this tool permission runtime.`,
        source: "user",
      }),
    }
  );

  if (response.response.status === 409) {
    return { skipped: true };
  }

  assert(
    response.response.status === 200,
    `Execution runtime allow failed for ${record.runtime.id} with ${response.response.status}.`
  );
  assert(
    response.json.runtime?.status === "resolved",
    `Execution runtime ${record.runtime.id} did not resolve.`
  );

  return { skipped: false };
}

async function loadGlobalSurfaces() {
  const payloads = {
    reviewCenter: await fetchJson("/api/shell/review"),
    executionReview: await fetchJson("/api/shell/execution/review"),
    inbox: await fetchJson("/api/shell/inbox"),
    dashboard: await fetchJson("/api/shell/dashboard"),
    portfolio: await fetchJson("/api/shell/portfolio"),
  };

  assert(payloads.reviewCenter.response.status === 200, "Failed to read review center.");
  assert(
    payloads.executionReview.response.status === 200,
    "Failed to read execution review surface."
  );
  assert(payloads.inbox.response.status === 200, "Failed to read inbox surface.");
  assert(payloads.dashboard.response.status === 200, "Failed to read dashboard surface.");
  assert(payloads.portfolio.response.status === 200, "Failed to read portfolio surface.");

  return payloads;
}

async function loadExecutionFeeds(projectId) {
  assert(projectId, "Project id is required for execution feed checks.");
  const issuesOpen = await fetchJson(
    `/api/shell/execution/attention${buildQuery({
      kind: "issues",
      project_id: projectId,
      status: "open",
    })}`
  );
  const issuesAll = await fetchJson(
    `/api/shell/execution/attention${buildQuery({
      kind: "issues",
      project_id: projectId,
    })}`
  );
  const approvalsPending = await fetchJson(
    `/api/shell/execution/attention${buildQuery({
      kind: "approvals",
      project_id: projectId,
      status: "pending",
    })}`
  );
  const approvalsAll = await fetchJson(
    `/api/shell/execution/attention${buildQuery({
      kind: "approvals",
      project_id: projectId,
    })}`
  );
  const runtimesPending = await fetchJson(
    `/api/shell/execution/attention${buildQuery({
      kind: "runtimes",
      project_id: projectId,
      status: "pending",
    })}`
  );
  const runtimesAll = await fetchJson(
    `/api/shell/execution/attention${buildQuery({
      kind: "runtimes",
      project_id: projectId,
    })}`
  );

  assert(issuesOpen.response.status === 200, `Failed to read issues for ${projectId}.`);
  assert(
    approvalsPending.response.status === 200,
    `Failed to read approvals for ${projectId}.`
  );
  assert(
    runtimesPending.response.status === 200,
    `Failed to read runtimes for ${projectId}.`
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

function selectDashboardLinkedDiscoveryLane(snapshot, target) {
  return (snapshot.dashboard.json.reviewCenter?.discovery?.records || []).filter(
    (record) =>
      Boolean(record.chain) &&
      matchesChainScope(record.chain, target.routeScope) &&
      matchesDiscoveryLane(record, "linked")
  );
}

function selectPortfolioCriticalHotspotIssues(snapshot, target) {
  const chain = findPortfolioRecord(
    snapshot.portfolio.json.records,
    target.routeScope.projectId
  );
  assert(
    chain,
    `Portfolio hotspot chain did not resolve project ${target.routeScope.projectId}.`
  );

  const records = (snapshot.portfolio.json.reviewCenter?.execution?.records || [])
    .filter((record) => matchesExecutionHotspotRecord(record, chain))
    .filter((record) => record.type === "issue");

  return {
    chain,
    records,
  };
}

function selectPortfolioDecisionHotspot(snapshot, target) {
  const chain = findPortfolioRecord(
    snapshot.portfolio.json.records,
    target.routeScope.projectId
  );
  assert(
    chain,
    `Portfolio hotspot chain did not resolve project ${target.routeScope.projectId}.`
  );

  const records = (snapshot.portfolio.json.reviewCenter?.execution?.records || []).filter(
    (record) => matchesExecutionHotspotRecord(record, chain)
  );

  return {
    chain,
    approvals: records.filter((record) => record.type === "approval"),
    runtimes: records.filter((record) => record.type === "runtime"),
  };
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
    process.env.FOUNDEROS_REVIEW_SUITE_TARGETS_JSON || ""
  );

  const before = await loadGlobalSurfaces();
  const criticalProjectId = suiteTargets["critical-pass"].routeScope.projectId;
  const decisionProjectId = suiteTargets["decision-pass"].routeScope.projectId;

  const dashboardDiscoveryRecords = selectDashboardLinkedDiscoveryLane(
    before,
    suiteTargets["discovery-pass"]
  );
  const portfolioCritical = selectPortfolioCriticalHotspotIssues(
    before,
    suiteTargets["critical-pass"]
  );
  const portfolioDecision = selectPortfolioDecisionHotspot(
    before,
    suiteTargets["decision-pass"]
  );

  assert(
    dashboardDiscoveryRecords.length > 0,
    "Dashboard linked lane did not expose any discovery records."
  );
  assert(
    portfolioCritical.records.length > 0,
    "Portfolio critical hotspot did not expose any issue records."
  );
  assert(
    portfolioDecision.approvals.length > 0,
    "Portfolio decision hotspot did not expose any approval records."
  );
  assert(
    portfolioDecision.runtimes.length > 0,
    "Portfolio decision hotspot did not expose any runtime records."
  );

  const deterministicCriticalIssueId = firstString(
    suiteTargets["critical-pass"].actionTargets?.execution?.issue?.issueId
  );
  const deterministicDecisionApprovalId = firstString(
    suiteTargets["decision-pass"].actionTargets?.execution?.approval?.approvalId
  );
  const deterministicDecisionRuntimeId = firstString(
    suiteTargets["decision-pass"].actionTargets?.execution?.runtime?.runtimeId
  );

  if (deterministicCriticalIssueId) {
    assert(
      Boolean(
        findById(
          portfolioCritical.records.map((record) => record.issue),
          "id",
          deterministicCriticalIssueId
        )
      ),
      `Portfolio hotspot issue selection does not include deterministic issue ${deterministicCriticalIssueId}.`
    );
  }
  if (deterministicDecisionApprovalId) {
    assert(
      Boolean(
        findById(
          portfolioDecision.approvals.map((record) => record.approval),
          "id",
          deterministicDecisionApprovalId
        )
      ),
      `Portfolio hotspot approval selection does not include deterministic approval ${deterministicDecisionApprovalId}.`
    );
  }
  if (deterministicDecisionRuntimeId) {
    assert(
      Boolean(
        findById(
          portfolioDecision.runtimes.map((record) => record.runtime),
          "id",
          deterministicDecisionRuntimeId
        )
      ),
      `Portfolio hotspot runtime selection does not include deterministic runtime ${deterministicDecisionRuntimeId}.`
    );
  }

  const discoveryRecordsByIdeaId = new Map();
  for (const record of dashboardDiscoveryRecords) {
    const ideaId = record.dossier.idea.idea_id;
    if (!discoveryRecordsByIdeaId.has(ideaId)) {
      discoveryRecordsByIdeaId.set(ideaId, await loadDossierSnapshot(ideaId));
    }
  }

  const processedDiscoveryKeys = [];
  for (const record of dashboardDiscoveryRecords) {
    await postDiscoveryConfirm(record, "dashboard-linked-lane");
    processedDiscoveryKeys.push(record.key);
  }

  const processedIssueIds = [];
  for (const record of portfolioCritical.records) {
    const result = await postExecutionIssueResolve(
      record,
      "portfolio-critical-hotspot"
    );
    if (!result.skipped) {
      processedIssueIds.push(record.issue.id);
    }
  }

  const processedApprovalIds = [];
  for (const record of portfolioDecision.approvals) {
    const result = await postExecutionApprovalApprove(
      record,
      "portfolio-decision-hotspot"
    );
    if (!result.skipped) {
      processedApprovalIds.push(record.approval.id);
    }
  }

  const processedRuntimeIds = [];
  for (const record of portfolioDecision.runtimes) {
    const result = await postExecutionRuntimeAllow(
      record,
      "portfolio-decision-hotspot"
    );
    if (!result.skipped) {
      processedRuntimeIds.push(record.runtime.id);
    }
  }

  const after = await loadGlobalSurfaces();
  const afterCriticalFeeds = await loadExecutionFeeds(criticalProjectId);
  const afterDecisionFeeds = await loadExecutionFeeds(decisionProjectId);

  for (const [ideaId, beforeDossierPayload] of discoveryRecordsByIdeaId.entries()) {
    const beforeDecisionIds = new Set(
      (beforeDossierPayload.json.dossier?.decisions || []).map(
        (decision) => decision.decision_id
      )
    );
    const afterDossierPayload = await loadDossierSnapshot(ideaId);
    const afterDossier = afterDossierPayload.json.dossier;
    const relatedRecords = dashboardDiscoveryRecords.filter(
      (record) => record.dossier.idea.idea_id === ideaId
    );

    for (const record of relatedRecords) {
      const createdDecision =
        (afterDossier.decisions || []).find(
          (decision) =>
            !beforeDecisionIds.has(decision.decision_id) &&
            decision.decision_type === discoveryDecisionType(record.kind) &&
            String(decision.metadata?.source || "") === "live-review-pressure-actions" &&
            String(decision.metadata?.step || "") === "dashboard-linked-lane"
        ) ?? null;

      assert(
        createdDecision,
        `Dashboard review-pressure lane did not append a new ${discoveryDecisionType(record.kind)} decision for ${ideaId}.`
      );
    }
  }

  const beforeCriticalPortfolioRecord = findPortfolioRecord(
    before.portfolio.json.records,
    criticalProjectId
  );
  const afterCriticalPortfolioRecord = findPortfolioRecord(
    after.portfolio.json.records,
    criticalProjectId
  );
  const beforeDecisionPortfolioRecord = findPortfolioRecord(
    before.portfolio.json.records,
    decisionProjectId
  );
  const afterDecisionPortfolioRecord = findPortfolioRecord(
    after.portfolio.json.records,
    decisionProjectId
  );
  const processedRuntimeIdSet = new Set(processedRuntimeIds);

  for (const record of portfolioCritical.records) {
    assert(
      !findById(afterCriticalFeeds.issuesOpen.json.issues || [], "id", record.issue.id),
      `Execution issue ${record.issue.id} still appears in the raw open issue feed after portfolio hotspot triage.`
    );
    assert(
      findById(afterCriticalFeeds.issuesAll.json.issues || [], "id", record.issue.id)
        ?.status === "resolved",
      `Execution issue ${record.issue.id} is missing from the all-issues feed with resolved status after portfolio hotspot triage.`
    );
    assert(
      !findById(after.inbox.json.issues || [], "id", record.issue.id),
      `Execution issue ${record.issue.id} still appears in the shell inbox snapshot after portfolio hotspot triage.`
    );
    assert(
      !findById(after.dashboard.json.issues || [], "id", record.issue.id),
      `Execution issue ${record.issue.id} still appears in the shell dashboard snapshot after portfolio hotspot triage.`
    );
    assert(
      !findByKey(after.reviewCenter.json.execution?.records, buildExecutionAttentionKey(record)),
      `Execution issue ${record.issue.id} still appears in the unified review snapshot after portfolio hotspot triage.`
    );
    assert(
      !findByKey(after.executionReview.json.records, buildExecutionAttentionKey(record)),
      `Execution issue ${record.issue.id} still appears in the execution review snapshot after portfolio hotspot triage.`
    );
    assert(
      !findById(afterCriticalPortfolioRecord?.attention?.issues || [], "id", record.issue.id),
      `Execution issue ${record.issue.id} still appears in the portfolio attention rollup after portfolio hotspot triage.`
    );
  }

  for (const record of portfolioDecision.approvals) {
    assert(
      !findById(
        afterDecisionFeeds.approvalsPending.json.approvals || [],
        "id",
        record.approval.id
      ),
      `Execution approval ${record.approval.id} still appears in the raw pending approval feed after portfolio hotspot triage.`
    );
    assert(
      findById(afterDecisionFeeds.approvalsAll.json.approvals || [], "id", record.approval.id)
        ?.status === "approved",
      `Execution approval ${record.approval.id} is missing from the all-approvals feed with approved status after portfolio hotspot triage.`
    );
    assert(
      !findById(after.inbox.json.approvals || [], "id", record.approval.id),
      `Execution approval ${record.approval.id} still appears in the shell inbox snapshot after portfolio hotspot triage.`
    );
    assert(
      !findById(after.dashboard.json.approvals || [], "id", record.approval.id),
      `Execution approval ${record.approval.id} still appears in the shell dashboard snapshot after portfolio hotspot triage.`
    );
    assert(
      !findByKey(after.reviewCenter.json.execution?.records, buildExecutionAttentionKey(record)),
      `Execution approval ${record.approval.id} still appears in the unified review snapshot after portfolio hotspot triage.`
    );
    assert(
      !findByKey(after.executionReview.json.records, buildExecutionAttentionKey(record)),
      `Execution approval ${record.approval.id} still appears in the execution review snapshot after portfolio hotspot triage.`
    );
    assert(
      !findById(
        afterDecisionPortfolioRecord?.attention?.approvals || [],
        "id",
        record.approval.id
      ),
      `Execution approval ${record.approval.id} still appears in the portfolio attention rollup after portfolio hotspot triage.`
    );
  }

  for (const record of portfolioDecision.runtimes) {
    assert(
      !findById(
        afterDecisionFeeds.runtimesPending.json.runtimes || [],
        "id",
        record.runtime.id
      ),
      `Execution runtime ${record.runtime.id} still appears in the raw pending runtime feed after portfolio hotspot triage.`
    );
    const resolvedRuntime = findById(
      afterDecisionFeeds.runtimesAll.json.runtimes || [],
      "id",
      record.runtime.id
    );
    assert(
      resolvedRuntime?.status === "resolved",
      `Execution runtime ${record.runtime.id} is missing from the all-runtimes feed with resolved status after portfolio hotspot triage.`
    );
    if (processedRuntimeIdSet.has(record.runtime.id)) {
      assert(
        String(
          resolvedRuntime?.resolved_behavior ||
            resolvedRuntime?.metadata?.pending?.resolved_behavior ||
            resolvedRuntime?.outcome ||
            ""
        ) === "allow",
        `Execution runtime ${record.runtime.id} is not marked as allowed after portfolio hotspot triage.`
      );
    }
    assert(
      !findById(after.inbox.json.runtimes || [], "id", record.runtime.id),
      `Execution runtime ${record.runtime.id} still appears in the shell inbox snapshot after portfolio hotspot triage.`
    );
    assert(
      !findById(after.dashboard.json.runtimes || [], "id", record.runtime.id),
      `Execution runtime ${record.runtime.id} still appears in the shell dashboard snapshot after portfolio hotspot triage.`
    );
    assert(
      !findByKey(after.reviewCenter.json.execution?.records, buildExecutionAttentionKey(record)),
      `Execution runtime ${record.runtime.id} still appears in the unified review snapshot after portfolio hotspot triage.`
    );
    assert(
      !findByKey(after.executionReview.json.records, buildExecutionAttentionKey(record)),
      `Execution runtime ${record.runtime.id} still appears in the execution review snapshot after portfolio hotspot triage.`
    );
    assert(
      !findById(
        afterDecisionPortfolioRecord?.attention?.runtimes || [],
        "id",
        record.runtime.id
      ),
      `Execution runtime ${record.runtime.id} still appears in the portfolio attention rollup after portfolio hotspot triage.`
    );
  }

  if (beforeCriticalPortfolioRecord && afterCriticalPortfolioRecord) {
    assert(
      (afterCriticalPortfolioRecord.attention?.total ?? 0) <=
        (beforeCriticalPortfolioRecord.attention?.total ?? 0) -
          processedIssueIds.length,
      "Critical chain portfolio attention total did not drop after hotspot issue triage."
    );
  }

  if (beforeDecisionPortfolioRecord && afterDecisionPortfolioRecord) {
    assert(
      (afterDecisionPortfolioRecord.attention?.total ?? 0) <=
        (beforeDecisionPortfolioRecord.attention?.total ?? 0) -
          (processedApprovalIds.length + processedRuntimeIds.length),
      "Decision chain portfolio attention total did not drop after hotspot decision triage."
    );
  }

  console.log(
    JSON.stringify({
      status: "ok",
      baseUrl,
      actions: {
        dashboardLinkedLane: {
          role: suiteTargets["discovery-pass"].role,
          scenario: suiteTargets["discovery-pass"].scenario,
          routeScope: suiteTargets["discovery-pass"].routeScope,
          selectedDiscoveryKeys: dashboardDiscoveryRecords.map((record) => record.key),
        },
        portfolioCriticalHotspot: {
          role: suiteTargets["critical-pass"].role,
          scenario: suiteTargets["critical-pass"].scenario,
          routeScope: suiteTargets["critical-pass"].routeScope,
          chainKey: firstString(portfolioCritical.chain?.key),
          selectedIssueIds: portfolioCritical.records.map((record) => record.issue.id),
        },
        portfolioDecisionHotspot: {
          role: suiteTargets["decision-pass"].role,
          scenario: suiteTargets["decision-pass"].scenario,
          routeScope: suiteTargets["decision-pass"].routeScope,
          chainKey: firstString(portfolioDecision.chain?.key),
          selectedApprovalIds: portfolioDecision.approvals.map(
            (record) => record.approval.id
          ),
          selectedRuntimeIds: portfolioDecision.runtimes.map(
            (record) => record.runtime.id
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
    })
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
