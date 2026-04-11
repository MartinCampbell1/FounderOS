import { PortfolioWorkspace } from "@/components/portfolio/portfolio-workspace";
import {
  resolveShellRoutePageBootstrap,
  type ShellPageSearchParams,
} from "@/lib/shell-route-page-bootstrap";

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams?: ShellPageSearchParams;
}) {
  const bootstrap = await resolveShellRoutePageBootstrap(searchParams);
  return (
    <PortfolioWorkspace
      initialSnapshot={null}
      initialPreferences={bootstrap.initialPreferences}
      routeScope={bootstrap.routeScope}
    />
  );
}
