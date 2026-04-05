import { cookies } from "next/headers";

import { ExecutionIntakeWorkspace } from "@/components/execution/execution-intake-workspace";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type ExecutionIntakeSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionIntakePage({
  searchParams,
}: {
  searchParams?: ExecutionIntakeSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value
  );
  return (
    <ExecutionIntakeWorkspace
      initialPreferences={operatorControls.preferences}
      initialSnapshot={null}
      requestedSessionId={null}
      routeScope={readShellRouteScopeFromQueryRecord(params)}
    />
  );
}
