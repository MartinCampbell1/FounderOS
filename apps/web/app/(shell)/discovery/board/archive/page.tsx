import { cookies } from "next/headers";

import { DiscoveryBoardArchiveWorkspace } from "@/components/discovery/discovery-board-archive-workspace";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type DiscoveryBoardArchiveSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function DiscoveryBoardArchivePage({
  searchParams,
}: {
  searchParams?: DiscoveryBoardArchiveSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value
  );
  return (
    <DiscoveryBoardArchiveWorkspace
      initialSnapshot={null}
      initialPreferences={operatorControls.preferences}
      routeScope={readShellRouteScopeFromQueryRecord(params)}
    />
  );
}
