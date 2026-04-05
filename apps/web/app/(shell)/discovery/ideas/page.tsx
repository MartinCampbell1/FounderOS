import { cookies } from "next/headers";

import { DiscoveryIdeasWorkspace } from "@/components/discovery/discovery-ideas-workspace";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type DiscoveryIdeasSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function DiscoveryIdeasPage({
  searchParams,
}: {
  searchParams?: DiscoveryIdeasSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value
  );
  return (
    <DiscoveryIdeasWorkspace
      activeIdeaId={null}
      initialSnapshot={null}
      initialPreferences={operatorControls.preferences}
      routeScope={readShellRouteScopeFromQueryRecord(params)}
    />
  );
}
