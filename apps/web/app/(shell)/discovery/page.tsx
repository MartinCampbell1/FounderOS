import { DiscoveryWorkspace } from "@/components/discovery/discovery-workspace";
import {
  resolveShellRoutePageBootstrap,
  type ShellPageSearchParams,
} from "@/lib/shell-route-page-bootstrap";

export default async function DiscoveryPage({
  searchParams,
}: {
  searchParams?: ShellPageSearchParams;
}) {
  const bootstrap = await resolveShellRoutePageBootstrap(searchParams);
  return (
    <DiscoveryWorkspace
      activeSessionId={null}
      initialSnapshot={null}
      initialPreferences={bootstrap.initialPreferences}
      routeScope={bootstrap.routeScope}
    />
  );
}
