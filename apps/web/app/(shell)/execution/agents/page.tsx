import { ExecutionAgentsWorkspace } from "@/components/execution/execution-agents-workspace";
import { buildExecutionAgentsSnapshot } from "@/lib/execution-agents";
import {
  resolveShellRoutePageBootstrap,
  type ShellPageSearchParams,
} from "@/lib/shell-route-page-bootstrap";

export default async function ExecutionAgentsPage({
  searchParams,
}: {
  searchParams?: ShellPageSearchParams;
}) {
  const { routeScope, initialPreferences } =
    await resolveShellRoutePageBootstrap(searchParams);
  const initialSnapshot = await buildExecutionAgentsSnapshot();

  return (
    <ExecutionAgentsWorkspace
      initialPreferences={initialPreferences}
      initialSnapshot={initialSnapshot}
      routeScope={routeScope}
    />
  );
}
