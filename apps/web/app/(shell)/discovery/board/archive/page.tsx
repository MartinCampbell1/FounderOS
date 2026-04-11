import { DiscoveryBoardArchiveWorkspace } from "@/components/discovery/discovery-board-archive-workspace";
import { resolveShellRoutePageBootstrap } from "@/lib/shell-route-page-bootstrap";

type DiscoveryBoardArchiveSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function DiscoveryBoardArchivePage({
  searchParams,
}: {
  searchParams?: DiscoveryBoardArchiveSearchParams;
}) {
  const { initialPreferences, routeScope } =
    await resolveShellRoutePageBootstrap(searchParams);
  return (
    <DiscoveryBoardArchiveWorkspace
      initialSnapshot={null}
      initialPreferences={initialPreferences}
      routeScope={routeScope}
    />
  );
}
