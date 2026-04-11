import { InboxWorkspace } from "@/components/inbox/inbox-workspace";
import {
  resolveShellRoutePageBootstrap,
  type ShellPageSearchParams,
} from "@/lib/shell-route-page-bootstrap";

export default async function InboxPage({
  searchParams,
}: {
  searchParams?: ShellPageSearchParams;
}) {
  const bootstrap = await resolveShellRoutePageBootstrap(searchParams);
  return (
    <InboxWorkspace
      initialSnapshot={null}
      initialPreferences={bootstrap.initialPreferences}
      routeScope={bootstrap.routeScope}
    />
  );
}
