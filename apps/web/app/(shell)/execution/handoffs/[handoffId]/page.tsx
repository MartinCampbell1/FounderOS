import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";

import { ExecutionHandoffWorkspace } from "@/components/execution/execution-handoff-workspace";
import { buildExecutionHandoffSnapshot } from "@/lib/execution";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  isShellAdminTokenAuthorized,
  requiresShellAdminAccess,
} from "@/lib/shell-security";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type ExecutionHandoffSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionHandoffPage({
  params,
  searchParams,
}: {
  params: Promise<{ handoffId: string }>;
  searchParams?: ExecutionHandoffSearchParams;
}) {
  const { handoffId } = await params;
  const query = searchParams ? await searchParams : undefined;
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
  const initialSnapshot = await buildExecutionHandoffSnapshot(handoffId);
  return (
    <ExecutionHandoffWorkspace
      handoffId={handoffId}
      initialPreferences={operatorControls.preferences}
      initialSnapshot={initialSnapshot}
      routeScope={readShellRouteScopeFromQueryRecord(query)}
    />
  );
}
