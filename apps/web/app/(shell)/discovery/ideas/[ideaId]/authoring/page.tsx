import { DiscoveryIdeaAuthoringWorkspace } from "@/components/discovery/discovery-idea-authoring-workspace";
import {
  resolveShellRoutePageBootstrap,
  type ShellPageSearchParams,
} from "@/lib/shell-route-page-bootstrap";

export default async function DiscoveryIdeaAuthoringPage({
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
    <DiscoveryIdeaAuthoringWorkspace
      activeIdeaId={ideaId}
      initialSnapshot={null}
      initialPreferences={bootstrap.initialPreferences}
      routeScope={bootstrap.routeScope}
    />
  );
}
