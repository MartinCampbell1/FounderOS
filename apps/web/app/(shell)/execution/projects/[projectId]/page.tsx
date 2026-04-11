import { ExecutionWorkspace } from "@/components/execution/execution-workspace";
import {
  resolveShellRoutePageBootstrap,
  type ShellPageSearchParams,
} from "@/lib/shell-route-page-bootstrap";

export default async function ExecutionProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams?: ShellPageSearchParams;
}) {
  const { projectId } = await params;
  const { routeScope, initialPreferences } =
    await resolveShellRoutePageBootstrap(searchParams);
  return (
    <ExecutionWorkspace
      activeProjectId={projectId}
      initialPreferences={initialPreferences}
      initialSnapshot={null}
      routeScope={routeScope}
    />
  );
}
