import type {
  ProjectAttentionRollup,
  ShellExecutionAttentionRecord,
} from "@/lib/attention-records";
import type { ShellChainRecord } from "@/lib/chain-graph";

export type ExecutionReviewFilter =
  | "all"
  | "issues"
  | "approvals"
  | "runtimes"
  | "decisions"
  | "intake"
  | "linked";

export interface ExecutionReviewRollup {
  totalCount: number;
  issueCount: number;
  approvalCount: number;
  runtimeCount: number;
  decisionCount: number;
  criticalIssueCount: number;
  intakeOriginCount: number;
  chainLinkedCount: number;
  orphanCount: number;
}

type QueryRecord = Record<string, string | string[] | undefined>;

const EXECUTION_REVIEW_FILTERS = new Set<ExecutionReviewFilter>([
  "all",
  "issues",
  "approvals",
  "runtimes",
  "decisions",
  "intake",
  "linked",
]);

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export function normalizeExecutionReviewFilter(
  value?: string | null
): ExecutionReviewFilter {
  const normalized = (value || "").trim().toLowerCase();
  return EXECUTION_REVIEW_FILTERS.has(normalized as ExecutionReviewFilter)
    ? (normalized as ExecutionReviewFilter)
    : "all";
}

export function readExecutionReviewFilterFromQueryRecord(
  params?: QueryRecord | null
) {
  return normalizeExecutionReviewFilter(firstParam(params?.filter));
}

export function matchesExecutionReviewFilter(
  record: ShellExecutionAttentionRecord,
  filter: ExecutionReviewFilter
) {
  if (filter === "all") return true;
  if (filter === "issues") return record.type === "issue";
  if (filter === "approvals") return record.type === "approval";
  if (filter === "runtimes") return record.type === "runtime";
  if (filter === "decisions") {
    return record.type === "approval" || record.type === "runtime";
  }
  if (filter === "intake") {
    return record.source.sourceKind === "intake_session";
  }
  return record.source.chainKind !== "unlinked";
}

export function emptyExecutionReviewRollup(): ExecutionReviewRollup {
  return {
    totalCount: 0,
    issueCount: 0,
    approvalCount: 0,
    runtimeCount: 0,
    decisionCount: 0,
    criticalIssueCount: 0,
    intakeOriginCount: 0,
    chainLinkedCount: 0,
    orphanCount: 0,
  };
}

export function buildExecutionReviewRollupFromAttentionRecords(
  records: ShellExecutionAttentionRecord[]
) {
  return records.reduce<ExecutionReviewRollup>((stats, record) => {
    stats.totalCount += 1;

    if (record.type === "issue") {
      stats.issueCount += 1;
      if (record.issue.severity === "critical") {
        stats.criticalIssueCount += 1;
      }
    }
    if (record.type === "approval") {
      stats.approvalCount += 1;
      stats.decisionCount += 1;
    }
    if (record.type === "runtime") {
      stats.runtimeCount += 1;
      stats.decisionCount += 1;
    }
    if (record.source.sourceKind === "intake_session") {
      stats.intakeOriginCount += 1;
    }
    if (record.source.chainKind !== "unlinked") {
      stats.chainLinkedCount += 1;
    }
    if (record.source.chainKind === "orphan-project") {
      stats.orphanCount += 1;
    }
    return stats;
  }, emptyExecutionReviewRollup());
}

export function buildExecutionReviewRollupFromProjectAttention(
  attention: ProjectAttentionRollup | null | undefined
) {
  if (!attention) {
    return emptyExecutionReviewRollup();
  }

  return {
    totalCount: attention.total,
    issueCount: attention.issues.length,
    approvalCount: attention.approvals.length,
    runtimeCount: attention.runtimes.length,
    decisionCount: attention.approvals.length + attention.runtimes.length,
    criticalIssueCount: attention.issues.filter(
      (issue) => issue.severity === "critical"
    ).length,
    intakeOriginCount: 0,
    chainLinkedCount: 0,
    orphanCount: 0,
  };
}

export function buildExecutionReviewRollupFromChainRecords(
  records: ShellChainRecord[]
) {
  return records.reduce<ExecutionReviewRollup>((stats, record) => {
    const attention = record.attention;
    if (!attention || attention.total === 0) {
      return stats;
    }

    stats.totalCount += attention.total;
    stats.issueCount += attention.issues.length;
    stats.approvalCount += attention.approvals.length;
    stats.runtimeCount += attention.runtimes.length;
    stats.decisionCount += attention.approvals.length + attention.runtimes.length;
    stats.criticalIssueCount += attention.issues.filter(
      (issue) => issue.severity === "critical"
    ).length;
    stats.chainLinkedCount += 1;
    if (record.kind === "intake-linked") {
      stats.intakeOriginCount += attention.total;
    }
    if (record.kind === "orphan-project") {
      stats.orphanCount += attention.total;
    }
    return stats;
  }, emptyExecutionReviewRollup());
}

export function describeExecutionReviewRollup(
  rollup: ExecutionReviewRollup
) {
  return `${rollup.issueCount} issues, ${rollup.approvalCount} approvals, ${rollup.runtimeCount} tool permissions, ${rollup.criticalIssueCount} critical.`;
}
