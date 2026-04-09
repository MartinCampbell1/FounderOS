import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";

import { ExecutionHandoffsWorkspace } from "@/components/execution/execution-handoffs-workspace";
import { buildExecutionHandoffsSnapshot } from "@/lib/execution-handoffs";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  isShellAdminTokenAuthorized,
  requiresShellAdminAccess,
} from "@/lib/shell-security";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type ExecutionHandoffsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionHandoffsPage({
  searchParams,
}: {
  searchParams?: ExecutionHandoffsSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const headerStore = await headers();
  const authorization = headerStore.get("authorization") || "";
  const headerToken = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : headerStore.get("x-founderos-shell-admin-token") || "";
  const cookieToken =
    cookieStore.get("founderos-shell-admin-token")?.value || "";
  if (
    requiresShellAdminAccess() &&
    !isShellAdminTokenAuthorized(headerToken || cookieToken)
  ) {
    notFound();
  }
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value,
  );
  const initialSnapshot = await buildExecutionHandoffsSnapshot();

  return (
    <ExecutionHandoffsWorkspace
      initialPreferences={operatorControls.preferences}
      initialSnapshot={initialSnapshot}
      routeScope={readShellRouteScopeFromQueryRecord(params)}
    />
  );
}
