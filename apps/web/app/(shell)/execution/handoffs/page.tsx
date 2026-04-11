import { ExecutionHandoffsWorkspace } from "@/components/execution/execution-handoffs-workspace";
import { buildExecutionHandoffsSnapshot } from "@/lib/execution-handoffs";
import {
  resolveShellRoutePageBootstrap,
  type ShellPageSearchParams,
} from "@/lib/shell-route-page-bootstrap";

export default async function ExecutionHandoffsPage({
  searchParams,
}: {
  searchParams?: ShellPageSearchParams;
}) {
  const { routeScope, initialPreferences } =
    await resolveShellRoutePageBootstrap(searchParams);
  const initialSnapshot = await buildExecutionHandoffsSnapshot();

  return (
    <ExecutionHandoffsWorkspace
      initialPreferences={initialPreferences}
      initialSnapshot={initialSnapshot}
      routeScope={routeScope}
    />
  );
}
