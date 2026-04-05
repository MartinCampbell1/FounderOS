import { cookies } from "next/headers";

import { DiscoveryBoardWorkspace } from "@/components/discovery/discovery-board-workspace";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type DiscoveryBoardSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function DiscoveryBoardPage({
  searchParams,
}: {
  searchParams?: DiscoveryBoardSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value
  );
  return (
    <DiscoveryBoardWorkspace
      initialSnapshot={null}
      initialPreferences={operatorControls.preferences}
      routeScope={readShellRouteScopeFromQueryRecord(params)}
    />
  );
}
