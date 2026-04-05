import { cookies } from "next/headers";

import { DiscoveryReplaysWorkspace } from "@/components/discovery/discovery-replays-workspace";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type DiscoveryReplaysSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function DiscoveryReplaysPage({
  searchParams,
}: {
  searchParams?: DiscoveryReplaysSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value
  );
  return (
    <DiscoveryReplaysWorkspace
      activeSessionId={null}
      initialSnapshot={null}
      initialPreferences={operatorControls.preferences}
      routeScope={readShellRouteScopeFromQueryRecord(params)}
    />
  );
}
