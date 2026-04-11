import { ExecutionWorkspace } from "@/components/execution/execution-workspace";
import {
  resolveShellRoutePageBootstrap,
  type ShellPageSearchParams,
} from "@/lib/shell-route-page-bootstrap";

export default async function ExecutionPage({
  searchParams,
}: {
  searchParams?: ShellPageSearchParams;
}) {
  const { routeScope, initialPreferences } =
    await resolveShellRoutePageBootstrap(searchParams);
  const activeProjectId = routeScope.projectId || null;

  return (
    <ExecutionWorkspace
      activeProjectId={activeProjectId}
      initialSnapshot={null}
      initialPreferences={initialPreferences}
      routeScope={routeScope}
    />
  );
}
