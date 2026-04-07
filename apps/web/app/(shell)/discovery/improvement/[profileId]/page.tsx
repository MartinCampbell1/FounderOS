import { cookies } from "next/headers";

import { DiscoveryImprovementWorkspace } from "@/components/discovery/discovery-improvement-workspace";
import { buildDiscoveryImprovementSnapshot } from "@/lib/discovery-improvement";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type DiscoveryImprovementDetailSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function DiscoveryImprovementDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ profileId: string }>;
  searchParams?: DiscoveryImprovementDetailSearchParams;
}) {
  const [{ profileId }, resolvedSearchParams, cookieStore] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(undefined),
    cookies(),
  ]);
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value
  );
  const initialSnapshot = await buildDiscoveryImprovementSnapshot(profileId);

  return (
    <DiscoveryImprovementWorkspace
      profileId={profileId}
      initialPreferences={operatorControls.preferences}
      initialSnapshot={initialSnapshot}
      routeScope={readShellRouteScopeFromQueryRecord(resolvedSearchParams)}
    />
  );
}
