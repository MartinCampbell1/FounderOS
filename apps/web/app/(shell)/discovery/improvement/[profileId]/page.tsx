import { DiscoveryImprovementWorkspace } from "@/components/discovery/discovery-improvement-workspace";
import { buildDiscoveryImprovementSnapshot } from "@/lib/discovery-improvement";
import {
  resolveShellRoutePageBootstrap,
  type ShellPageSearchParams,
} from "@/lib/shell-route-page-bootstrap";

export default async function DiscoveryImprovementDetailPage({
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
  const initialSnapshot = await buildDiscoveryImprovementSnapshot(profileId);

  return (
    <DiscoveryImprovementWorkspace
      profileId={profileId}
      initialPreferences={bootstrap.initialPreferences}
      initialSnapshot={initialSnapshot}
      routeScope={bootstrap.routeScope}
    />
  );
}
