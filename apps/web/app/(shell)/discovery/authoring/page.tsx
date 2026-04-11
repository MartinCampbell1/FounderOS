import { DiscoveryAuthoringQueueWorkspace } from "@/components/discovery/discovery-authoring-queue-workspace";
import {
  resolveShellRoutePageBootstrap,
  type ShellPageSearchParams,
} from "@/lib/shell-route-page-bootstrap";

export default async function DiscoveryAuthoringQueuePage({
  searchParams,
}: {
  searchParams?: ShellPageSearchParams;
}) {
  const bootstrap = await resolveShellRoutePageBootstrap(searchParams);
  return (
    <DiscoveryAuthoringQueueWorkspace
      initialSnapshot={null}
      initialPreferences={bootstrap.initialPreferences}
      routeScope={bootstrap.routeScope}
    />
  );
}
