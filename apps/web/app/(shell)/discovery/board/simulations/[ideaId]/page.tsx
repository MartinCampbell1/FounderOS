import { cookies } from "next/headers";

import { DiscoveryBoardSimulationsWorkspace } from "@/components/discovery/discovery-board-simulations-workspace";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type DiscoveryBoardSimulationIdeaSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function DiscoveryBoardSimulationIdeaPage({
  params,
  searchParams,
}: {
  params: Promise<{ ideaId: string }>;
  searchParams?: DiscoveryBoardSimulationIdeaSearchParams;
}) {
  const [{ ideaId }, query] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(undefined),
  ]);
  const cookieStore = await cookies();
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value
  );
  return (
    <DiscoveryBoardSimulationsWorkspace
      activeIdeaId={ideaId}
      initialSnapshot={null}
      initialPreferences={operatorControls.preferences}
      routeScope={readShellRouteScopeFromQueryRecord(query)}
    />
  );
}
