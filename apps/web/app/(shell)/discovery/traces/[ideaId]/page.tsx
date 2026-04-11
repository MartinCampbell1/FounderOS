import { DiscoveryTracesWorkspace } from "@/components/discovery/discovery-traces-workspace";
import {
  resolveShellRoutePageBootstrap,
  type ShellPageSearchParams,
} from "@/lib/shell-route-page-bootstrap";

export default async function DiscoveryTraceIdeaPage({
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
    <DiscoveryTracesWorkspace
      activeIdeaId={ideaId}
      initialPreferences={bootstrap.initialPreferences}
      initialSnapshot={null}
      routeScope={bootstrap.routeScope}
    />
  );
}
