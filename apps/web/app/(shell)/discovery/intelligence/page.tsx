import { cookies } from "next/headers";

import { DiscoveryIntelligenceWorkspace } from "@/components/discovery/discovery-intelligence-workspace";
import { buildDiscoveryIntelligenceSnapshot } from "@/lib/discovery-intelligence";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type DiscoveryIntelligenceSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function DiscoveryIntelligencePage({
  searchParams,
}: {
  searchParams?: DiscoveryIntelligenceSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value
  );
  const initialSnapshot = await buildDiscoveryIntelligenceSnapshot(null);

  return (
    <DiscoveryIntelligenceWorkspace
      initialPreferences={operatorControls.preferences}
      initialSnapshot={initialSnapshot}
      routeScope={readShellRouteScopeFromQueryRecord(params)}
    />
  );
}
