import { DiscoveryReviewWorkspace } from "@/components/discovery/discovery-review-workspace";
import { readDiscoveryReviewFilterFromQueryRecord } from "@/lib/discovery-review-model";
import {
  discoveryReviewFilterFromRememberedPass,
} from "@/lib/review-memory";
import { resolveReviewPageBootstrap } from "@/lib/review-page-bootstrap";

type DiscoveryReviewSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function DiscoveryReviewPage({
  searchParams,
}: {
  searchParams?: DiscoveryReviewSearchParams;
}) {
  const bootstrap = await resolveReviewPageBootstrap({
    searchParams,
    memoryBucketArgs: {
      chainRecords: [],
    },
    readFilterFromQueryRecord: readDiscoveryReviewFilterFromQueryRecord,
    rememberedPassToFilter: discoveryReviewFilterFromRememberedPass,
  });

  return (
    <DiscoveryReviewWorkspace
      initialSnapshot={null}
      initialPreferences={bootstrap.initialPreferences}
      initialFilter={bootstrap.initialFilter}
      routeScope={bootstrap.routeScope}
    />
  );
}
