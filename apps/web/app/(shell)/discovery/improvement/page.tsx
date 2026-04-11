import { DiscoveryImprovementWorkspace } from "@/components/discovery/discovery-improvement-workspace";
import { buildDiscoveryImprovementSnapshot } from "@/lib/discovery-improvement";
import { resolveShellRoutePageBootstrap } from "@/lib/shell-route-page-bootstrap";

type DiscoveryImprovementSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function DiscoveryImprovementPage({
  searchParams,
}: {
  searchParams?: DiscoveryImprovementSearchParams;
}) {
  const { initialPreferences, routeScope } =
    await resolveShellRoutePageBootstrap(searchParams);
  const initialSnapshot = await buildDiscoveryImprovementSnapshot(null);

  return (
    <DiscoveryImprovementWorkspace
      initialPreferences={initialPreferences}
      initialSnapshot={initialSnapshot}
      routeScope={routeScope}
    />
  );
}
