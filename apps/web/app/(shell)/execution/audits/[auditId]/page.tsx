import { cookies } from "next/headers";

import { ExecutionAuditWorkspace } from "@/components/execution/execution-audit-workspace";
import { buildExecutionAuditSnapshot } from "@/lib/execution-audits";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type ExecutionAuditSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ auditId: string }>;
  searchParams?: ExecutionAuditSearchParams;
}) {
  const { auditId } = await params;
  const query = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value
  );
  const initialSnapshot = await buildExecutionAuditSnapshot(auditId);

  return (
    <ExecutionAuditWorkspace
      auditId={auditId}
      initialPreferences={operatorControls.preferences}
      initialSnapshot={initialSnapshot}
      routeScope={readShellRouteScopeFromQueryRecord(query)}
    />
  );
}
