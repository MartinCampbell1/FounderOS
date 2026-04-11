import { DiscoveryReplaysWorkspace } from "@/components/discovery/discovery-replays-workspace";
import {
  resolveShellRoutePageBootstrap,
  type ShellPageSearchParams,
} from "@/lib/shell-route-page-bootstrap";

export default async function DiscoveryReplaySessionPage({
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
    <DiscoveryReplaysWorkspace
      activeSessionId={sessionId}
      initialPreferences={bootstrap.initialPreferences}
      initialSnapshot={null}
      routeScope={bootstrap.routeScope}
    />
  );
}
