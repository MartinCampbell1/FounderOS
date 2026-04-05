import type {
  AutopilotExecutionApprovalRecord,
  AutopilotExecutionIssueRecord,
  AutopilotIntakeSessionSummary,
  AutopilotProjectSummary,
  AutopilotToolPermissionRuntimeRecord,
  QuorumDiscoveryIdea,
  QuorumIdeaDossier,
} from "@founderos/api-clients";

import { buildShellChainGraph, type ShellChainRecord } from "@/lib/chain-graph";
import {
  buildUpstreamQuery,
  formatUpstreamErrorMessage,
  requestUpstreamJson,
} from "@/lib/upstream";

export interface ShellChainGraphSnapshotData {
  ideas: QuorumDiscoveryIdea[];
  dossiers: QuorumIdeaDossier[];
  projects: AutopilotProjectSummary[];
  intakeSessions: AutopilotIntakeSessionSummary[];
  issues: AutopilotExecutionIssueRecord[];
  approvals: AutopilotExecutionApprovalRecord[];
  runtimes: AutopilotToolPermissionRuntimeRecord[];
  chains: ShellChainRecord[];
  errors: string[];
  loadState: "ready" | "error";
}

function sortIdeas(items: QuorumDiscoveryIdea[]) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.updated_at || left.created_at || "") || 0;
    const rightTime = Date.parse(right.updated_at || right.created_at || "") || 0;
    return rightTime - leftTime;
  });
}

function sortProjects(items: AutopilotProjectSummary[]) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.last_activity_at ?? "") || 0;
    const rightTime = Date.parse(right.last_activity_at ?? "") || 0;
    return rightTime - leftTime;
  });
}

function sortIntakeSessions(items: AutopilotIntakeSessionSummary[]) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.updated_at || "") || 0;
    const rightTime = Date.parse(right.updated_at || "") || 0;
    return rightTime - leftTime;
  });
}

type ShellChainGraphSnapshotOptions = {
  discoveryIdeaLimit?: number;
  includeArchivedProjects?: boolean;
  discoveryStages?: string[];
  upstreamTimeoutMs?: number;
};

const DEFAULT_CHAIN_GRAPH_DISCOVERY_STAGES = [
  "sourced",
  "ranked",
  "debated",
  "simulated",
  "swiped",
  "handed_off",
  "executed",
];

const CHAIN_GRAPH_DOSSIER_FETCH_CONCURRENCY = 6;
const CHAIN_GRAPH_DOSSIER_CACHE_TTL_MS = 250;
const CHAIN_GRAPH_DOSSIER_TIMEOUT_MS = 5000;

type DiscoveryDossierCacheEntry = {
  promise: Promise<QuorumIdeaDossier>;
  pending: boolean;
  expiresAt: number;
};

const discoveryDossierRequestCache = new Map<string, DiscoveryDossierCacheEntry>();

function createDiscoveryDossierCacheEntry(ideaId: string): DiscoveryDossierCacheEntry {
  const entry: DiscoveryDossierCacheEntry = {
    pending: true,
    expiresAt: Number.POSITIVE_INFINITY,
    promise: requestUpstreamJson<QuorumIdeaDossier>(
      "quorum",
      `orchestrate/discovery/ideas/${encodeURIComponent(ideaId)}/dossier`,
      undefined,
      { timeoutMs: CHAIN_GRAPH_DOSSIER_TIMEOUT_MS }
    )
      .then((dossier) => {
        entry.pending = false;
        entry.expiresAt = Date.now() + CHAIN_GRAPH_DOSSIER_CACHE_TTL_MS;
        return dossier;
      })
      .catch((error) => {
        if (discoveryDossierRequestCache.get(ideaId) === entry) {
          discoveryDossierRequestCache.delete(ideaId);
        }
        throw error;
      }),
  };

  return entry;
}

function requestDiscoveryIdeaDossier(ideaId: string) {
  const cached = discoveryDossierRequestCache.get(ideaId);

  if (cached && (cached.pending || cached.expiresAt > Date.now())) {
    return cached.promise;
  }

  // Several shell surfaces hydrate the same dossiers concurrently. Keep the
  // same upstream request in-flight briefly so parity and review routes do not
  // fan out into duplicate dossier loads.
  const entry = createDiscoveryDossierCacheEntry(ideaId);
  discoveryDossierRequestCache.set(ideaId, entry);
  return entry.promise;
}

async function mapSettledWithConcurrency<TItem, TResult>(
  items: TItem[],
  concurrency: number,
  mapper: (item: TItem) => Promise<TResult>
): Promise<PromiseSettledResult<TResult>[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<PromiseSettledResult<TResult>>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const item = items[currentIndex];

      if (item === undefined) {
        break;
      }

      try {
        results[currentIndex] = {
          status: "fulfilled",
          value: await mapper(item),
        };
      } catch (error) {
        results[currentIndex] = {
          status: "rejected",
          reason: error,
        };
      }
    }
  }

  const workerCount = Math.min(Math.max(1, Math.trunc(concurrency)), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}

export async function loadShellChainGraphSnapshotData(
  options: ShellChainGraphSnapshotOptions = {}
): Promise<ShellChainGraphSnapshotData> {
  const discoveryIdeaLimit =
    typeof options.discoveryIdeaLimit === "number"
      ? Math.max(1, Math.min(Math.trunc(options.discoveryIdeaLimit), 500))
      : 100;
  const includeArchivedProjects = options.includeArchivedProjects ?? false;
  const upstreamTimeoutMs = options.upstreamTimeoutMs;
  const discoveryStages = new Set(
    (options.discoveryStages?.length
      ? options.discoveryStages
      : DEFAULT_CHAIN_GRAPH_DISCOVERY_STAGES
    )
      .map((stage) => stage.trim())
      .filter(Boolean)
  );

  const [
    ideasResult,
    projectsResult,
    intakeSessionsResult,
    issuesResult,
    approvalsResult,
    runtimesResult,
  ] = await Promise.allSettled([
    requestUpstreamJson<{ ideas: QuorumDiscoveryIdea[] }>(
      "quorum",
      "orchestrate/discovery/ideas",
      buildUpstreamQuery({ limit: discoveryIdeaLimit }),
      { timeoutMs: upstreamTimeoutMs }
    ),
    requestUpstreamJson<{ projects: AutopilotProjectSummary[] }>(
      "autopilot",
      "projects/",
      buildUpstreamQuery({ include_archived: includeArchivedProjects }),
      { timeoutMs: upstreamTimeoutMs }
    ),
    requestUpstreamJson<{ sessions: AutopilotIntakeSessionSummary[] }>(
      "autopilot",
      "intake/sessions",
      undefined,
      { timeoutMs: upstreamTimeoutMs }
    ),
    requestUpstreamJson<{ issues: AutopilotExecutionIssueRecord[] }>(
      "autopilot",
      "execution-plane/issues",
      buildUpstreamQuery({ status: "open" }),
      { timeoutMs: upstreamTimeoutMs }
    ),
    requestUpstreamJson<{ approvals: AutopilotExecutionApprovalRecord[] }>(
      "autopilot",
      "execution-plane/approvals",
      buildUpstreamQuery({ status: "pending" }),
      { timeoutMs: upstreamTimeoutMs }
    ),
    requestUpstreamJson<{ runtimes: AutopilotToolPermissionRuntimeRecord[] }>(
      "autopilot",
      "execution-plane/tool-permission-runtimes",
      buildUpstreamQuery({ status: "pending" }),
      { timeoutMs: upstreamTimeoutMs }
    ),
  ]);

  const errors: string[] = [];

  const ideas =
    ideasResult.status === "fulfilled"
      ? sortIdeas(ideasResult.value.ideas)
      : (errors.push(
          formatUpstreamErrorMessage("Discovery ideas", ideasResult.reason)
        ), []);
  const projects =
    projectsResult.status === "fulfilled"
      ? sortProjects(projectsResult.value.projects)
      : (errors.push(
          formatUpstreamErrorMessage("Execution projects", projectsResult.reason)
        ), []);
  const intakeSessions =
    intakeSessionsResult.status === "fulfilled"
      ? sortIntakeSessions(intakeSessionsResult.value.sessions)
      : (errors.push(
          formatUpstreamErrorMessage(
            "Execution intake sessions",
            intakeSessionsResult.reason
          )
        ), []);
  const issues =
    issuesResult.status === "fulfilled"
      ? issuesResult.value.issues
      : (errors.push(
          formatUpstreamErrorMessage("Execution issues", issuesResult.reason)
        ), []);
  const approvals =
    approvalsResult.status === "fulfilled"
      ? approvalsResult.value.approvals
      : (errors.push(
          formatUpstreamErrorMessage("Execution approvals", approvalsResult.reason)
        ), []);
  const runtimes =
    runtimesResult.status === "fulfilled"
      ? runtimesResult.value.runtimes
      : (errors.push(
          formatUpstreamErrorMessage("Tool permissions", runtimesResult.reason)
        ), []);

  const relevantIdeas = ideas.filter((idea) => discoveryStages.has(idea.latest_stage));
  const dossierResults = await mapSettledWithConcurrency(
    relevantIdeas,
    CHAIN_GRAPH_DOSSIER_FETCH_CONCURRENCY,
    (idea) => requestDiscoveryIdeaDossier(idea.idea_id)
  );

  const dossiers = dossierResults.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : []
  );
  const failedDossierResults = dossierResults.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected"
  );

  const firstFailedDossierResult = failedDossierResults[0];

  if (failedDossierResults.length === 1 && firstFailedDossierResult) {
    errors.push(
      formatUpstreamErrorMessage(
        "Discovery dossier",
        firstFailedDossierResult.reason
      )
    );
  } else if (failedDossierResults.length > 1) {
    errors.push(
      `Discovery dossiers: ${failedDossierResults.length} requests failed while loading linked idea dossiers.`
    );
  }

  return {
    ideas,
    dossiers,
    projects,
    intakeSessions,
    issues,
    approvals,
    runtimes,
    chains: buildShellChainGraph(
      dossiers,
      projects,
      intakeSessions,
      issues,
      approvals,
      runtimes
    ),
    errors,
    loadState:
      ideasResult.status === "fulfilled" ||
      projectsResult.status === "fulfilled" ||
      intakeSessionsResult.status === "fulfilled"
        ? "ready"
        : "error",
  };
}
