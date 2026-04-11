import { DiscoveryBoardSimulationsWorkspace } from "@/components/discovery/discovery-board-simulations-workspace";
import {
  resolveShellRoutePageBootstrap,
  type ShellPageSearchParams,
} from "@/lib/shell-route-page-bootstrap";

export default async function DiscoveryBoardSimulationIdeaPage({
  params,
  searchParams,
}: {
  params: Promise<{ ideaId: string }>;
  searchParams?: ShellPageSearchParams;
}) {
  const [{ ideaId }, bootstrap] = await Promise.all([
    params,
    resolveShellRoutePageBootstrap(searchParams),
  ]);
  return (
    <DiscoveryBoardSimulationsWorkspace
      activeIdeaId={ideaId}
      initialSnapshot={null}
      initialPreferences={bootstrap.initialPreferences}
      routeScope={bootstrap.routeScope}
    />
  );
}
