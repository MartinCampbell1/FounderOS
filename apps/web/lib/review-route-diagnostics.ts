import type { ShellExecutionAttentionRecord } from "@/lib/attention-records";
import { matchesAttentionRouteScope } from "@/lib/attention-records";
import { matchesShellChainRouteScope } from "@/lib/chain-graph";
import type { ShellDiscoveryReviewRecord } from "@/lib/discovery-review";
import type { DiscoveryReviewFilter } from "@/lib/discovery-review-model";
import { matchesDiscoveryReviewFilter } from "@/lib/discovery-review-model";
import type { ExecutionReviewFilter } from "@/lib/execution-review-model";
import { matchesExecutionReviewFilter } from "@/lib/execution-review-model";
import {
  matchesReviewCenterDiscoveryLane,
  matchesReviewCenterExecutionLane,
  type ShellReviewCenterLane,
  type ShellReviewCenterSnapshot,
} from "@/lib/review-center";
import type { ShellReviewPreset } from "@/lib/review-presets";
import {
  hasShellRouteScope,
  normalizeShellRouteScope,
  type ShellRouteScope,
} from "@/lib/route-scope";

type RouteScopeDiagnostics = {
  projectId: string;
  intakeSessionId: string;
};

type DiscoveryRecordDiagnostics = {
  count: number;
  keys: string[];
  ideaIds: string[];
  authoringCount: number;
  traceCount: number;
  handoffCount: number;
  executionFollowthroughCount: number;
  linkedCount: number;
  replayLinkedCount: number;
};

type ExecutionRecordDiagnostics = {
  count: number;
  keys: string[];
  issueIds: string[];
  approvalIds: string[];
  runtimeIds: string[];
  criticalIssueIds: string[];
  decisionIds: string[];
  linkedCount: number;
  intakeOriginCount: number;
  orphanCount: number;
};

export type ReviewRouteDiagnostics = {
  route: "review";
  lane: ShellReviewCenterLane;
  preset: ShellReviewPreset | null;
  routeScope: RouteScopeDiagnostics;
  discovery: DiscoveryRecordDiagnostics;
  execution: ExecutionRecordDiagnostics;
};

export type DiscoveryReviewRouteDiagnostics = {
  route: "discovery-review";
  filter: DiscoveryReviewFilter;
  routeScope: RouteScopeDiagnostics;
  visible: DiscoveryRecordDiagnostics;
};

export type ExecutionReviewRouteDiagnostics = {
  route: "execution-review";
  filter: ExecutionReviewFilter;
  routeScope: RouteScopeDiagnostics;
  visible: ExecutionRecordDiagnostics;
};

function serializeRouteScope(
  routeScope?: Partial<ShellRouteScope> | null
): RouteScopeDiagnostics {
  return normalizeShellRouteScope(routeScope);
}

function summarizeDiscoveryRecords(
  records: ShellDiscoveryReviewRecord[]
): DiscoveryRecordDiagnostics {
  return {
    count: records.length,
    keys: records.map((record) => record.key),
    ideaIds: records.map((record) => record.dossier.idea.idea_id),
    authoringCount: records.filter((record) => record.kind === "authoring").length,
    traceCount: records.filter((record) => record.kind === "trace-review").length,
    handoffCount: records.filter((record) => record.kind === "handoff-ready").length,
    executionFollowthroughCount: records.filter(
      (record) => record.kind === "execution-followthrough"
    ).length,
    linkedCount: records.filter((record) => Boolean(record.chain)).length,
    replayLinkedCount: records.filter(
      (record) => (record.trace?.linkedSessionIds.length ?? 0) > 0
    ).length,
  };
}

function summarizeExecutionRecords(
  records: ShellExecutionAttentionRecord[]
): ExecutionRecordDiagnostics {
  return {
    count: records.length,
    keys: records.map((record) => record.key),
    issueIds: records
      .filter((record) => record.type === "issue")
      .map((record) => record.issue.id),
    approvalIds: records
      .filter((record) => record.type === "approval")
      .map((record) => record.approval.id),
    runtimeIds: records
      .filter((record) => record.type === "runtime")
      .map((record) => record.runtime.id),
    criticalIssueIds: records.reduce<string[]>((result, record) => {
      if (record.type === "issue" && record.issue.severity === "critical") {
        result.push(record.issue.id);
      }
      return result;
    }, []),
    decisionIds: records
      .filter((record) => record.type === "approval" || record.type === "runtime")
      .map((record) =>
        record.type === "approval" ? record.approval.id : record.runtime.id
      ),
    linkedCount: records.filter((record) => record.source.chainKind !== "unlinked").length,
    intakeOriginCount: records.filter(
      (record) => record.source.sourceKind === "intake_session"
    ).length,
    orphanCount: records.filter(
      (record) => record.source.chainKind === "orphan-project"
    ).length,
  };
}

export function buildReviewRouteDiagnostics(args: {
  lane: ShellReviewCenterLane;
  preset?: ShellReviewPreset | null;
  routeScope?: Partial<ShellRouteScope> | null;
  snapshot: ShellReviewCenterSnapshot;
}): ReviewRouteDiagnostics {
  const normalizedScope = normalizeShellRouteScope(args.routeScope);
  const scopeActive = hasShellRouteScope(normalizedScope);
  const scopedDiscoveryRecords = scopeActive
    ? args.snapshot.discovery.records.filter(
        (record) =>
          Boolean(record.chain) && matchesShellChainRouteScope(record.chain!, normalizedScope)
      )
    : args.snapshot.discovery.records;
  const scopedExecutionRecords = args.snapshot.execution.records.filter((record) =>
    matchesAttentionRouteScope(record, normalizedScope)
  );
  const visibleDiscoveryRecords = scopedDiscoveryRecords.filter((record) =>
    matchesReviewCenterDiscoveryLane(record, args.lane)
  );
  const visibleExecutionRecords = scopedExecutionRecords.filter((record) =>
    matchesReviewCenterExecutionLane(record, args.lane)
  );

  return {
    route: "review",
    lane: args.lane,
    preset: args.preset ?? null,
    routeScope: serializeRouteScope(normalizedScope),
    discovery: summarizeDiscoveryRecords(visibleDiscoveryRecords),
    execution: summarizeExecutionRecords(visibleExecutionRecords),
  };
}

export function buildDiscoveryReviewRouteDiagnostics(args: {
  filter: DiscoveryReviewFilter;
  routeScope?: Partial<ShellRouteScope> | null;
  records: ShellDiscoveryReviewRecord[];
}): DiscoveryReviewRouteDiagnostics {
  const normalizedScope = normalizeShellRouteScope(args.routeScope);
  const scopeActive = hasShellRouteScope(normalizedScope);
  const scopedRecords = scopeActive
    ? args.records.filter(
        (record) =>
          Boolean(record.chain) && matchesShellChainRouteScope(record.chain!, normalizedScope)
      )
    : args.records;
  const visibleRecords = scopedRecords.filter((record) =>
    matchesDiscoveryReviewFilter(record, args.filter)
  );

  return {
    route: "discovery-review",
    filter: args.filter,
    routeScope: serializeRouteScope(normalizedScope),
    visible: summarizeDiscoveryRecords(visibleRecords),
  };
}

export function buildExecutionReviewRouteDiagnostics(args: {
  filter: ExecutionReviewFilter;
  routeScope?: Partial<ShellRouteScope> | null;
  records: ShellExecutionAttentionRecord[];
}): ExecutionReviewRouteDiagnostics {
  const normalizedScope = normalizeShellRouteScope(args.routeScope);
  const scopedRecords = args.records.filter((record) =>
    matchesAttentionRouteScope(record, normalizedScope)
  );
  const visibleRecords = scopedRecords.filter((record) =>
    matchesExecutionReviewFilter(record, args.filter)
  );

  return {
    route: "execution-review",
    filter: args.filter,
    routeScope: serializeRouteScope(normalizedScope),
    visible: summarizeExecutionRecords(visibleRecords),
  };
}
