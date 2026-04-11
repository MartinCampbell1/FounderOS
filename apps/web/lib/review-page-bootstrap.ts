import {
  resolveRememberedReviewPass,
  resolveReviewMemoryBucket,
} from "@/lib/review-memory";
import {
  resolveShellRoutePageBootstrap,
  type ShellPageQueryRecord,
  type ShellPageSearchParams,
} from "@/lib/shell-route-page-bootstrap";

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export async function resolveReviewPageBootstrap<TFilter>(args: {
  searchParams?: ShellPageSearchParams;
  memoryBucketArgs?: Parameters<typeof resolveReviewMemoryBucket>[0];
  readFilterFromQueryRecord?: (params?: ShellPageQueryRecord | null) => TFilter;
  rememberedPassToFilter?: (
    pass: ReturnType<typeof resolveRememberedReviewPass>,
    bucket?: ReturnType<typeof resolveReviewMemoryBucket> | null
  ) => TFilter;
  fixedFilter?: TFilter;
}) {
  const { query: params, routeScope, initialPreferences } =
    await resolveShellRoutePageBootstrap(args.searchParams);
  const memoryBucket = resolveReviewMemoryBucket({
    ...args.memoryBucketArgs,
    scope: routeScope,
  });
  const preferredPass = resolveRememberedReviewPass(
    initialPreferences,
    memoryBucket
  );
  const explicitFilter = firstParam(params?.filter);
  const initialFilter =
    args.fixedFilter ??
    (explicitFilter && args.readFilterFromQueryRecord
      ? args.readFilterFromQueryRecord(params)
      : args.rememberedPassToFilter?.(preferredPass, memoryBucket));

  if (initialFilter === undefined) {
    throw new Error("Review page bootstrap could not resolve an initial filter.");
  }

  return {
    routeScope,
    initialPreferences,
    initialFilter,
  };
}
