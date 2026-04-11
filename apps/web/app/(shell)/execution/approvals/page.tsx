import { ExecutionReviewWorkspace } from "@/components/execution/execution-review-workspace";
import type { ExecutionReviewFilter } from "@/lib/execution-review-model";
import { resolveReviewPageBootstrap } from "@/lib/review-page-bootstrap";

type ExecutionApprovalsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionApprovalsPage({
  searchParams,
}: {
  searchParams?: ExecutionApprovalsSearchParams;
}) {
  const bootstrap = await resolveReviewPageBootstrap<ExecutionReviewFilter>({
    searchParams,
    fixedFilter: "approvals",
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
