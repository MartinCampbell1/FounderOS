import { cookies } from "next/headers";

import { ReviewWorkspace } from "@/components/review/review-workspace";
import {
  normalizeReviewCenterLane,
  readReviewCenterLaneFromQueryRecord,
} from "@/lib/review-center";
import { readReviewPresetFromQueryRecord } from "@/lib/review-presets";
import {
  resolveRememberedReviewPass,
  resolveReviewMemoryBucket,
} from "@/lib/review-memory";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type ReviewSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ReviewPage({
  searchParams,
}: {
  searchParams?: ReviewSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(params);
  const cookieStore = await cookies();
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value
  );
  const preferredReviewPass = resolveRememberedReviewPass(
    operatorControls.preferences,
    resolveReviewMemoryBucket({
      scope: routeScope,
      chainRecords: [],
      executionChainKinds: [],
    })
  );
  const explicitLane = Array.isArray(params?.lane) ? params?.lane[0] : params?.lane;
  const explicitPreset = Array.isArray(params?.preset)
    ? params?.preset[0]
    : params?.preset;
  const initialLane = explicitLane
    ? readReviewCenterLaneFromQueryRecord(params)
    : normalizeReviewCenterLane(preferredReviewPass.lane);
  const initialPreset = explicitPreset
    ? readReviewPresetFromQueryRecord(params)
    : preferredReviewPass.preset;

  return (
    <ReviewWorkspace
      initialSnapshot={null}
      initialPreferences={operatorControls.preferences}
      initialLane={initialLane}
      initialPreset={initialPreset}
      routeScope={routeScope}
    />
  );
}
