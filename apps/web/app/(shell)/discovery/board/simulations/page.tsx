import { DiscoveryBoardSimulationsWorkspace } from "@/components/discovery/discovery-board-simulations-workspace";
import { resolveShellRoutePageBootstrap } from "@/lib/shell-route-page-bootstrap";

type DiscoveryBoardSimulationsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function DiscoveryBoardSimulationsPage({
  searchParams,
}: {
  searchParams?: DiscoveryBoardSimulationsSearchParams;
}) {
  const { initialPreferences, routeScope } =
    await resolveShellRoutePageBootstrap(searchParams);
  return (
    <DiscoveryBoardSimulationsWorkspace
      activeIdeaId={null}
      initialSnapshot={null}
      initialPreferences={initialPreferences}
      routeScope={routeScope}
    />
  );
}
