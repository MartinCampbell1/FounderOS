import { cookies } from "next/headers";

import { DiscoveryImprovementWorkspace } from "@/components/discovery/discovery-improvement-workspace";
import { buildDiscoveryImprovementSnapshot } from "@/lib/discovery-improvement";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type DiscoveryImprovementSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function DiscoveryImprovementPage({
  searchParams,
}: {
  searchParams?: DiscoveryImprovementSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value
  );
  const initialSnapshot = await buildDiscoveryImprovementSnapshot(null);

  return (
    <DiscoveryImprovementWorkspace
      initialPreferences={operatorControls.preferences}
      initialSnapshot={initialSnapshot}
      routeScope={readShellRouteScopeFromQueryRecord(params)}
    />
  );
}
