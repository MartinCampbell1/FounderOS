import { cookies } from "next/headers";

import { ExecutionAgentsWorkspace } from "@/components/execution/execution-agents-workspace";
import { buildExecutionAgentsSnapshot } from "@/lib/execution-agents";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type ExecutionAgentsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionAgentsPage({
  searchParams,
}: {
  searchParams?: ExecutionAgentsSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value
  );
  const initialSnapshot = await buildExecutionAgentsSnapshot();

  return (
    <ExecutionAgentsWorkspace
      initialPreferences={operatorControls.preferences}
      initialSnapshot={initialSnapshot}
      routeScope={readShellRouteScopeFromQueryRecord(params)}
    />
  );
}
