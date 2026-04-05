import type { ShellReviewLane } from "@founderos/api-clients";
import type { ShellExecutionAttentionRecord } from "@/lib/attention-records";
import type { ShellDiscoveryReviewRecord } from "@/lib/discovery-review";
import type { ShellExecutionReviewSnapshot } from "@/lib/execution-review";

import {
  buildDiscoveryReviewSnapshot,
  emptyShellDiscoveryReviewSnapshot,
  type ShellDiscoveryReviewSnapshot,
} from "@/lib/discovery-review";
import {
  buildDiscoveryReviewStatsFromRecords,
  type DiscoveryReviewFilter,
} from "@/lib/discovery-review-model";
import {
  buildExecutionReviewSnapshot,
  emptyShellExecutionReviewSnapshot,
} from "@/lib/execution-review";
import {
  buildExecutionReviewRollupFromAttentionRecords,
  type ExecutionReviewFilter,
} from "@/lib/execution-review-model";

export type ShellReviewCenterLane = ShellReviewLane;

export interface ShellReviewCenterStats {
  totalCount: number;
  discoveryCount: number;
  executionCount: number;
  authoringCount: number;
  traceReviewCount: number;
  handoffReadyCount: number;
  executionFollowthroughCount: number;
  issueCount: number;
  approvalCount: number;
  runtimeCount: number;
  decisionCount: number;
  criticalIssueCount: number;
  linkedDiscoveryCount: number;
  linkedExecutionCount: number;
  intakeOriginCount: number;
}

export interface ShellReviewCenterSnapshot {
  generatedAt: string;
  discovery: ShellDiscoveryReviewSnapshot;
  execution: ShellExecutionReviewSnapshot;
  stats: ShellReviewCenterStats;
  errors: string[];
  loadState: "ready" | "error";
}

type QueryRecord = Record<string, string | string[] | undefined>;

const REVIEW_CENTER_LANES = new Set<ShellReviewCenterLane>([
  "all",
  "discovery",
  "execution",
  "authoring",
  "trace",
  "handoff",
  "followthrough",
  "issues",
  "approvals",
  "runtimes",
  "decisions",
  "critical",
  "linked",
  "intake",
]);

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function buildStats(args: {
  discoveryRecords: ShellDiscoveryReviewRecord[];
  executionRecords: ShellExecutionAttentionRecord[];
}) {
  const discoveryStats = buildDiscoveryReviewStatsFromRecords(args.discoveryRecords);
  const executionStats = buildExecutionReviewRollupFromAttentionRecords(
    args.executionRecords
  );

  return {
    totalCount: discoveryStats.totalCount + executionStats.totalCount,
    discoveryCount: discoveryStats.totalCount,
    executionCount: executionStats.totalCount,
    authoringCount: discoveryStats.authoringCount,
    traceReviewCount: discoveryStats.traceReviewCount,
    handoffReadyCount: discoveryStats.handoffReadyCount,
    executionFollowthroughCount: discoveryStats.executionFollowthroughCount,
    issueCount: executionStats.issueCount,
    approvalCount: executionStats.approvalCount,
    runtimeCount: executionStats.runtimeCount,
    decisionCount: executionStats.decisionCount,
    criticalIssueCount: executionStats.criticalIssueCount,
    linkedDiscoveryCount: discoveryStats.linkedCount,
    linkedExecutionCount: executionStats.chainLinkedCount,
    intakeOriginCount: executionStats.intakeOriginCount,
  } satisfies ShellReviewCenterStats;
}

export function emptyShellReviewCenterSnapshot(): ShellReviewCenterSnapshot {
  return {
    generatedAt: "",
    discovery: emptyShellDiscoveryReviewSnapshot(),
    execution: emptyShellExecutionReviewSnapshot(),
    stats: buildStats({
      discoveryRecords: [],
      executionRecords: [],
    }),
    errors: [],
    loadState: "ready",
  };
}

export function normalizeReviewCenterLane(
  value?: string | null
): ShellReviewCenterLane {
  const normalized = (value || "").trim().toLowerCase();
  return REVIEW_CENTER_LANES.has(normalized as ShellReviewCenterLane)
    ? (normalized as ShellReviewCenterLane)
    : "all";
}

export function readReviewCenterLaneFromQueryRecord(
  params?: QueryRecord | null
) {
  return normalizeReviewCenterLane(firstParam(params?.lane));
}

export function reviewCenterLaneToDiscoveryFilter(
  lane: ShellReviewCenterLane
): DiscoveryReviewFilter {
  if (lane === "authoring") return "authoring";
  if (lane === "trace") return "trace";
  if (lane === "handoff") return "handoff";
  if (lane === "followthrough") return "execution";
  if (lane === "linked") return "linked";
  return "all";
}

export function reviewCenterLaneToExecutionFilter(
  lane: ShellReviewCenterLane
): ExecutionReviewFilter {
  if (lane === "issues" || lane === "approvals" || lane === "runtimes") {
    return lane;
  }
  if (lane === "decisions") return "decisions";
  if (lane === "intake") return "intake";
  if (lane === "linked") return "linked";
  return "all";
}

export function matchesReviewCenterDiscoveryLane(
  record: ShellDiscoveryReviewRecord,
  lane: ShellReviewCenterLane
) {
  if (lane === "all" || lane === "discovery") return true;
  if (lane === "authoring") return record.kind === "authoring";
  if (lane === "trace") return record.kind === "trace-review";
  if (lane === "handoff") return record.kind === "handoff-ready";
  if (lane === "followthrough") return record.kind === "execution-followthrough";
  if (lane === "linked") return Boolean(record.chain);
  return false;
}

export function matchesReviewCenterExecutionLane(
  record: ShellExecutionAttentionRecord,
  lane: ShellReviewCenterLane
) {
  if (lane === "all" || lane === "execution") return true;
  if (lane === "issues") {
    return record.type === "issue";
  }
  if (lane === "approvals") {
    return record.type === "approval";
  }
  if (lane === "runtimes") {
    return record.type === "runtime";
  }
  if (lane === "decisions") {
    return record.type === "approval" || record.type === "runtime";
  }
  if (lane === "critical") {
    return record.type === "issue" && record.issue.severity === "critical";
  }
  if (lane === "linked") {
    return record.source.chainKind !== "unlinked";
  }
  if (lane === "intake") {
    return record.source.sourceKind === "intake_session";
  }
  return false;
}

type ReviewCenterSnapshotOptions = {
  upstreamTimeoutMs?: number;
};

export async function buildShellReviewCenterSnapshot(
  options?: ReviewCenterSnapshotOptions
): Promise<ShellReviewCenterSnapshot> {
  const [discovery, execution] = await Promise.all([
    buildDiscoveryReviewSnapshot({
      upstreamTimeoutMs: options?.upstreamTimeoutMs,
    }),
    buildExecutionReviewSnapshot({
      upstreamTimeoutMs: options?.upstreamTimeoutMs,
    }),
  ]);
  const errors = [discovery.error, execution.error].filter(
    (value): value is string => Boolean(value)
  );

  return {
    generatedAt: new Date().toISOString(),
    discovery,
    execution,
    stats: buildStats({
      discoveryRecords: discovery.records,
      executionRecords: execution.records,
    }),
    errors,
    loadState:
      discovery.loadState === "error" && execution.loadState === "error"
        ? "error"
        : "ready",
  };
}
