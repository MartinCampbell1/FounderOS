import type {
  ApprovalAttentionRecord,
  IssueAttentionRecord,
  RuntimeAttentionRecord,
} from "@/lib/attention-records";
import { runAttentionAction } from "@/lib/attention-action-model";
import {
  runExecutionReviewBatchAction,
  type ReviewBatchEffect,
} from "@/lib/review-batch-actions";
import type { ShellRouteScope } from "@/lib/route-scope";
import type { ShellMutationEffect } from "@/lib/shell-mutation-effects";

type ExecutionAttentionMutationRunner = (
  actionKey: string,
  action: () => Promise<ShellMutationEffect<unknown>>,
  runOptions?: {
    onSuccess?: (effect: ShellMutationEffect<unknown>) => void;
  }
) => Promise<boolean>;

type ReviewBatchMutationRunner = (
  actionKey: string,
  action: () => Promise<ReviewBatchEffect>,
  runOptions?: {
    onSuccess?: (effect: ReviewBatchEffect) => void;
  }
) => Promise<boolean>;

type ExecutionAttentionMutationArgs =
  | {
      action: "resolve-issue";
      actionKey: string;
      record: IssueAttentionRecord;
      routeScope?: Partial<ShellRouteScope> | null;
      runMutation: ExecutionAttentionMutationRunner;
      source: string;
    }
  | {
      action: "approve" | "reject";
      actionKey: string;
      record: ApprovalAttentionRecord;
      routeScope?: Partial<ShellRouteScope> | null;
      runMutation: ExecutionAttentionMutationRunner;
      source: string;
    }
  | {
      action: "allow" | "deny";
      actionKey: string;
      record: RuntimeAttentionRecord;
      routeScope?: Partial<ShellRouteScope> | null;
      runMutation: ExecutionAttentionMutationRunner;
      source: string;
    };

type ExecutionBatchMutationArgs =
  | {
      action: "resolve-issue";
      actionKey: string;
      records: IssueAttentionRecord[];
      routeScope?: Partial<ShellRouteScope> | null;
      runMutation: ReviewBatchMutationRunner;
      source: string;
      onProcessedKeys?: ((processedKeys: string[]) => void) | null;
    }
  | {
      action: "approve" | "reject";
      actionKey: string;
      records: ApprovalAttentionRecord[];
      routeScope?: Partial<ShellRouteScope> | null;
      runMutation: ReviewBatchMutationRunner;
      source: string;
      onProcessedKeys?: ((processedKeys: string[]) => void) | null;
    }
  | {
      action: "allow" | "deny";
      actionKey: string;
      records: RuntimeAttentionRecord[];
      routeScope?: Partial<ShellRouteScope> | null;
      runMutation: ReviewBatchMutationRunner;
      source: string;
      onProcessedKeys?: ((processedKeys: string[]) => void) | null;
    };

export function runExecutionAttentionMutation(
  args: ExecutionAttentionMutationArgs
) {
  switch (args.action) {
    case "resolve-issue":
      return args.runMutation(args.actionKey, () =>
        runAttentionAction({
          plane: "execution",
          action: "resolve-issue",
          issue: args.record.issue,
          sourceContext: args.record.source,
          routeScope: args.routeScope,
          source: args.source,
        })
      );
    case "approve":
    case "reject":
      return args.runMutation(args.actionKey, () =>
        runAttentionAction({
          plane: "execution",
          action: args.action,
          approval: args.record.approval,
          sourceContext: args.record.source,
          routeScope: args.routeScope,
          source: args.source,
        })
      );
    case "allow":
    case "deny":
      return args.runMutation(args.actionKey, () =>
        runAttentionAction({
          plane: "execution",
          action: args.action,
          runtime: args.record.runtime,
          sourceContext: args.record.source,
          routeScope: args.routeScope,
          source: args.source,
        })
      );
  }
}

export function runExecutionReviewBatchMutation(
  args: ExecutionBatchMutationArgs
) {
  switch (args.action) {
    case "resolve-issue":
      return args.runMutation(
        args.actionKey,
        () =>
          runExecutionReviewBatchAction({
            action: "resolve-issue",
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
    case "approve":
    case "reject":
      return args.runMutation(
        args.actionKey,
        () =>
          runExecutionReviewBatchAction({
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
    case "allow":
    case "deny":
      return args.runMutation(
        args.actionKey,
        () =>
          runExecutionReviewBatchAction({
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
}
