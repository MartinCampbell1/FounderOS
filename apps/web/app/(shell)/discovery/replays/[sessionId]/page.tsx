import { cookies } from "next/headers";

import { DiscoveryReplaysWorkspace } from "@/components/discovery/discovery-replays-workspace";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type DiscoveryReplaySessionSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function DiscoveryReplaySessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams?: DiscoveryReplaySessionSearchParams;
}) {
  const [{ sessionId }, query] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(undefined),
  ]);
  const cookieStore = await cookies();
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value
  );
  return (
    <DiscoveryReplaysWorkspace
      activeSessionId={sessionId}
      initialPreferences={operatorControls.preferences}
      initialSnapshot={null}
      routeScope={readShellRouteScopeFromQueryRecord(query)}
    />
  );
}
