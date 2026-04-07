import { cookies } from "next/headers";

import { ExecutionEventsWorkspace } from "@/components/execution/execution-events-workspace";
import { buildExecutionEventsSnapshot } from "@/lib/execution-events";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type ExecutionEventsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ExecutionEventsPage({
  searchParams,
}: {
  searchParams?: ExecutionEventsSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value
  );
  const initialSnapshot = await buildExecutionEventsSnapshot({
    projectId: firstValue(params?.project_id),
    initiativeId: firstValue(params?.initiative_id),
    orchestrator: firstValue(params?.orchestrator),
    runtimeAgentId: firstValue(params?.runtime_agent_id),
    orchestratorSessionId: firstValue(params?.orchestrator_session_id),
    limit: 250,
  });

  return (
    <ExecutionEventsWorkspace
      initialPreferences={operatorControls.preferences}
      initialSnapshot={initialSnapshot}
      routeScope={readShellRouteScopeFromQueryRecord(params)}
      initialFilters={{
        runtimeAgentId: firstValue(params?.runtime_agent_id),
        orchestratorSessionId: firstValue(params?.orchestrator_session_id),
        initiativeId: firstValue(params?.initiative_id),
        orchestrator: firstValue(params?.orchestrator),
      }}
    />
  );
}
