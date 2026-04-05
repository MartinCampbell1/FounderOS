import {
  confirmDiscoveryReviewRecord,
  openDiscoveryReviewExecutionHandoff,
  reopenDiscoveryReviewRecord,
  type DiscoveryMutationEffect,
} from "@/lib/discovery-mutations";
import type { ShellDiscoveryReviewRecord } from "@/lib/discovery-review";
import {
  runDiscoveryReviewBatchAction,
  type ReviewBatchEffect,
} from "@/lib/review-batch-actions";
import type { ShellRouteScope } from "@/lib/route-scope";

type DiscoveryReviewMutationRunner = (
  actionKey: string,
  action: () => Promise<DiscoveryMutationEffect>,
  runOptions?: {
    onSuccess?: (effect: DiscoveryMutationEffect) => void;
  }
) => Promise<boolean>;

type DiscoveryReviewBatchMutationRunner = (
  actionKey: string,
  action: () => Promise<ReviewBatchEffect>,
  runOptions?: {
    onSuccess?: (effect: ReviewBatchEffect) => void;
  }
) => Promise<boolean>;

type DiscoveryReviewMutationArgs =
  | {
      action: "confirm" | "reopen";
      actionKey: string;
      note?: string;
      record: ShellDiscoveryReviewRecord;
      routeScope?: Partial<ShellRouteScope> | null;
      runMutation: DiscoveryReviewMutationRunner;
      source: string;
    }
  | {
      action: "open-handoff";
      actionKey: string;
      record: ShellDiscoveryReviewRecord;
      routeScope?: Partial<ShellRouteScope> | null;
      runMutation: DiscoveryReviewMutationRunner;
      source: string;
    };

type DiscoveryReviewBatchMutationArgs = {
  action: "confirm" | "reopen";
  actionKey: string;
  records: ShellDiscoveryReviewRecord[];
  routeScope?: Partial<ShellRouteScope> | null;
  runMutation: DiscoveryReviewBatchMutationRunner;
  source: string;
  onProcessedKeys?: ((processedKeys: string[]) => void) | null;
};

export function runDiscoveryReviewMutation(args: DiscoveryReviewMutationArgs) {
  switch (args.action) {
    case "confirm":
    case "reopen":
      return args.runMutation(args.actionKey, () =>
        args.action === "confirm"
          ? confirmDiscoveryReviewRecord({
              record: args.record,
              note: args.note,
              routeScope: args.routeScope,
              source: args.source,
            })
          : reopenDiscoveryReviewRecord({
              record: args.record,
              note: args.note,
              routeScope: args.routeScope,
              source: args.source,
            })
      );
    case "open-handoff":
      return args.runMutation(args.actionKey, () =>
        openDiscoveryReviewExecutionHandoff({
          record: args.record,
          routeScope: args.routeScope,
          source: args.source,
        })
      );
  }
}

export function runDiscoveryReviewBatchMutation(
  args: DiscoveryReviewBatchMutationArgs
) {
  return args.runMutation(
    args.actionKey,
    () =>
      runDiscoveryReviewBatchAction({
        action: args.action,
        records: args.records,
        routeScope: args.routeScope,
        source: args.source,
      }),
    {
      onSuccess: (effect) => {
        args.onProcessedKeys?.(effect.data.processedKeys);
      },
    }
  );
}
