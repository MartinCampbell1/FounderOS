import { DiscoveryTracesWorkspace } from "@/components/discovery/discovery-traces-workspace";
import { resolveShellRoutePageBootstrap } from "@/lib/shell-route-page-bootstrap";

type DiscoveryTracesSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function DiscoveryTracesPage({
  searchParams,
}: {
  searchParams?: DiscoveryTracesSearchParams;
}) {
  const { initialPreferences, routeScope } =
    await resolveShellRoutePageBootstrap(searchParams);
  return (
    <DiscoveryTracesWorkspace
      activeIdeaId={null}
      initialSnapshot={null}
      initialPreferences={initialPreferences}
      routeScope={routeScope}
    />
  );
}
