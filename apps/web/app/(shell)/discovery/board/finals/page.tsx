import { DiscoveryBoardFinalsWorkspace } from "@/components/discovery/discovery-board-finals-workspace";
import { resolveShellRoutePageBootstrap } from "@/lib/shell-route-page-bootstrap";

type DiscoveryBoardFinalsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function DiscoveryBoardFinalsPage({
  searchParams,
}: {
  searchParams?: DiscoveryBoardFinalsSearchParams;
}) {
  const { initialPreferences, routeScope } =
    await resolveShellRoutePageBootstrap(searchParams);
  return (
    <DiscoveryBoardFinalsWorkspace
      initialSnapshot={null}
      initialPreferences={initialPreferences}
      routeScope={routeScope}
    />
  );
}
