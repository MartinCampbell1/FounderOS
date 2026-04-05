import { cookies } from "next/headers";

import { DiscoveryIdeaAuthoringWorkspace } from "@/components/discovery/discovery-idea-authoring-workspace";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type DiscoveryIdeaAuthoringSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function DiscoveryIdeaAuthoringPage({
  params,
  searchParams,
}: {
  params: Promise<{ ideaId: string }>;
  searchParams?: DiscoveryIdeaAuthoringSearchParams;
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
    <DiscoveryIdeaAuthoringWorkspace
      activeIdeaId={ideaId}
      initialSnapshot={null}
      initialPreferences={operatorControls.preferences}
      routeScope={readShellRouteScopeFromQueryRecord(query)}
    />
  );
}
