import { cookies } from "next/headers";

import { ExecutionAgentWorkspace } from "@/components/execution/execution-agent-workspace";
import { buildExecutionAgentSnapshot } from "@/lib/execution-agent";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type ExecutionAgentSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

function decodeRouteParam(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default async function ExecutionAgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ runtimeAgentId: string }>;
  searchParams?: ExecutionAgentSearchParams;
}) {
  const resolvedParams = await params;
  const runtimeAgentId = decodeRouteParam(resolvedParams.runtimeAgentId);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value
  );
  const initialSnapshot = await buildExecutionAgentSnapshot(runtimeAgentId);

  return (
    <ExecutionAgentWorkspace
      runtimeAgentId={runtimeAgentId}
      initialPreferences={operatorControls.preferences}
      initialSnapshot={initialSnapshot}
      routeScope={readShellRouteScopeFromQueryRecord(resolvedSearchParams)}
    />
  );
}
