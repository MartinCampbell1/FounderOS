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

const port =
  process.env.FOUNDEROS_WEB_PORT ??
  String(3890 + Math.floor(Math.random() * 100));
const host = process.env.FOUNDEROS_WEB_HOST ?? "127.0.0.1";
const baseUrl = externalBaseUrl || `http://${host}:${port}`;

const explicitScope = {
  project_id: (process.env.FOUNDEROS_PARITY_PROJECT_ID || "").trim(),
  intake_session_id: (process.env.FOUNDEROS_PARITY_INTAKE_SESSION_ID || "").trim(),
  session_id: (process.env.FOUNDEROS_PARITY_DISCOVERY_SESSION_ID || "").trim(),
  idea_id: (process.env.FOUNDEROS_PARITY_DISCOVERY_IDEA_ID || "").trim(),
};

const discoveryActionKindPriority = [
  "handoff_review",
  "simulation_review",
  "debate_review",
  "idea_review",
  "refresh_review",
  "daily_digest",
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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
      }`
    );
  }

  return {
    discovery:
      parsed?.discovery && typeof parsed.discovery === "object"
        ? {
            itemId: String(parsed.discovery.itemId || "").trim(),
            ideaId: String(parsed.discovery.ideaId || "").trim(),
            kind: String(parsed.discovery.kind || "").trim(),
          }
        : null,
    execution:
      parsed?.execution && typeof parsed.execution === "object"
        ? {
            issue:
              parsed.execution.issue && typeof parsed.execution.issue === "object"
                ? {
                    issueId: String(parsed.execution.issue.issueId || "").trim(),
                    projectId: String(parsed.execution.issue.projectId || "").trim(),
                    seedKey: String(parsed.execution.issue.seedKey || "").trim(),
                  }
                : null,
            approval:
              parsed.execution.approval &&
              typeof parsed.execution.approval === "object"
                ? {
                    approvalId: String(parsed.execution.approval.approvalId || "").trim(),
                    projectId: String(parsed.execution.approval.projectId || "").trim(),
                    seedKey: String(parsed.execution.approval.seedKey || "").trim(),
                  }
                : null,
            runtime:
              parsed.execution.runtime && typeof parsed.execution.runtime === "object"
                ? {
                    runtimeId: String(parsed.execution.runtime.runtimeId || "").trim(),
                    projectId: String(parsed.execution.runtime.projectId || "").trim(),
                    seedKey: String(parsed.execution.runtime.seedKey || "").trim(),
                  }
                : null,
          }
        : null,
  };
}

function buildDiscoveredScope(snapshot) {
  return {
    project_id: snapshot.routeScope?.projectId || "",
    intake_session_id: snapshot.routeScope?.intakeSessionId || "",
    session_id: snapshot.parityTargets?.discoverySessionId || "",
    idea_id: snapshot.parityTargets?.discoveryIdeaId || "",
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

function byDiscoveryActionPreference(left, right, preferredIdeaId) {
  const leftIdeaMatch = left.idea_id === preferredIdeaId ? 0 : 1;
  const rightIdeaMatch = right.idea_id === preferredIdeaId ? 0 : 1;
  if (leftIdeaMatch !== rightIdeaMatch) {
    return leftIdeaMatch - rightIdeaMatch;
  }

  const leftIndex = discoveryActionKindPriority.indexOf(left.kind);
  const rightIndex = discoveryActionKindPriority.indexOf(right.kind);
  const leftRank =
    leftIndex >= 0 ? leftIndex : discoveryActionKindPriority.length;
  const rightRank =
    rightIndex >= 0 ? rightIndex : discoveryActionKindPriority.length;
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  return String(left.item_id).localeCompare(String(right.item_id));
}

function findById(items, key, expectedId) {
  return items.find((item) => String(item[key] || "") === expectedId) ?? null;
}

function findByKey(records, expectedKey) {
  if (!Array.isArray(records)) {
    return null;
  }
  return (
    records.find((record) => String(record?.key || "") === expectedKey) ?? null
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

function buildExecutionAttentionKeys(targets) {
  return {
    issue: `issue:${targets.execution.issue.issueId}`,
    approval: `approval:${targets.execution.approval.approvalId}`,
    runtime: `runtime:${targets.execution.runtime.runtimeId}`,
  };
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

async function resolveActionTargets(scope, explicitTargets) {
  const resolved = {
    discovery: explicitTargets.discovery,
    execution: explicitTargets.execution,
  };

  if (
    !resolved.discovery?.itemId ||
    !resolved.discovery.ideaId ||
    !resolved.discovery.kind
  ) {
    const discoveryFeed = await fetchJson(
      `/api/shell/discovery/inbox?limit=200&status=open`
    );
    assert(
      discoveryFeed.response.status === 200,
      "Failed to load discovery inbox for live review actions."
    );
    assert(
      Array.isArray(discoveryFeed.json.items),
      "Discovery inbox did not return items."
    );

    const preferredItem = [...discoveryFeed.json.items]
      .filter((item) => item.status === "open" && item.interrupt?.config?.allow_accept)
      .sort((left, right) =>
        byDiscoveryActionPreference(left, right, scope.idea_id)
      )[0];

    assert(
      preferredItem,
      "Could not auto-discover one open discovery inbox item with accept semantics."
    );

    resolved.discovery = {
      itemId: String(preferredItem.item_id || "").trim(),
      ideaId: String(preferredItem.idea_id || "").trim(),
      kind: String(preferredItem.kind || "").trim(),
    };
  }

  const executionTargets = resolved.execution || {
    issue: null,
    approval: null,
    runtime: null,
  };
  const projectId =
    executionTargets.issue?.projectId ||
    executionTargets.approval?.projectId ||
    executionTargets.runtime?.projectId ||
    scope.project_id;

  assert(projectId, "Could not resolve a project_id for execution action targets.");

  if (!executionTargets.issue?.issueId) {
    const issuesPayload = await fetchJson(
      `/api/shell/execution/attention${buildQuery({
        kind: "issues",
        project_id: projectId,
        status: "open",
      })}`
    );
    assert(
      issuesPayload.response.status === 200,
      "Failed to load execution issues for live review actions."
    );
    const issue = issuesPayload.json.issues?.[0] ?? null;
    assert(issue, `Could not auto-discover one open execution issue for ${projectId}.`);
    executionTargets.issue = {
      issueId: String(issue.id || "").trim(),
      projectId,
      seedKey: "",
    };
  }

  if (!executionTargets.approval?.approvalId) {
    const approvalsPayload = await fetchJson(
      `/api/shell/execution/attention${buildQuery({
        kind: "approvals",
        project_id: projectId,
        status: "pending",
      })}`
    );
    assert(
      approvalsPayload.response.status === 200,
      "Failed to load execution approvals for live review actions."
    );
    const approval = approvalsPayload.json.approvals?.[0] ?? null;
    assert(
      approval,
      `Could not auto-discover one pending execution approval for ${projectId}.`
    );
    executionTargets.approval = {
      approvalId: String(approval.id || "").trim(),
      projectId,
      seedKey: "",
    };
  }

  if (!executionTargets.runtime?.runtimeId) {
    const runtimesPayload = await fetchJson(
      `/api/shell/execution/attention${buildQuery({
        kind: "runtimes",
        project_id: projectId,
        status: "pending",
      })}`
    );
    assert(
      runtimesPayload.response.status === 200,
      "Failed to load execution tool permission runtimes for live review actions."
    );
    const runtime = runtimesPayload.json.runtimes?.[0] ?? null;
    assert(
      runtime,
      `Could not auto-discover one pending tool permission runtime for ${projectId}.`
    );
    executionTargets.runtime = {
      runtimeId: String(runtime.id || "").trim(),
      projectId,
      seedKey: "",
    };
  }

  return {
    discovery: resolved.discovery,
    execution: executionTargets,
  };
}

function summarizeOpenCounts(payloads) {
  return {
    discoveryOpenCount: getCollectionLength(payloads.discoveryOpen, "items"),
    discoveryResolvedCount: getCollectionLength(
      payloads.discoveryResolved,
      "items"
    ),
    executionOpenIssueCount: getCollectionLength(payloads.issuesOpen, "issues"),
    executionPendingApprovalCount: getCollectionLength(
      payloads.approvalsPending,
      "approvals"
    ),
    executionPendingRuntimeCount: getCollectionLength(
      payloads.runtimesPending,
      "runtimes"
    ),
  };
}

function summarizeShellSurfaceCounts(payloads) {
  const portfolioRecord = findPortfolioRecord(
    payloads.portfolio?.json?.records,
    payloads.projectId
  );

  return {
    reviewExecutionCount: getNestedCollectionLength(payloads.reviewCenter, [
      "execution",
      "records",
    ]),
    executionReviewCount: getCollectionLength(payloads.executionReview, "records"),
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
    dashboardApprovalCount: getCollectionLength(payloads.dashboard, "approvals"),
    dashboardRuntimeCount: getCollectionLength(payloads.dashboard, "runtimes"),
    dashboardReviewExecutionCount: getNestedCollectionLength(payloads.dashboard, [
      "reviewCenter",
      "execution",
      "records",
    ]),
    portfolioAttentionTotal: portfolioRecord?.attention?.total ?? 0,
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

  const parityTargetsSnapshot = await fetchJson(contract.liveRoutes.parityTargets);
  assert(
    parityTargetsSnapshot.response.status === 200,
    "Shell parity target route must return 200."
  );

  const discoveredScope = buildDiscoveredScope(parityTargetsSnapshot.json);
  const resolvedScope = mergeScope(explicitScope, discoveredScope);
  const explicitTargets = parseActionTargets(
    process.env.FOUNDEROS_REVIEW_ACTION_TARGETS_JSON || ""
  );
  const targets = await resolveActionTargets(resolvedScope, explicitTargets);

  const projectId =
    targets.execution.issue?.projectId ||
    targets.execution.approval?.projectId ||
    targets.execution.runtime?.projectId ||
    resolvedScope.project_id;
  const discoveryIdeaId = targets.discovery.ideaId || resolvedScope.idea_id;
  const executionAttentionKeys = buildExecutionAttentionKeys(targets);

  assert(targets.discovery.itemId, "Missing discovery action target item id.");
  assert(targets.execution.issue?.issueId, "Missing execution issue target id.");
  assert(
    targets.execution.approval?.approvalId,
    "Missing execution approval target id."
  );
  assert(targets.execution.runtime?.runtimeId, "Missing execution runtime target id.");

  const before = {
    discoveryOpen: await fetchJson(`/api/shell/discovery/inbox?limit=200&status=open`),
    discoveryResolved: await fetchJson(
      `/api/shell/discovery/inbox?limit=200&status=resolved`
    ),
    issuesOpen: await fetchJson(
      `/api/shell/execution/attention${buildQuery({
        kind: "issues",
        project_id: projectId,
        status: "open",
      })}`
    ),
    approvalsPending: await fetchJson(
      `/api/shell/execution/attention${buildQuery({
        kind: "approvals",
        project_id: projectId,
        status: "pending",
      })}`
    ),
    runtimesPending: await fetchJson(
      `/api/shell/execution/attention${buildQuery({
        kind: "runtimes",
        project_id: projectId,
        status: "pending",
      })}`
    ),
    reviewCenter: await fetchJson("/api/shell/review"),
    executionReview: await fetchJson("/api/shell/execution/review"),
    inbox: await fetchJson("/api/shell/inbox"),
    dashboard: await fetchJson("/api/shell/dashboard"),
    portfolio: await fetchJson("/api/shell/portfolio"),
  };

  assert(before.discoveryOpen.response.status === 200, "Failed to read discovery inbox.");
  assert(before.issuesOpen.response.status === 200, "Failed to read execution issues.");
  assert(
    before.approvalsPending.response.status === 200,
    "Failed to read execution approvals."
  );
  assert(
    before.runtimesPending.response.status === 200,
    "Failed to read execution runtimes."
  );
  assert(before.reviewCenter.response.status === 200, "Failed to read review center.");
  assert(
    before.executionReview.response.status === 200,
    "Failed to read execution review surface."
  );
  assert(before.inbox.response.status === 200, "Failed to read inbox surface.");
  assert(
    before.dashboard.response.status === 200,
    "Failed to read dashboard surface."
  );
  assert(
    before.portfolio.response.status === 200,
    "Failed to read portfolio surface."
  );

  const beforePortfolioRecord = findPortfolioRecord(
    before.portfolio.json.records,
    projectId
  );
  assert(
    beforePortfolioRecord,
    `Project ${projectId} is not present in the portfolio snapshot.`
  );

  assert(
    findById(before.discoveryOpen.json.items, "item_id", targets.discovery.itemId),
    `Discovery action target ${targets.discovery.itemId} is not present in the open inbox feed.`
  );
  assert(
    findById(before.issuesOpen.json.issues, "id", targets.execution.issue.issueId),
    `Execution issue target ${targets.execution.issue.issueId} is not present in the open issues feed.`
  );
  assert(
    findById(
      before.approvalsPending.json.approvals,
      "id",
      targets.execution.approval.approvalId
    ),
    `Execution approval target ${targets.execution.approval.approvalId} is not present in the pending approvals feed.`
  );
  assert(
    findById(
      before.runtimesPending.json.runtimes,
      "id",
      targets.execution.runtime.runtimeId
    ),
    `Execution runtime target ${targets.execution.runtime.runtimeId} is not present in the pending runtimes feed.`
  );
  assert(
    findById(
      before.inbox.json.discoveryFeed?.items || [],
      "item_id",
      targets.discovery.itemId
    ),
    `Discovery action target ${targets.discovery.itemId} is not present in the shell inbox snapshot.`
  );
  assert(
    findById(
      before.dashboard.json.discoveryFeed?.items || [],
      "item_id",
      targets.discovery.itemId
    ),
    `Discovery action target ${targets.discovery.itemId} is not present in the shell dashboard snapshot.`
  );
  assert(
    findById(before.inbox.json.issues || [], "id", targets.execution.issue.issueId),
    `Execution issue target ${targets.execution.issue.issueId} is not present in the shell inbox snapshot.`
  );
  assert(
    findById(
      before.inbox.json.approvals || [],
      "id",
      targets.execution.approval.approvalId
    ),
    `Execution approval target ${targets.execution.approval.approvalId} is not present in the shell inbox snapshot.`
  );
  assert(
    findById(
      before.inbox.json.runtimes || [],
      "id",
      targets.execution.runtime.runtimeId
    ),
    `Execution runtime target ${targets.execution.runtime.runtimeId} is not present in the shell inbox snapshot.`
  );
  assert(
    findById(
      before.dashboard.json.issues || [],
      "id",
      targets.execution.issue.issueId
    ),
    `Execution issue target ${targets.execution.issue.issueId} is not present in the shell dashboard snapshot.`
  );
  assert(
    findById(
      before.dashboard.json.approvals || [],
      "id",
      targets.execution.approval.approvalId
    ),
    `Execution approval target ${targets.execution.approval.approvalId} is not present in the shell dashboard snapshot.`
  );
  assert(
    findById(
      before.dashboard.json.runtimes || [],
      "id",
      targets.execution.runtime.runtimeId
    ),
    `Execution runtime target ${targets.execution.runtime.runtimeId} is not present in the shell dashboard snapshot.`
  );
  assert(
    findByKey(before.reviewCenter.json.execution?.records, executionAttentionKeys.issue),
    `Execution issue target ${targets.execution.issue.issueId} is not present in the shell review snapshot.`
  );
  assert(
    findByKey(
      before.reviewCenter.json.execution?.records,
      executionAttentionKeys.approval
    ),
    `Execution approval target ${targets.execution.approval.approvalId} is not present in the shell review snapshot.`
  );
  assert(
    findByKey(
      before.reviewCenter.json.execution?.records,
      executionAttentionKeys.runtime
    ),
    `Execution runtime target ${targets.execution.runtime.runtimeId} is not present in the shell review snapshot.`
  );
  assert(
    findByKey(before.executionReview.json.records, executionAttentionKeys.issue),
    `Execution issue target ${targets.execution.issue.issueId} is not present in the execution review snapshot.`
  );
  assert(
    findByKey(
      before.executionReview.json.records,
      executionAttentionKeys.approval
    ),
    `Execution approval target ${targets.execution.approval.approvalId} is not present in the execution review snapshot.`
  );
  assert(
    findByKey(
      before.executionReview.json.records,
      executionAttentionKeys.runtime
    ),
    `Execution runtime target ${targets.execution.runtime.runtimeId} is not present in the execution review snapshot.`
  );
  assert(
    findById(
      beforePortfolioRecord.attention?.issues || [],
      "id",
      targets.execution.issue.issueId
    ),
    `Execution issue target ${targets.execution.issue.issueId} is not present in the portfolio chain attention rollup.`
  );
  assert(
    findById(
      beforePortfolioRecord.attention?.approvals || [],
      "id",
      targets.execution.approval.approvalId
    ),
    `Execution approval target ${targets.execution.approval.approvalId} is not present in the portfolio chain attention rollup.`
  );
  assert(
    findById(
      beforePortfolioRecord.attention?.runtimes || [],
      "id",
      targets.execution.runtime.runtimeId
    ),
    `Execution runtime target ${targets.execution.runtime.runtimeId} is not present in the portfolio chain attention rollup.`
  );

  const discoveryAction = await fetchJson(
    `/api/shell/discovery/actions/orchestrate/discovery/inbox/${encodeURIComponent(
      targets.discovery.itemId
    )}/act`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "accept",
        actor: "founderos-shell",
        note: "Live review action harness accepted this deterministic discovery item.",
      }),
    }
  );
  assert(
    discoveryAction.response.status === 200,
    `Discovery accept action failed with ${discoveryAction.response.status}.`
  );
  assert(
    discoveryAction.json.status === "resolved",
    `Discovery accept action did not resolve item ${targets.discovery.itemId}.`
  );
  assert(
    discoveryAction.json.resolution?.action === "accept",
    `Discovery accept action did not record resolution action "accept" for ${targets.discovery.itemId}.`
  );

  const issueAction = await fetchJson(
    `/api/shell/execution/actions/execution-plane/issues/${encodeURIComponent(
      targets.execution.issue.issueId
    )}/resolve`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actor: "founderos-shell",
        note: "Live review action harness resolved this deterministic execution issue.",
      }),
    }
  );
  assert(
    issueAction.response.status === 200,
    `Execution issue resolve failed with ${issueAction.response.status}.`
  );
  assert(
    issueAction.json.issue?.status === "resolved",
    `Execution issue ${targets.execution.issue.issueId} did not resolve.`
  );

  const approvalAction = await fetchJson(
    `/api/shell/execution/actions/execution-plane/approvals/${encodeURIComponent(
      targets.execution.approval.approvalId
    )}/approve`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actor: "founderos-shell",
        note: "Live review action harness approved this deterministic execution approval.",
      }),
    }
  );
  assert(
    approvalAction.response.status === 200,
    `Execution approval approve failed with ${approvalAction.response.status}.`
  );
  assert(
    approvalAction.json.approval?.status === "approved",
    `Execution approval ${targets.execution.approval.approvalId} did not transition to approved.`
  );

  const runtimeAction = await fetchJson(
    `/api/shell/execution/actions/execution-plane/tool-permission-runtimes/${encodeURIComponent(
      targets.execution.runtime.runtimeId
    )}/allow`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actor: "founderos-shell",
        note: "Live review action harness allowed this deterministic tool permission runtime.",
        source: "user",
      }),
    }
  );
  assert(
    runtimeAction.response.status === 200,
    `Execution runtime allow failed with ${runtimeAction.response.status}.`
  );
  assert(
    runtimeAction.json.runtime?.status === "resolved",
    `Execution runtime ${targets.execution.runtime.runtimeId} did not resolve.`
  );
  assert(
    String(
      runtimeAction.json.runtime?.resolved_behavior ||
        runtimeAction.json.runtime?.metadata?.pending?.resolved_behavior ||
        runtimeAction.json.runtime?.outcome ||
        ""
    ) === "allow",
    `Execution runtime ${targets.execution.runtime.runtimeId} did not settle with allow semantics.`
  );

  const after = {
    discoveryOpen: await fetchJson(`/api/shell/discovery/inbox?limit=200&status=open`),
    discoveryResolved: await fetchJson(
      `/api/shell/discovery/inbox?limit=200&status=resolved`
    ),
    issuesOpen: await fetchJson(
      `/api/shell/execution/attention${buildQuery({
        kind: "issues",
        project_id: projectId,
        status: "open",
      })}`
    ),
    issuesAll: await fetchJson(
      `/api/shell/execution/attention${buildQuery({
        kind: "issues",
        project_id: projectId,
      })}`
    ),
    approvalsPending: await fetchJson(
      `/api/shell/execution/attention${buildQuery({
        kind: "approvals",
        project_id: projectId,
        status: "pending",
      })}`
    ),
    approvalsAll: await fetchJson(
      `/api/shell/execution/attention${buildQuery({
        kind: "approvals",
        project_id: projectId,
      })}`
    ),
    runtimesPending: await fetchJson(
      `/api/shell/execution/attention${buildQuery({
        kind: "runtimes",
        project_id: projectId,
        status: "pending",
      })}`
    ),
    runtimesAll: await fetchJson(
      `/api/shell/execution/attention${buildQuery({
        kind: "runtimes",
        project_id: projectId,
      })}`
    ),
    reviewCenter: await fetchJson("/api/shell/review"),
    executionReview: await fetchJson("/api/shell/execution/review"),
    inbox: await fetchJson("/api/shell/inbox"),
    dashboard: await fetchJson("/api/shell/dashboard"),
    portfolio: await fetchJson("/api/shell/portfolio"),
  };

  const afterPortfolioRecord = findPortfolioRecord(
    after.portfolio.json.records,
    projectId
  );
  assert(
    afterPortfolioRecord,
    `Project ${projectId} is missing from the portfolio snapshot after review actions.`
  );

  assert(
    !findById(after.discoveryOpen.json.items, "item_id", targets.discovery.itemId),
    `Discovery item ${targets.discovery.itemId} still appears in the open inbox feed after accept.`
  );
  const resolvedDiscoveryItem = findById(
    after.discoveryResolved.json.items,
    "item_id",
    targets.discovery.itemId
  );
  assert(
    resolvedDiscoveryItem?.status === "resolved",
    `Discovery item ${targets.discovery.itemId} is missing from the resolved inbox feed after accept.`
  );

  assert(
    !findById(after.issuesOpen.json.issues, "id", targets.execution.issue.issueId),
    `Execution issue ${targets.execution.issue.issueId} still appears in the open issues feed after resolve.`
  );
  assert(
    findById(after.issuesAll.json.issues, "id", targets.execution.issue.issueId)
      ?.status === "resolved",
    `Execution issue ${targets.execution.issue.issueId} is missing from the all-issues feed with resolved status.`
  );

  assert(
    !findById(
      after.approvalsPending.json.approvals,
      "id",
      targets.execution.approval.approvalId
    ),
    `Execution approval ${targets.execution.approval.approvalId} still appears in the pending approvals feed after approve.`
  );
  assert(
    findById(after.approvalsAll.json.approvals, "id", targets.execution.approval.approvalId)
      ?.status === "approved",
    `Execution approval ${targets.execution.approval.approvalId} is missing from the all-approvals feed with approved status.`
  );

  assert(
    !findById(
      after.runtimesPending.json.runtimes,
      "id",
      targets.execution.runtime.runtimeId
    ),
    `Execution runtime ${targets.execution.runtime.runtimeId} still appears in the pending runtimes feed after allow.`
  );
  const resolvedRuntime = findById(
    after.runtimesAll.json.runtimes,
    "id",
    targets.execution.runtime.runtimeId
  );
  assert(
    resolvedRuntime?.status === "resolved",
    `Execution runtime ${targets.execution.runtime.runtimeId} is missing from the all-runtimes feed with resolved status.`
  );
  assert(
    String(
      resolvedRuntime?.resolved_behavior ||
        resolvedRuntime?.metadata?.pending?.resolved_behavior ||
        resolvedRuntime?.outcome ||
        ""
    ) === "allow",
    `Execution runtime ${targets.execution.runtime.runtimeId} is not marked as allowed in the stored runtime feed.`
  );
  assert(
    !findById(
      after.inbox.json.discoveryFeed?.items || [],
      "item_id",
      targets.discovery.itemId
    ),
    `Discovery item ${targets.discovery.itemId} still appears in the shell inbox snapshot after accept.`
  );
  assert(
    !findById(
      after.dashboard.json.discoveryFeed?.items || [],
      "item_id",
      targets.discovery.itemId
    ),
    `Discovery item ${targets.discovery.itemId} still appears in the shell dashboard snapshot after accept.`
  );
  assert(
    !findById(after.inbox.json.issues || [], "id", targets.execution.issue.issueId),
    `Execution issue ${targets.execution.issue.issueId} still appears in the shell inbox snapshot after resolve.`
  );
  assert(
    !findById(
      after.inbox.json.approvals || [],
      "id",
      targets.execution.approval.approvalId
    ),
    `Execution approval ${targets.execution.approval.approvalId} still appears in the shell inbox snapshot after approve.`
  );
  assert(
    !findById(
      after.inbox.json.runtimes || [],
      "id",
      targets.execution.runtime.runtimeId
    ),
    `Execution runtime ${targets.execution.runtime.runtimeId} still appears in the shell inbox snapshot after allow.`
  );
  assert(
    !findById(
      after.dashboard.json.issues || [],
      "id",
      targets.execution.issue.issueId
    ),
    `Execution issue ${targets.execution.issue.issueId} still appears in the shell dashboard snapshot after resolve.`
  );
  assert(
    !findById(
      after.dashboard.json.approvals || [],
      "id",
      targets.execution.approval.approvalId
    ),
    `Execution approval ${targets.execution.approval.approvalId} still appears in the shell dashboard snapshot after approve.`
  );
  assert(
    !findById(
      after.dashboard.json.runtimes || [],
      "id",
      targets.execution.runtime.runtimeId
    ),
    `Execution runtime ${targets.execution.runtime.runtimeId} still appears in the shell dashboard snapshot after allow.`
  );
  assert(
    !findByKey(after.reviewCenter.json.execution?.records, executionAttentionKeys.issue),
    `Execution issue ${targets.execution.issue.issueId} still appears in the shell review snapshot after resolve.`
  );
  assert(
    !findByKey(
      after.reviewCenter.json.execution?.records,
      executionAttentionKeys.approval
    ),
    `Execution approval ${targets.execution.approval.approvalId} still appears in the shell review snapshot after approve.`
  );
  assert(
    !findByKey(
      after.reviewCenter.json.execution?.records,
      executionAttentionKeys.runtime
    ),
    `Execution runtime ${targets.execution.runtime.runtimeId} still appears in the shell review snapshot after allow.`
  );
  assert(
    !findByKey(after.executionReview.json.records, executionAttentionKeys.issue),
    `Execution issue ${targets.execution.issue.issueId} still appears in the execution review snapshot after resolve.`
  );
  assert(
    !findByKey(after.executionReview.json.records, executionAttentionKeys.approval),
    `Execution approval ${targets.execution.approval.approvalId} still appears in the execution review snapshot after approve.`
  );
  assert(
    !findByKey(after.executionReview.json.records, executionAttentionKeys.runtime),
    `Execution runtime ${targets.execution.runtime.runtimeId} still appears in the execution review snapshot after allow.`
  );
  assert(
    !findById(
      afterPortfolioRecord.attention?.issues || [],
      "id",
      targets.execution.issue.issueId
    ),
    `Execution issue ${targets.execution.issue.issueId} still appears in the portfolio chain attention rollup after resolve.`
  );
  assert(
    !findById(
      afterPortfolioRecord.attention?.approvals || [],
      "id",
      targets.execution.approval.approvalId
    ),
    `Execution approval ${targets.execution.approval.approvalId} still appears in the portfolio chain attention rollup after approve.`
  );
  assert(
    !findById(
      afterPortfolioRecord.attention?.runtimes || [],
      "id",
      targets.execution.runtime.runtimeId
    ),
    `Execution runtime ${targets.execution.runtime.runtimeId} still appears in the portfolio chain attention rollup after allow.`
  );
  assert(
    (afterPortfolioRecord.attention?.total ?? 0) <=
      (beforePortfolioRecord.attention?.total ?? 0) - 3,
    `Portfolio chain attention total did not drop after resolving review actions for ${projectId}.`
  );

  console.log(
    JSON.stringify({
      status: "ok",
      baseUrl,
      resolvedScope: {
        ...resolvedScope,
        project_id: projectId,
        idea_id: discoveryIdeaId,
      },
      targets,
      before: summarizeOpenCounts(before),
      after: summarizeOpenCounts(after),
      surfacesBefore: summarizeShellSurfaceCounts({
        ...before,
        projectId,
      }),
      surfacesAfter: summarizeShellSurfaceCounts({
        ...after,
        projectId,
      }),
      actions: {
        discovery: {
          itemId: targets.discovery.itemId,
          kind: targets.discovery.kind,
          status: discoveryAction.json.status,
        },
        execution: {
          issueId: targets.execution.issue.issueId,
          issueStatus: issueAction.json.issue.status,
          approvalId: targets.execution.approval.approvalId,
          approvalStatus: approvalAction.json.approval.status,
          runtimeId: targets.execution.runtime.runtimeId,
          runtimeStatus: runtimeAction.json.runtime.status,
          runtimeResolvedBehavior:
            runtimeAction.json.runtime.resolved_behavior ||
            runtimeAction.json.runtime.metadata?.pending?.resolved_behavior ||
            runtimeAction.json.runtime.outcome ||
            "",
        },
      },
    })
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  if (lastStdout) {
    console.error(`recent stdout:\n${lastStdout}`);
  }
  if (lastStderr) {
    console.error(`recent stderr:\n${lastStderr}`);
  }
  process.exitCode = 1;
} finally {
  await teardown();
}
