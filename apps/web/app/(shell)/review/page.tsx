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
import {
  resolveShellRoutePageBootstrap,
  type ShellPageSearchParams,
} from "@/lib/shell-route-page-bootstrap";

type ReviewSearchParams = ShellPageSearchParams;

export default async function ReviewPage({
  searchParams,
}: {
  searchParams?: ReviewSearchParams;
}) {
  const { query: params, routeScope, initialPreferences } =
    await resolveShellRoutePageBootstrap(searchParams);
  const preferredReviewPass = resolveRememberedReviewPass(
    initialPreferences,
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
      initialPreferences={initialPreferences}
      initialLane={initialLane}
      initialPreset={initialPreset}
      routeScope={routeScope}
    />
  );
}
