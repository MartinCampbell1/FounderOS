import { ExecutionHandoffWorkspace } from "@/components/execution/execution-handoff-workspace";
import { buildExecutionHandoffSnapshot } from "@/lib/execution";
import {
  resolveShellRoutePageBootstrap,
  type ShellPageSearchParams,
} from "@/lib/shell-route-page-bootstrap";

export default async function ExecutionHandoffPage({
  params,
  searchParams,
}: {
  params: Promise<{ handoffId: string }>;
  searchParams?: ShellPageSearchParams;
}) {
  const { handoffId } = await params;
  const { routeScope, initialPreferences } =
    await resolveShellRoutePageBootstrap(searchParams);
  const initialSnapshot = await buildExecutionHandoffSnapshot(handoffId);
  return (
    <ExecutionHandoffWorkspace
      handoffId={handoffId}
      initialPreferences={initialPreferences}
      initialSnapshot={initialSnapshot}
      routeScope={routeScope}
    />
  );
}
