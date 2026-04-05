import { cookies } from "next/headers";

import { ExecutionWorkspace } from "@/components/execution/execution-workspace";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type ExecutionProjectSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams?: ExecutionProjectSearchParams;
}) {
  const { projectId } = await params;
  const query = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value
  );
  return (
    <ExecutionWorkspace
      activeProjectId={projectId}
      initialPreferences={operatorControls.preferences}
      initialSnapshot={null}
      routeScope={readShellRouteScopeFromQueryRecord(query)}
    />
  );
}
