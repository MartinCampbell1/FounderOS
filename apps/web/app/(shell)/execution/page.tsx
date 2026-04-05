import { cookies } from "next/headers";

import { ExecutionWorkspace } from "@/components/execution/execution-workspace";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type ExecutionSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionPage({
  searchParams,
}: {
  searchParams?: ExecutionSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(params);
  const cookieStore = await cookies();
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value
  );
  const activeProjectId = routeScope.projectId || null;

  return (
    <ExecutionWorkspace
      activeProjectId={activeProjectId}
      initialSnapshot={null}
      initialPreferences={operatorControls.preferences}
      routeScope={routeScope}
    />
  );
}
