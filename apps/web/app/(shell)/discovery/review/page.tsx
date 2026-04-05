import { cookies } from "next/headers";

import { DiscoveryReviewWorkspace } from "@/components/discovery/discovery-review-workspace";
import { readDiscoveryReviewFilterFromQueryRecord } from "@/lib/discovery-review-model";
import {
  discoveryReviewFilterFromRememberedPass,
  resolveRememberedReviewPass,
  resolveReviewMemoryBucket,
} from "@/lib/review-memory";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type DiscoveryReviewSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function DiscoveryReviewPage({
  searchParams,
}: {
  searchParams?: DiscoveryReviewSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(params);
  const cookieStore = await cookies();
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value
  );
  const explicitFilter = Array.isArray(params?.filter) ? params?.filter[0] : params?.filter;
  const preferredPass = resolveRememberedReviewPass(
    operatorControls.preferences,
    resolveReviewMemoryBucket({
      scope: routeScope,
      chainRecords: [],
    })
  );
  const initialFilter = explicitFilter
    ? readDiscoveryReviewFilterFromQueryRecord(params)
    : discoveryReviewFilterFromRememberedPass(
        preferredPass,
        resolveReviewMemoryBucket({
          scope: routeScope,
          chainRecords: [],
        })
      );

  return (
    <DiscoveryReviewWorkspace
      initialSnapshot={null}
      initialPreferences={operatorControls.preferences}
      initialFilter={initialFilter}
      routeScope={routeScope}
    />
  );
}
