import { cookies } from "next/headers";

import { DiscoveryBoardRankingWorkspace } from "@/components/discovery/discovery-board-ranking-workspace";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type DiscoveryBoardRankingSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function DiscoveryBoardRankingPage({
  searchParams,
}: {
  searchParams?: DiscoveryBoardRankingSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value
  );
  return (
    <DiscoveryBoardRankingWorkspace
      initialPreferences={operatorControls.preferences}
      initialSnapshot={null}
      routeScope={readShellRouteScopeFromQueryRecord(params)}
    />
  );
}
