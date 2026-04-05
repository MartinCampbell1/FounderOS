"use client";

import { useCallback } from "react";

import type {
  ApprovalAttentionRecord,
  IssueAttentionRecord,
  RuntimeAttentionRecord,
  ShellExecutionAttentionRecord,
} from "@/lib/attention-records";
import type { ShellChainRecord } from "@/lib/chain-graph";
import type { ShellDiscoveryReviewRecord } from "@/lib/discovery-review";
import type { ReviewBatchEffect } from "@/lib/review-batch-actions";
import { runDiscoveryReviewBatchMutation } from "@/lib/review-discovery-actions";
import { runExecutionReviewBatchMutation } from "@/lib/review-execution-actions";
import type {
  ShellReviewPressureHotspot,
  ShellReviewPressureLaneSummary,
} from "@/lib/review-pressure";
import type { ShellRouteScope } from "@/lib/route-scope";
import { useShellRouteMutationRunner } from "@/lib/use-shell-route-mutation-runner";

export type ReviewPressureActionKind =
  | "confirm-discovery"
  | "reopen-discovery"
  | "resolve-issues"
  | "approve-approvals"
  | "reject-approvals"
  | "allow-runtimes"
  | "deny-runtimes";

function isIssueRecord(
  record: ShellExecutionAttentionRecord
): record is IssueAttentionRecord {
  return record.type === "issue";
}

function isApprovalRecord(
  record: ShellExecutionAttentionRecord
): record is ApprovalAttentionRecord {
  return record.type === "approval";
}

function isRuntimeRecord(
  record: ShellExecutionAttentionRecord
): record is RuntimeAttentionRecord {
  return record.type === "runtime";
}

function matchesDiscoveryLaneRecord(
  record: ShellDiscoveryReviewRecord,
  laneKey: ShellReviewPressureLaneSummary["key"]
) {
  if (laneKey === "authoring") return record.kind === "authoring";
  if (laneKey === "trace") return record.kind === "trace-review";
  if (laneKey === "handoff") return record.kind === "handoff-ready";
  if (laneKey === "followthrough") {
    return record.kind === "execution-followthrough";
  }
  if (laneKey === "linked") return Boolean(record.chain);
  return false;
}

function matchesExecutionLaneRecord(
  record: ShellExecutionAttentionRecord,
  laneKey: ShellReviewPressureLaneSummary["key"]
) {
  if (laneKey === "critical") {
    return record.type === "issue" && record.issue.severity === "critical";
  }
  if (laneKey === "issues") return record.type === "issue";
  if (laneKey === "approvals") return record.type === "approval";
  if (laneKey === "decisions") {
    return record.type === "approval" || record.type === "runtime";
  }
  if (laneKey === "runtimes") return record.type === "runtime";
  if (laneKey === "linked") return record.source.chainKind !== "unlinked";
  if (laneKey === "intake") {
    return record.source.sourceKind === "intake_session";
  }
  return false;
}

function matchesExecutionHotspotRecord(
  record: ShellExecutionAttentionRecord,
  chain: ShellChainRecord
) {
  if (chain.project?.id && record.source.projectId === chain.project.id) {
    return true;
  }
  if (
    chain.intakeSessionId &&
    record.source.sourceKind === "intake_session" &&
    record.source.sourceExternalId === chain.intakeSessionId
  ) {
    return true;
  }
  return Boolean(chain.briefId) && record.source.briefId === chain.briefId;
}

export function reviewPressureBusyKey(
  kind: "lane" | "hotspot",
  targetKey: string,
  action: ReviewPressureActionKind
) {
  return `${kind}:${targetKey}:${action}`;
}

export function useReviewPressureActions(args: {
  discoveryRecords: ShellDiscoveryReviewRecord[];
  executionRecords: ShellExecutionAttentionRecord[];
  routeScope?: Partial<ShellRouteScope> | null;
  source: string;
}) {
  const {
    busyActionKey,
    errorMessage,
    runMutation,
    statusMessage,
  } = useShellRouteMutationRunner<ReviewBatchEffect>({
    planes: ["discovery", "execution"],
    scope: args.routeScope,
    source: args.source,
    reason: `${args.source}-mutation`,
  }, {
    fallbackErrorMessage: "Review pressure action failed.",
  });

  const runDiscoveryAction = useCallback(
    (
      actionKey: string,
      action: "confirm" | "reopen",
      records: ShellDiscoveryReviewRecord[]
    ) =>
      runDiscoveryReviewBatchMutation({
        action,
        actionKey,
        records,
        routeScope: args.routeScope,
        runMutation,
        source: args.source,
      }),
    [args.routeScope, args.source, runMutation]
  );

  const runExecutionAction = useCallback(
    (
      actionKey: string,
      action:
        | "resolve-issue"
        | "approve"
        | "reject"
        | "allow"
        | "deny",
      records:
        | IssueAttentionRecord[]
        | ApprovalAttentionRecord[]
        | RuntimeAttentionRecord[]
    ) => {
      switch (action) {
        case "resolve-issue":
          return runExecutionReviewBatchMutation({
            action: "resolve-issue",
            actionKey,
            records: records as IssueAttentionRecord[],
            routeScope: args.routeScope,
            runMutation,
            source: args.source,
          });
        case "approve":
        case "reject":
          return runExecutionReviewBatchMutation({
            action,
            actionKey,
            records: records as ApprovalAttentionRecord[],
            routeScope: args.routeScope,
            runMutation,
            source: args.source,
          });
        case "allow":
        case "deny":
          return runExecutionReviewBatchMutation({
            action,
            actionKey,
            records: records as RuntimeAttentionRecord[],
            routeScope: args.routeScope,
            runMutation,
            source: args.source,
          });
      }
    },
    [args.routeScope, args.source, runMutation]
  );

  const runLaneAction = useCallback(
    (
      laneKey: ShellReviewPressureLaneSummary["key"],
      action: ReviewPressureActionKind
    ) => {
      if (action === "confirm-discovery" || action === "reopen-discovery") {
        const records = args.discoveryRecords.filter((record) =>
          matchesDiscoveryLaneRecord(record, laneKey)
        );
        return runDiscoveryAction(
          reviewPressureBusyKey("lane", laneKey, action),
          action === "confirm-discovery" ? "confirm" : "reopen",
          records
        );
      }

      if (action === "resolve-issues") {
        const records = args.executionRecords
          .filter((record) => matchesExecutionLaneRecord(record, laneKey))
          .filter(isIssueRecord);
        return runExecutionAction(
          reviewPressureBusyKey("lane", laneKey, action),
          "resolve-issue",
          records
        );
      }

      if (action === "approve-approvals" || action === "reject-approvals") {
        const records = args.executionRecords
          .filter((record) => matchesExecutionLaneRecord(record, laneKey))
          .filter(isApprovalRecord);
        return runExecutionAction(
          reviewPressureBusyKey("lane", laneKey, action),
          action === "approve-approvals" ? "approve" : "reject",
          records
        );
      }

      const records = args.executionRecords
        .filter((record) => matchesExecutionLaneRecord(record, laneKey))
        .filter(isRuntimeRecord);
      return runExecutionAction(
        reviewPressureBusyKey("lane", laneKey, action),
        action === "allow-runtimes" ? "allow" : "deny",
        records
      );
    },
    [
      args.discoveryRecords,
      args.executionRecords,
      runDiscoveryAction,
      runExecutionAction,
    ]
  );

  const runHotspotAction = useCallback(
    (
      hotspot: ShellReviewPressureHotspot,
      action: ReviewPressureActionKind
    ) => {
      if (action === "confirm-discovery" || action === "reopen-discovery") {
        const records = args.discoveryRecords.filter(
          (record) => record.chain?.key === hotspot.chain.key
        );
        return runDiscoveryAction(
          reviewPressureBusyKey("hotspot", hotspot.chain.key, action),
          action === "confirm-discovery" ? "confirm" : "reopen",
          records
        );
      }

      if (action === "resolve-issues") {
        const records = args.executionRecords
          .filter((record) => matchesExecutionHotspotRecord(record, hotspot.chain))
          .filter(isIssueRecord);
        return runExecutionAction(
          reviewPressureBusyKey("hotspot", hotspot.chain.key, action),
          "resolve-issue",
          records
        );
      }

      if (action === "approve-approvals" || action === "reject-approvals") {
        const records = args.executionRecords
          .filter((record) => matchesExecutionHotspotRecord(record, hotspot.chain))
          .filter(isApprovalRecord);
        return runExecutionAction(
          reviewPressureBusyKey("hotspot", hotspot.chain.key, action),
          action === "approve-approvals" ? "approve" : "reject",
          records
        );
      }

      const records = args.executionRecords
        .filter((record) => matchesExecutionHotspotRecord(record, hotspot.chain))
        .filter(isRuntimeRecord);
      return runExecutionAction(
        reviewPressureBusyKey("hotspot", hotspot.chain.key, action),
        action === "allow-runtimes" ? "allow" : "deny",
        records
      );
    },
    [
      args.discoveryRecords,
      args.executionRecords,
      runDiscoveryAction,
      runExecutionAction,
    ]
  );

  return {
    busyActionKey,
    errorMessage,
    runHotspotAction,
    runLaneAction,
    statusMessage,
  };
}
