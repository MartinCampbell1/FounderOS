import { DiscoveryBoardRankingWorkspace } from "@/components/discovery/discovery-board-ranking-workspace";
import { resolveShellRoutePageBootstrap } from "@/lib/shell-route-page-bootstrap";

type DiscoveryBoardRankingSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function DiscoveryBoardRankingPage({
  searchParams,
}: {
  searchParams?: DiscoveryBoardRankingSearchParams;
}) {
  const { initialPreferences, routeScope } =
    await resolveShellRoutePageBootstrap(searchParams);
  return (
    <DiscoveryBoardRankingWorkspace
      initialPreferences={initialPreferences}
      initialSnapshot={null}
      routeScope={routeScope}
    />
  );
}
