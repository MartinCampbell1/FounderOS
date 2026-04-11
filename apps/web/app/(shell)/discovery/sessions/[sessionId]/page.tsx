import { DiscoveryWorkspace } from "@/components/discovery/discovery-workspace";
import {
  resolveShellRoutePageBootstrap,
  type ShellPageSearchParams,
} from "@/lib/shell-route-page-bootstrap";

export default async function DiscoverySessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams?: ShellPageSearchParams;
}) {
  const [{ sessionId }, bootstrap] = await Promise.all([
    params,
    resolveShellRoutePageBootstrap(searchParams),
  ]);
  return (
    <DiscoveryWorkspace
      activeSessionId={sessionId}
      initialPreferences={bootstrap.initialPreferences}
      initialSnapshot={null}
      routeScope={bootstrap.routeScope}
    />
  );
}
