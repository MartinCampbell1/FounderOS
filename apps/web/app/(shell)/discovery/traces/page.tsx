import { cookies } from "next/headers";

import { DiscoveryTracesWorkspace } from "@/components/discovery/discovery-traces-workspace";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type DiscoveryTracesSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function DiscoveryTracesPage({
  searchParams,
}: {
  searchParams?: DiscoveryTracesSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value
  );
  return (
    <DiscoveryTracesWorkspace
      activeIdeaId={null}
      initialSnapshot={null}
      initialPreferences={operatorControls.preferences}
      routeScope={readShellRouteScopeFromQueryRecord(params)}
    />
  );
}
