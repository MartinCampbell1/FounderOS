import { cookies } from "next/headers";

import { ExecutionReviewWorkspace } from "@/components/execution/execution-review-workspace";
import { readExecutionReviewFilterFromQueryRecord } from "@/lib/execution-review-model";
import {
  executionReviewFilterFromRememberedPass,
  resolveRememberedReviewPass,
  resolveReviewMemoryBucket,
} from "@/lib/review-memory";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type ExecutionReviewSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionReviewPage({
  searchParams,
}: {
  searchParams?: ExecutionReviewSearchParams;
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
      executionChainKinds: [],
    })
  );
  const initialFilter = explicitFilter
    ? readExecutionReviewFilterFromQueryRecord(params)
    : executionReviewFilterFromRememberedPass(
        preferredPass,
        resolveReviewMemoryBucket({
          scope: routeScope,
          executionChainKinds: [],
        })
      );

  return (
    <ExecutionReviewWorkspace
      initialSnapshot={null}
      initialPreferences={operatorControls.preferences}
      initialFilter={initialFilter}
      routeScope={routeScope}
    />
  );
}
