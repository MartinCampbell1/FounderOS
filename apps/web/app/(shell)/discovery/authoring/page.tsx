import { cookies } from "next/headers";

import { DiscoveryAuthoringQueueWorkspace } from "@/components/discovery/discovery-authoring-queue-workspace";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type DiscoveryAuthoringQueueSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function DiscoveryAuthoringQueuePage({
  searchParams,
}: {
  searchParams?: DiscoveryAuthoringQueueSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value
  );
  return (
    <DiscoveryAuthoringQueueWorkspace
      initialSnapshot={null}
      initialPreferences={operatorControls.preferences}
      routeScope={readShellRouteScopeFromQueryRecord(params)}
    />
  );
}
