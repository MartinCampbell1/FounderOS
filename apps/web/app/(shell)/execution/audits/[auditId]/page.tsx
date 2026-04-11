import { ExecutionAuditWorkspace } from "@/components/execution/execution-audit-workspace";
import { buildExecutionAuditSnapshot } from "@/lib/execution-audits";
import {
  resolveShellRoutePageBootstrap,
  type ShellPageSearchParams,
} from "@/lib/shell-route-page-bootstrap";

export default async function ExecutionAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ auditId: string }>;
  searchParams?: ShellPageSearchParams;
}) {
  const { auditId } = await params;
  const { routeScope, initialPreferences } =
    await resolveShellRoutePageBootstrap(searchParams);
  const initialSnapshot = await buildExecutionAuditSnapshot(auditId);

  return (
    <ExecutionAuditWorkspace
      auditId={auditId}
      initialPreferences={initialPreferences}
      initialSnapshot={initialSnapshot}
      routeScope={routeScope}
    />
  );
}
