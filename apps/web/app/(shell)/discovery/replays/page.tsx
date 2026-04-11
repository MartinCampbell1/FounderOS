import { DiscoveryReplaysWorkspace } from "@/components/discovery/discovery-replays-workspace";
import { resolveShellRoutePageBootstrap } from "@/lib/shell-route-page-bootstrap";

type DiscoveryReplaysSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function DiscoveryReplaysPage({
  searchParams,
}: {
  searchParams?: DiscoveryReplaysSearchParams;
}) {
  const { initialPreferences, routeScope } =
    await resolveShellRoutePageBootstrap(searchParams);
  return (
    <DiscoveryReplaysWorkspace
      activeSessionId={null}
      initialSnapshot={null}
      initialPreferences={initialPreferences}
      routeScope={routeScope}
    />
  );
}
