import type {
  AutopilotExecutionApprovalRecord,
  AutopilotExecutionIssueRecord,
  AutopilotIntakeSessionSummary,
  AutopilotProjectSummary,
  AutopilotToolPermissionRuntimeRecord,
  QuorumDiscoveryIdea,
  QuorumIdeaDossierSummary,
} from "@founderos/api-clients";

import { buildShellChainGraph, type ShellChainRecord } from "@/lib/chain-graph";
import {
  buildUpstreamQuery,
  formatUpstreamErrorMessage,
  requestUpstreamJson,
} from "@/lib/upstream";

export interface ShellChainGraphSnapshotData {
  ideas: QuorumDiscoveryIdea[];
  dossiers: QuorumIdeaDossierSummary[];
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

const CHAIN_GRAPH_DOSSIER_TIMEOUT_MS = 8000;

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
    dossiersResult,
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
    requestUpstreamJson<{ dossiers: QuorumIdeaDossierSummary[] }>(
      "quorum",
      "orchestrate/discovery/dossiers",
      buildUpstreamQuery({
        limit: discoveryIdeaLimit,
        include_archived: true,
        summary: true,
      }),
      { timeoutMs: upstreamTimeoutMs ?? CHAIN_GRAPH_DOSSIER_TIMEOUT_MS }
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
  const relevantIdeaIds = new Set(relevantIdeas.map((idea) => idea.idea_id));
  const dossiers =
    dossiersResult.status === "fulfilled"
      ? dossiersResult.value.dossiers.filter((dossier) =>
          relevantIdeaIds.has(dossier.idea.idea_id)
        )
      : (errors.push(
          formatUpstreamErrorMessage("Discovery dossiers", dossiersResult.reason)
        ),
        []);

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
