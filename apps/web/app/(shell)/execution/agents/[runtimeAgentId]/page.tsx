import { ExecutionAgentWorkspace } from "@/components/execution/execution-agent-workspace";
import { buildExecutionAgentSnapshot } from "@/lib/execution-agent";
import {
  resolveShellRoutePageBootstrap,
  type ShellPageSearchParams,
} from "@/lib/shell-route-page-bootstrap";

function decodeRouteParam(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default async function ExecutionAgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ runtimeAgentId: string }>;
  searchParams?: ShellPageSearchParams;
}) {
  const resolvedParams = await params;
  const runtimeAgentId = decodeRouteParam(resolvedParams.runtimeAgentId);
  const { routeScope, initialPreferences } =
    await resolveShellRoutePageBootstrap(searchParams);
  const initialSnapshot = await buildExecutionAgentSnapshot(runtimeAgentId);

  return (
    <ExecutionAgentWorkspace
      runtimeAgentId={runtimeAgentId}
      initialPreferences={initialPreferences}
      initialSnapshot={initialSnapshot}
      routeScope={routeScope}
    />
  );
}
