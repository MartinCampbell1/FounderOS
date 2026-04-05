import type {
  ApprovalAttentionRecord,
  IssueAttentionRecord,
  RuntimeAttentionRecord,
} from "@/lib/attention-records";
import { runAttentionAction } from "@/lib/attention-action-model";
import {
  confirmDiscoveryReviewRecord,
  reopenDiscoveryReviewRecord,
} from "@/lib/discovery-mutations";
import type { ShellDiscoveryReviewRecord } from "@/lib/discovery-review";
import type { ShellRouteScope } from "@/lib/route-scope";
import type { ShellMutationEffect } from "@/lib/shell-mutation-effects";
import type { ShellRouteMutationInvalidation } from "@/lib/use-shell-route-mutation";

export type ReviewBatchActionKind =
  | "discovery-confirm"
  | "discovery-reopen"
  | "execution-resolve-issue"
  | "execution-approve"
  | "execution-reject"
  | "execution-allow"
  | "execution-deny";

type ReviewBatchPlane = "discovery" | "execution";

type ReviewBatchFailure = {
  key: string;
  label: string;
  message: string;
};

export type ReviewBatchEffectData = {
  actionKind: ReviewBatchActionKind;
  failedKeys: string[];
  failureCount: number;
  plane: ReviewBatchPlane;
  processedKeys: string[];
  successCount: number;
};

export type ReviewBatchEffect = ShellMutationEffect<ReviewBatchEffectData> & {
  actionKind: ReviewBatchActionKind;
  data: ReviewBatchEffectData;
};

function createReviewBatchEffect(
  actionKind: ReviewBatchActionKind,
  data: ReviewBatchEffectData,
  effect: Omit<ShellMutationEffect<ReviewBatchEffectData>, "data">
): ReviewBatchEffect {
  return {
    ...effect,
    actionKind,
    data,
  };
}

function buildBatchInvalidation(args: {
  plane: ReviewBatchPlane;
  reason: string;
  routeScope?: Partial<ShellRouteScope> | null;
  source: string;
}): ShellRouteMutationInvalidation {
  return {
    planes: [args.plane],
    scope: args.routeScope,
    source: args.source,
    reason: args.reason,
  };
}

function formatFailureSummary(failures: ReviewBatchFailure[]) {
  return failures
    .slice(0, 3)
    .map((failure) => `${failure.label}: ${failure.message}`)
    .join(" ");
}

async function runBatch<T extends { key: string }>(args: {
  items: T[];
  itemLabel: (item: T) => string;
  run: (item: T) => Promise<unknown>;
}) {
  const failures: ReviewBatchFailure[] = [];
  const processedKeys: string[] = [];

  for (const item of args.items) {
    try {
      await args.run(item);
      processedKeys.push(item.key);
    } catch (error) {
      failures.push({
        key: item.key,
        label: args.itemLabel(item),
        message: error instanceof Error ? error.message : "Action failed.",
      });
    }
  }

  return {
    failedKeys: failures.map((failure) => failure.key),
    failures,
    processedKeys,
  };
}

function ensureBatchItems(
  count: number,
  label: string
): asserts count is number {
  if (count <= 0) {
    throw new Error(`No ${label} were selected.`);
  }
}

export async function runDiscoveryReviewBatchAction(args: {
  action: "confirm" | "reopen";
  records: ShellDiscoveryReviewRecord[];
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<ReviewBatchEffect> {
  ensureBatchItems(args.records.length, "discovery review records");

  const source = args.source || "review-center";
  const summaryTarget = "discovery review records";
  const pastTense =
    args.action === "confirm" ? "Confirmed" : "Reopened";
  const batch = await runBatch({
    items: args.records,
    itemLabel: (record) => record.dossier.idea.idea_id,
    run: (record) =>
      args.action === "confirm"
        ? confirmDiscoveryReviewRecord({
            record,
            routeScope: args.routeScope,
            source,
          })
        : reopenDiscoveryReviewRecord({
            record,
            routeScope: args.routeScope,
            source,
          }),
  });

  if (batch.processedKeys.length === 0) {
    throw new Error(
      `${pastTense} 0 ${summaryTarget}. ${formatFailureSummary(batch.failures)}`
    );
  }

  const statusMessage =
    batch.failures.length > 0
      ? `${pastTense} ${batch.processedKeys.length} ${summaryTarget}. ${batch.failures.length} still need attention.`
      : `${pastTense} ${batch.processedKeys.length} ${summaryTarget}.`;

  return createReviewBatchEffect(
    args.action === "confirm" ? "discovery-confirm" : "discovery-reopen",
    {
      actionKind:
        args.action === "confirm" ? "discovery-confirm" : "discovery-reopen",
      failedKeys: batch.failedKeys,
      failureCount: batch.failures.length,
      plane: "discovery",
      processedKeys: batch.processedKeys,
      successCount: batch.processedKeys.length,
    },
    {
      statusMessage,
      errorMessage:
        batch.failures.length > 0 ? formatFailureSummary(batch.failures) : null,
      invalidation: buildBatchInvalidation({
        plane: "discovery",
        routeScope: args.routeScope,
        source,
        reason:
          args.action === "confirm"
            ? "review-center-batch-discovery-confirm"
            : "review-center-batch-discovery-reopen",
      }),
    }
  );
}

export async function runExecutionReviewBatchAction(args:
  | {
      action: "resolve-issue";
      records: IssueAttentionRecord[];
      routeScope?: Partial<ShellRouteScope> | null;
      source?: string;
    }
  | {
      action: "approve" | "reject";
      records: ApprovalAttentionRecord[];
      routeScope?: Partial<ShellRouteScope> | null;
      source?: string;
    }
  | {
      action: "allow" | "deny";
      records: RuntimeAttentionRecord[];
      routeScope?: Partial<ShellRouteScope> | null;
      source?: string;
}): Promise<ReviewBatchEffect> {
  const source = args.source || "review-center";
  ensureBatchItems(args.records.length, "execution review records");
  let batch: {
    failedKeys: string[];
    failures: ReviewBatchFailure[];
    processedKeys: string[];
  };

  if (args.action === "resolve-issue") {
    const records = args.records as IssueAttentionRecord[];
    batch = await runBatch({
      items: records,
      itemLabel: (record) => record.title,
      run: (record) =>
        runAttentionAction({
          plane: "execution",
          action: "resolve-issue",
          issue: record.issue,
          sourceContext: record.source,
          routeScope: args.routeScope,
          source,
        }),
    });
  } else if (args.action === "approve") {
    const records = args.records as ApprovalAttentionRecord[];
    batch = await runBatch({
      items: records,
      itemLabel: (record) => record.title,
      run: (record) =>
        runAttentionAction({
          plane: "execution",
          action: "approve",
          approval: record.approval,
          sourceContext: record.source,
          routeScope: args.routeScope,
          source,
        }),
    });
  } else if (args.action === "reject") {
    const records = args.records as ApprovalAttentionRecord[];
    batch = await runBatch({
      items: records,
      itemLabel: (record) => record.title,
      run: (record) =>
        runAttentionAction({
          plane: "execution",
          action: "reject",
          approval: record.approval,
          sourceContext: record.source,
          routeScope: args.routeScope,
          source,
        }),
    });
  } else if (args.action === "allow") {
    const records = args.records as RuntimeAttentionRecord[];
    batch = await runBatch({
      items: records,
      itemLabel: (record) => record.title,
      run: (record) =>
        runAttentionAction({
          plane: "execution",
          action: "allow",
          runtime: record.runtime,
          sourceContext: record.source,
          routeScope: args.routeScope,
          source,
        }),
    });
  } else {
    const records = args.records as RuntimeAttentionRecord[];
    batch = await runBatch({
      items: records,
      itemLabel: (record) => record.title,
      run: (record) =>
        runAttentionAction({
          plane: "execution",
          action: "deny",
          runtime: record.runtime,
          sourceContext: record.source,
          routeScope: args.routeScope,
          source,
        }),
    });
  }

  const pastTense =
    args.action === "resolve-issue"
      ? "Resolved"
      : args.action === "approve"
        ? "Approved"
        : args.action === "reject"
          ? "Rejected"
          : args.action === "allow"
            ? "Allowed"
            : "Denied";
  const actionKind =
    args.action === "resolve-issue"
      ? "execution-resolve-issue"
      : args.action === "approve"
        ? "execution-approve"
        : args.action === "reject"
          ? "execution-reject"
          : args.action === "allow"
            ? "execution-allow"
            : "execution-deny";
  const summaryTarget =
    args.action === "resolve-issue"
      ? "execution issues"
      : args.action === "approve" || args.action === "reject"
        ? "execution approvals"
        : "tool permission requests";

  if (batch.processedKeys.length === 0) {
    throw new Error(
      `${pastTense} 0 ${summaryTarget}. ${formatFailureSummary(batch.failures)}`
    );
  }

  return createReviewBatchEffect(
    actionKind,
    {
      actionKind,
      failedKeys: batch.failedKeys,
      failureCount: batch.failures.length,
      plane: "execution",
      processedKeys: batch.processedKeys,
      successCount: batch.processedKeys.length,
    },
    {
      statusMessage:
        batch.failures.length > 0
          ? `${pastTense} ${batch.processedKeys.length} ${summaryTarget}. ${batch.failures.length} still need attention.`
          : `${pastTense} ${batch.processedKeys.length} ${summaryTarget}.`,
      errorMessage:
        batch.failures.length > 0 ? formatFailureSummary(batch.failures) : null,
      invalidation: buildBatchInvalidation({
        plane: "execution",
        routeScope: args.routeScope,
        source,
        reason: `review-center-batch-${actionKind}`,
      }),
    }
  );
}
