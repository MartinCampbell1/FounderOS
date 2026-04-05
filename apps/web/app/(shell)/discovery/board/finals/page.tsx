import { cookies } from "next/headers";

import { DiscoveryBoardFinalsWorkspace } from "@/components/discovery/discovery-board-finals-workspace";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type DiscoveryBoardFinalsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function DiscoveryBoardFinalsPage({
  searchParams,
}: {
  searchParams?: DiscoveryBoardFinalsSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value
  );
  return (
    <DiscoveryBoardFinalsWorkspace
      initialSnapshot={null}
      initialPreferences={operatorControls.preferences}
      routeScope={readShellRouteScopeFromQueryRecord(params)}
    />
  );
}
