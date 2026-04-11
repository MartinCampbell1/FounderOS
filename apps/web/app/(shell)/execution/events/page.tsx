import { ExecutionEventsWorkspace } from "@/components/execution/execution-events-workspace";
import { buildExecutionEventsSnapshot } from "@/lib/execution-events";
import { readExecutionEventsRouteBootstrap } from "@/lib/execution-events-route-bootstrap";
import {
  resolveShellRoutePageBootstrap,
  type ShellPageSearchParams,
} from "@/lib/shell-route-page-bootstrap";

type ExecutionEventsSearchParams = ShellPageSearchParams;

export default async function ExecutionEventsPage({
  searchParams,
}: {
  searchParams?: ExecutionEventsSearchParams;
}) {
  const { query, initialPreferences } =
    await resolveShellRoutePageBootstrap(searchParams);
  const bootstrap = readExecutionEventsRouteBootstrap(query);
  const initialSnapshot = await buildExecutionEventsSnapshot(bootstrap.snapshotFilters);

  return (
    <ExecutionEventsWorkspace
      initialPreferences={initialPreferences}
      initialSnapshot={initialSnapshot}
      routeScope={bootstrap.routeScope}
      initialFilters={bootstrap.initialFilters}
    />
  );
}
