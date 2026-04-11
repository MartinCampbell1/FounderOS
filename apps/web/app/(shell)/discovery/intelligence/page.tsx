import { DiscoveryIntelligenceWorkspace } from "@/components/discovery/discovery-intelligence-workspace";
import { buildDiscoveryIntelligenceSnapshot } from "@/lib/discovery-intelligence";
import { resolveShellRoutePageBootstrap } from "@/lib/shell-route-page-bootstrap";

type DiscoveryIntelligenceSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function DiscoveryIntelligencePage({
  searchParams,
}: {
  searchParams?: DiscoveryIntelligenceSearchParams;
}) {
  const { initialPreferences, routeScope } =
    await resolveShellRoutePageBootstrap(searchParams);
  const initialSnapshot = await buildDiscoveryIntelligenceSnapshot(null);

  return (
    <DiscoveryIntelligenceWorkspace
      initialPreferences={initialPreferences}
      initialSnapshot={initialSnapshot}
      routeScope={routeScope}
    />
  );
}
