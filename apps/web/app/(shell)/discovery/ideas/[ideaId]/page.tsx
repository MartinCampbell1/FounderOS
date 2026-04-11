import { DiscoveryIdeasWorkspace } from "@/components/discovery/discovery-ideas-workspace";
import {
  resolveShellRoutePageBootstrap,
  type ShellPageSearchParams,
} from "@/lib/shell-route-page-bootstrap";

export default async function DiscoveryIdeaPage({
  params,
  searchParams,
}: {
  params: Promise<{ ideaId: string }>;
  searchParams?: ShellPageSearchParams;
}) {
  const [{ ideaId }, bootstrap] = await Promise.all([
    params,
    resolveShellRoutePageBootstrap(searchParams),
  ]);
  return (
    <DiscoveryIdeasWorkspace
      activeIdeaId={ideaId}
      initialPreferences={bootstrap.initialPreferences}
      initialSnapshot={null}
      routeScope={bootstrap.routeScope}
    />
  );
}
