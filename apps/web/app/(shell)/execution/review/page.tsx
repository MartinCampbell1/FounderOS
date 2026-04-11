import { ExecutionReviewWorkspace } from "@/components/execution/execution-review-workspace";
import { readExecutionReviewFilterFromQueryRecord } from "@/lib/execution-review-model";
import {
  executionReviewFilterFromRememberedPass,
} from "@/lib/review-memory";
import { resolveReviewPageBootstrap } from "@/lib/review-page-bootstrap";

type ExecutionReviewSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionReviewPage({
  searchParams,
}: {
  searchParams?: ExecutionReviewSearchParams;
}) {
  const bootstrap = await resolveReviewPageBootstrap({
    searchParams,
    memoryBucketArgs: {
      executionChainKinds: [],
    },
    readFilterFromQueryRecord: readExecutionReviewFilterFromQueryRecord,
    rememberedPassToFilter: executionReviewFilterFromRememberedPass,
  });

  return (
    <ExecutionReviewWorkspace
      initialSnapshot={null}
      initialPreferences={bootstrap.initialPreferences}
      initialFilter={bootstrap.initialFilter}
      routeScope={bootstrap.routeScope}
    />
  );
}
