import { DiscoveryBoardWorkspace } from "@/components/discovery/discovery-board-workspace";
import { resolveShellRoutePageBootstrap } from "@/lib/shell-route-page-bootstrap";

type DiscoveryBoardSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function DiscoveryBoardPage({
  searchParams,
}: {
  searchParams?: DiscoveryBoardSearchParams;
}) {
  const { initialPreferences, routeScope } =
    await resolveShellRoutePageBootstrap(searchParams);
  return (
    <DiscoveryBoardWorkspace
      initialSnapshot={null}
      initialPreferences={initialPreferences}
      routeScope={routeScope}
    />
  );
}
