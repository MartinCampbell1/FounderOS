import { ExecutionReviewWorkspace } from "@/components/execution/execution-review-workspace";
import type { ExecutionReviewFilter } from "@/lib/execution-review-model";
import { resolveReviewPageBootstrap } from "@/lib/review-page-bootstrap";

type ExecutionIssuesSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionIssuesPage({
  searchParams,
}: {
  searchParams?: ExecutionIssuesSearchParams;
}) {
  const bootstrap = await resolveReviewPageBootstrap<ExecutionReviewFilter>({
    searchParams,
    fixedFilter: "issues",
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
