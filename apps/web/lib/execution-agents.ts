import type {
  AutopilotExecutionAgentActionRunSummaryRecord,
  AutopilotExecutionAgentActionRunsSummary,
  AutopilotExecutionAgentsSummary,
  AutopilotExecutionRuntimeAgentRecord,
  AutopilotProjectSummary,
} from "@founderos/api-clients";

import { formatUpstreamErrorMessage, requestUpstreamJson } from "@/lib/upstream";

export interface ShellExecutionAgentsSnapshot {
  generatedAt: string;
  projects: AutopilotProjectSummary[];
  projectsError: string | null;
  projectsLoadState: "ready" | "error";
  agents: AutopilotExecutionRuntimeAgentRecord[];
  agentsError: string | null;
  agentsLoadState: "ready" | "error";
  agentsSummary: AutopilotExecutionAgentsSummary | null;
  agentsSummaryError: string | null;
  agentsSummaryLoadState: "ready" | "error";
  actionRuns: AutopilotExecutionAgentActionRunSummaryRecord[];
  actionRunsError: string | null;
  actionRunsLoadState: "ready" | "error";
  actionRunsSummary: AutopilotExecutionAgentActionRunsSummary | null;
  actionRunsSummaryError: string | null;
  actionRunsSummaryLoadState: "ready" | "error";
}

function sortProjects(items: AutopilotProjectSummary[]) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.last_activity_at ?? "") || 0;
    const rightTime = Date.parse(right.last_activity_at ?? "") || 0;
    return rightTime - leftTime;
  });
}

function sortActionRuns(items: AutopilotExecutionAgentActionRunSummaryRecord[]) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.created_at ?? left.updated_at ?? "") || 0;
    const rightTime = Date.parse(right.created_at ?? right.updated_at ?? "") || 0;
    return rightTime - leftTime;
  });
}

export function emptyShellExecutionAgentsSnapshot(): ShellExecutionAgentsSnapshot {
  return {
    generatedAt: "",
    projects: [],
    projectsError: null,
    projectsLoadState: "ready",
    agents: [],
    agentsError: null,
    agentsLoadState: "ready",
    agentsSummary: null,
    agentsSummaryError: null,
    agentsSummaryLoadState: "ready",
    actionRuns: [],
    actionRunsError: null,
    actionRunsLoadState: "ready",
    actionRunsSummary: null,
    actionRunsSummaryError: null,
    actionRunsSummaryLoadState: "ready",
  };
}

export async function buildExecutionAgentsSnapshot(): Promise<ShellExecutionAgentsSnapshot> {
  const [
    projectsResult,
    agentsResult,
    agentsSummaryResult,
    actionRunsResult,
    actionRunsSummaryResult,
  ] = await Promise.allSettled([
    requestUpstreamJson<{ projects: AutopilotProjectSummary[] }>("autopilot", "projects/"),
    requestUpstreamJson<{ agents: AutopilotExecutionRuntimeAgentRecord[] }>(
      "autopilot",
      "execution-plane/agents",
      undefined,
      { timeoutMs: 5000 }
    ),
    requestUpstreamJson<AutopilotExecutionAgentsSummary>(
      "autopilot",
      "execution-plane/agents/summary",
      undefined,
      { timeoutMs: 5000 }
    ),
    requestUpstreamJson<{ runs: AutopilotExecutionAgentActionRunSummaryRecord[] }>(
      "autopilot",
      "execution-plane/agents/action-runs?summary=true",
      undefined,
      { timeoutMs: 5000 }
    ),
    requestUpstreamJson<AutopilotExecutionAgentActionRunsSummary>(
      "autopilot",
      "execution-plane/agents/action-runs/summary",
      undefined,
      { timeoutMs: 5000 }
    ),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    projects:
      projectsResult.status === "fulfilled"
        ? sortProjects(projectsResult.value.projects)
        : [],
    projectsError:
      projectsResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage("Autopilot projects", projectsResult.reason),
    projectsLoadState: projectsResult.status === "fulfilled" ? "ready" : "error",
    agents:
      agentsResult.status === "fulfilled" ? agentsResult.value.agents : [],
    agentsError:
      agentsResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage("Execution runtime agents", agentsResult.reason),
    agentsLoadState: agentsResult.status === "fulfilled" ? "ready" : "error",
    agentsSummary:
      agentsSummaryResult.status === "fulfilled" ? agentsSummaryResult.value : null,
    agentsSummaryError:
      agentsSummaryResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage(
            "Execution runtime agent summary",
            agentsSummaryResult.reason
          ),
    agentsSummaryLoadState:
      agentsSummaryResult.status === "fulfilled" ? "ready" : "error",
    actionRuns:
      actionRunsResult.status === "fulfilled"
        ? sortActionRuns(actionRunsResult.value.runs)
        : [],
    actionRunsError:
      actionRunsResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage(
            "Execution runtime agent action runs",
            actionRunsResult.reason
          ),
    actionRunsLoadState:
      actionRunsResult.status === "fulfilled" ? "ready" : "error",
    actionRunsSummary:
      actionRunsSummaryResult.status === "fulfilled"
        ? actionRunsSummaryResult.value
        : null,
    actionRunsSummaryError:
      actionRunsSummaryResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage(
            "Execution runtime agent action run summary",
            actionRunsSummaryResult.reason
          ),
    actionRunsSummaryLoadState:
      actionRunsSummaryResult.status === "fulfilled" ? "ready" : "error",
  };
}
