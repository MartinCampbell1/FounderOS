import { cookies } from "next/headers";

import { ExecutionAuditsWorkspace } from "@/components/execution/execution-audits-workspace";
import { buildExecutionAuditsSnapshot } from "@/lib/execution-audits";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type ExecutionAuditsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionAuditsPage({
  searchParams,
}: {
  searchParams?: ExecutionAuditsSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value
  );
  const initialSnapshot = await buildExecutionAuditsSnapshot();

  return (
    <ExecutionAuditsWorkspace
      initialPreferences={operatorControls.preferences}
      initialSnapshot={initialSnapshot}
      routeScope={readShellRouteScopeFromQueryRecord(params)}
    />
  );
}
