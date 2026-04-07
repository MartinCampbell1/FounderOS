import { cookies } from "next/headers";

import { DiscoveryIntelligenceWorkspace } from "@/components/discovery/discovery-intelligence-workspace";
import { buildDiscoveryIntelligenceSnapshot } from "@/lib/discovery-intelligence";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type DiscoveryIntelligenceDetailSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function DiscoveryIntelligenceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ profileId: string }>;
  searchParams?: DiscoveryIntelligenceDetailSearchParams;
}) {
  const [{ profileId }, resolvedSearchParams, cookieStore] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(undefined),
    cookies(),
  ]);
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value
  );
  const initialSnapshot = await buildDiscoveryIntelligenceSnapshot(profileId);

  return (
    <DiscoveryIntelligenceWorkspace
      profileId={profileId}
      initialPreferences={operatorControls.preferences}
      initialSnapshot={initialSnapshot}
      routeScope={readShellRouteScopeFromQueryRecord(resolvedSearchParams)}
    />
  );
}
