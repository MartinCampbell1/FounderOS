import { ExecutionAuditsWorkspace } from "@/components/execution/execution-audits-workspace";
import { buildExecutionAuditsSnapshot } from "@/lib/execution-audits";
import {
  resolveShellRoutePageBootstrap,
  type ShellPageSearchParams,
} from "@/lib/shell-route-page-bootstrap";

export default async function ExecutionAuditsPage({
  searchParams,
}: {
  searchParams?: ShellPageSearchParams;
}) {
  const { routeScope, initialPreferences } =
    await resolveShellRoutePageBootstrap(searchParams);
  const initialSnapshot = await buildExecutionAuditsSnapshot();

  return (
    <ExecutionAuditsWorkspace
      initialPreferences={initialPreferences}
      initialSnapshot={initialSnapshot}
      routeScope={routeScope}
    />
  );
}
