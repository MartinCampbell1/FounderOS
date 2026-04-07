import type {
  AutopilotExecutionEventRecord,
  AutopilotExecutionRuntimeAgentRecord,
} from "@founderos/api-clients";

export interface ShellExecutionEventsFilters {
  projectId: string;
  runtimeAgentId: string;
  orchestratorSessionId: string;
  limit: number;
}

export interface ShellExecutionEventsCounts {
  total: number;
  attention: number;
  actionRuns: number;
  approvals: number;
  issues: number;
  projects: number;
  runtimeAgents: number;
  sessions: number;
  latestEventAt: string | null;
  byStatus: Record<string, number>;
  byEvent: Record<string, number>;
}

export interface ShellExecutionEventsSnapshot {
  generatedAt: string;
  filters: ShellExecutionEventsFilters;
  events: AutopilotExecutionEventRecord[];
  eventsError: string | null;
  eventsLoadState: "ready" | "error";
  agents: AutopilotExecutionRuntimeAgentRecord[];
  agentsError: string | null;
  agentsLoadState: "ready" | "error";
  counts: ShellExecutionEventsCounts;
}

export function emptyShellExecutionEventsSnapshot(): ShellExecutionEventsSnapshot {
  return {
    generatedAt: "",
    filters: {
      projectId: "",
      runtimeAgentId: "",
      orchestratorSessionId: "",
      limit: 200,
    },
    events: [],
    eventsError: null,
    eventsLoadState: "ready",
    agents: [],
    agentsError: null,
    agentsLoadState: "ready",
    counts: {
      total: 0,
      attention: 0,
      actionRuns: 0,
      approvals: 0,
      issues: 0,
      projects: 0,
      runtimeAgents: 0,
      sessions: 0,
      latestEventAt: null,
      byStatus: {},
      byEvent: {},
    },
  };
}
