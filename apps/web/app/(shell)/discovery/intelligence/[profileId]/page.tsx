import { DiscoveryIntelligenceWorkspace } from "@/components/discovery/discovery-intelligence-workspace";
import { buildDiscoveryIntelligenceSnapshot } from "@/lib/discovery-intelligence";
import {
  resolveShellRoutePageBootstrap,
  type ShellPageSearchParams,
} from "@/lib/shell-route-page-bootstrap";

export default async function DiscoveryIntelligenceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ profileId: string }>;
  searchParams?: ShellPageSearchParams;
}) {
  const [{ profileId }, bootstrap] = await Promise.all([
    params,
    resolveShellRoutePageBootstrap(searchParams),
  ]);
  const initialSnapshot = await buildDiscoveryIntelligenceSnapshot(profileId);

  return (
    <DiscoveryIntelligenceWorkspace
      profileId={profileId}
      initialPreferences={bootstrap.initialPreferences}
      initialSnapshot={initialSnapshot}
      routeScope={bootstrap.routeScope}
    />
  );
}
