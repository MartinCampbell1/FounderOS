import { cookies } from "next/headers";

import { ExecutionReviewWorkspace } from "@/components/execution/execution-review-workspace";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type ExecutionIssuesSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionIssuesPage({
  searchParams,
}: {
  searchParams?: ExecutionIssuesSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(params);
  const cookieStore = await cookies();
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value
  );

  return (
    <ExecutionReviewWorkspace
      initialSnapshot={null}
      initialPreferences={operatorControls.preferences}
      initialFilter="issues"
      routeScope={routeScope}
    />
  );
}
