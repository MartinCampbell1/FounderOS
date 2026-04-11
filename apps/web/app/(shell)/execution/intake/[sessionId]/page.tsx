import { ExecutionIntakeWorkspace } from "@/components/execution/execution-intake-workspace";
import {
  resolveShellRoutePageBootstrap,
  type ShellPageSearchParams,
} from "@/lib/shell-route-page-bootstrap";

export default async function ExecutionIntakeSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams?: ShellPageSearchParams;
}) {
  const { sessionId } = await params;
  const { routeScope, initialPreferences } =
    await resolveShellRoutePageBootstrap(searchParams);
  return (
    <ExecutionIntakeWorkspace
      initialPreferences={initialPreferences}
      initialSnapshot={null}
      requestedSessionId={sessionId}
      routeScope={routeScope}
    />
  );
}
