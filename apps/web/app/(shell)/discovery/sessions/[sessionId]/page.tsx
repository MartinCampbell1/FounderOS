import { cookies } from "next/headers";

import { DiscoveryWorkspace } from "@/components/discovery/discovery-workspace";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type DiscoverySessionSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function DiscoverySessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams?: DiscoverySessionSearchParams;
}) {
  const { sessionId } = await params;
  const query = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value
  );
  return (
    <DiscoveryWorkspace
      activeSessionId={sessionId}
      initialPreferences={operatorControls.preferences}
      initialSnapshot={null}
      routeScope={readShellRouteScopeFromQueryRecord(query)}
    />
  );
}
