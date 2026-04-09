import type { QuorumDiscoveryInboxFeed } from "@founderos/api-clients";

import {
  buildShellExecutionAttentionRecords,
  type ShellExecutionAttentionRecord,
} from "@/lib/attention-records";
import { loadShellChainGraphSnapshotData } from "@/lib/chain-graph-data";

export interface ShellExecutionReviewStats {
  totalCount: number;
  issueCount: number;
  approvalCount: number;
  runtimeCount: number;
  intakeOriginCount: number;
  chainLinkedCount: number;
  orphanCount: number;
  criticalIssueCount: number;
}

export interface ShellExecutionReviewSnapshot {
  generatedAt: string;
  records: ShellExecutionAttentionRecord[];
  stats: ShellExecutionReviewStats;
  error: string | null;
  loadState: "ready" | "error";
}

function emptyDiscoveryInboxFeed(): QuorumDiscoveryInboxFeed {
  return {
    items: [],
    summary: {
      open_count: 0,
      resolved_count: 0,
      stale_count: 0,
      action_required_count: 0,
      kinds: {},
      subject_kinds: {},
    },
  };
}

function emptyStats(): ShellExecutionReviewStats {
  return {
    totalCount: 0,
    issueCount: 0,
    approvalCount: 0,
    runtimeCount: 0,
    intakeOriginCount: 0,
    chainLinkedCount: 0,
    orphanCount: 0,
    criticalIssueCount: 0,
  };
}

function buildStats(records: ShellExecutionAttentionRecord[]) {
  return records.reduce<ShellExecutionReviewStats>((stats, record) => {
    stats.totalCount += 1;

    if (record.type === "issue") {
      stats.issueCount += 1;
      if (record.issue.severity === "critical") {
        stats.criticalIssueCount += 1;
      }
    }
    if (record.type === "approval") {
      stats.approvalCount += 1;
    }
    if (record.type === "runtime") {
      stats.runtimeCount += 1;
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
  }, emptyStats());
}

export function emptyShellExecutionReviewSnapshot(): ShellExecutionReviewSnapshot {
  return {
    generatedAt: "",
    records: [],
    stats: emptyStats(),
    error: null,
    loadState: "ready",
  };
}

type ExecutionReviewSnapshotOptions = {
  upstreamTimeoutMs?: number;
  limit?: number;
};

export async function buildExecutionReviewSnapshot(
  options?: ExecutionReviewSnapshotOptions,
): Promise<ShellExecutionReviewSnapshot> {
  const limit =
    typeof options?.limit === "number"
      ? Math.max(1, Math.min(Math.trunc(options.limit), 100))
      : 100;
  const snapshot = await loadShellChainGraphSnapshotData({
    discoveryIdeaLimit: limit,
    includeArchivedProjects: true,
    upstreamTimeoutMs: options?.upstreamTimeoutMs,
  });

  const records = buildShellExecutionAttentionRecords({
    discoveryFeed: emptyDiscoveryInboxFeed(),
    projects: snapshot.projects,
    intakeSessions: snapshot.intakeSessions,
    approvals: snapshot.approvals,
    issues: snapshot.issues,
    runtimes: snapshot.runtimes,
    chains: snapshot.chains,
    routeScope: null,
  }).slice(0, limit);

  return {
    generatedAt: new Date().toISOString(),
    records,
    stats: buildStats(records),
    error: snapshot.errors.length > 0 ? snapshot.errors.join(" ") : null,
    loadState: snapshot.loadState,
  };
}
