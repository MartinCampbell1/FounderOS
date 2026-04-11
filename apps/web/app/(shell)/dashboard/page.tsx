import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";
import {
  resolveShellRoutePageBootstrap,
  type ShellPageSearchParams,
} from "@/lib/shell-route-page-bootstrap";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: ShellPageSearchParams;
}) {
  const bootstrap = await resolveShellRoutePageBootstrap(searchParams);
  return (
    <DashboardWorkspace
      initialSnapshot={null}
      initialPreferences={bootstrap.initialPreferences}
      routeScope={bootstrap.routeScope}
    />
  );
}
