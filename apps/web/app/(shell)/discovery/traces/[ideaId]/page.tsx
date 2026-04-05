import { cookies } from "next/headers";

import { DiscoveryTracesWorkspace } from "@/components/discovery/discovery-traces-workspace";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type DiscoveryTraceIdeaSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function DiscoveryTraceIdeaPage({
  params,
  searchParams,
}: {
  params: Promise<{ ideaId: string }>;
  searchParams?: DiscoveryTraceIdeaSearchParams;
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
    <DiscoveryTracesWorkspace
      activeIdeaId={ideaId}
      initialPreferences={operatorControls.preferences}
      initialSnapshot={null}
      routeScope={readShellRouteScopeFromQueryRecord(query)}
    />
  );
}
