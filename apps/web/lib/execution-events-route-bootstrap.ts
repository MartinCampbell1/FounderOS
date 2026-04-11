import { readShellRouteScopeFromQueryRecord, type ShellRouteScope } from "@/lib/route-scope";

type QueryRecord = Record<string, string | string[] | undefined>;

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export type ExecutionEventsSnapshotFilters = {
  projectId: string;
  runtimeAgentId: string;
  orchestratorSessionId: string;
  initiativeId: string;
  orchestrator: string;
  limit: number;
};

export type ExecutionEventsInitialFilters = {
  runtimeAgentId: string;
  orchestratorSessionId: string;
  initiativeId: string;
  orchestrator: string;
};

export type ExecutionEventsRouteBootstrap = {
  routeScope: ShellRouteScope;
  snapshotFilters: ExecutionEventsSnapshotFilters;
  initialFilters: ExecutionEventsInitialFilters;
};

export function readExecutionEventsRouteBootstrap(
  params?: QueryRecord | null
): ExecutionEventsRouteBootstrap {
  const routeScope = readShellRouteScopeFromQueryRecord(params);

  return {
    routeScope,
    snapshotFilters: {
      projectId: firstValue(params?.project_id),
      runtimeAgentId: firstValue(params?.runtime_agent_id),
      orchestratorSessionId: firstValue(params?.orchestrator_session_id),
      initiativeId: firstValue(params?.initiative_id),
      orchestrator: firstValue(params?.orchestrator),
      limit: 250,
    },
    initialFilters: {
      runtimeAgentId: firstValue(params?.runtime_agent_id),
      orchestratorSessionId: firstValue(params?.orchestrator_session_id),
      initiativeId: firstValue(params?.initiative_id),
      orchestrator: firstValue(params?.orchestrator),
    },
  };
}
