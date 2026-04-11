import { ExecutionIntakeWorkspace } from "@/components/execution/execution-intake-workspace";
import {
  resolveShellRoutePageBootstrap,
  type ShellPageSearchParams,
} from "@/lib/shell-route-page-bootstrap";

export default async function ExecutionIntakePage({
  searchParams,
}: {
  searchParams?: ShellPageSearchParams;
}) {
  const { routeScope, initialPreferences } =
    await resolveShellRoutePageBootstrap(searchParams);
  return (
    <ExecutionIntakeWorkspace
      initialPreferences={initialPreferences}
      initialSnapshot={null}
      requestedSessionId={null}
      routeScope={routeScope}
    />
  );
}
