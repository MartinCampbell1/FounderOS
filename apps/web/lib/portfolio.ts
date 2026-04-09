import type {
  AutopilotExecutionApprovalRecord,
  AutopilotExecutionIssueRecord,
  AutopilotIntakeSessionSummary,
  AutopilotProjectSummary,
  AutopilotToolPermissionRuntimeRecord,
  QuorumIdeaDossierSummary,
} from "@founderos/api-clients";

import {
  buildShellChainGraph,
  buildShellChainGraphStats,
  type IntakeShellChainRecord,
  type LinkedShellChainRecord,
  type OrphanProjectShellChainRecord,
  type ShellChainProjectAttention,
  type ShellChainRecord,
  type ShellChainGraphStats,
} from "@/lib/chain-graph";
import { loadShellChainGraphSnapshotData } from "@/lib/chain-graph-data";
import {
  buildShellReviewCenterSnapshot,
  emptyShellReviewCenterSnapshot,
  type ShellReviewCenterSnapshot,
} from "@/lib/review-center";

export type PortfolioProjectAttention = ShellChainProjectAttention;
export type LinkedPortfolioRecord = LinkedShellChainRecord;
export type OrphanProjectRecord = OrphanProjectShellChainRecord;
export type IntakePortfolioRecord = IntakeShellChainRecord;
export type PortfolioRecord = ShellChainRecord;
export type PortfolioGraphStats = ShellChainGraphStats;

export interface ShellPortfolioSnapshot {
  generatedAt: string;
  records: PortfolioRecord[];
  reviewCenter: ShellReviewCenterSnapshot;
  error: string | null;
  loadState: "ready" | "error";
}

export function buildPortfolioRecords(
  dossiers: QuorumIdeaDossierSummary[],
  projects: AutopilotProjectSummary[],
  intakeSessions: AutopilotIntakeSessionSummary[],
  issues: AutopilotExecutionIssueRecord[] = [],
  approvals: AutopilotExecutionApprovalRecord[] = [],
  runtimes: AutopilotToolPermissionRuntimeRecord[] = [],
): PortfolioRecord[] {
  return buildShellChainGraph(
    dossiers,
    projects,
    intakeSessions,
    issues,
    approvals,
    runtimes,
  );
}

export function buildPortfolioGraphStats(records: PortfolioRecord[]) {
  return buildShellChainGraphStats(records);
}

export async function buildPortfolioSnapshot(options?: {
  limit?: number;
}): Promise<ShellPortfolioSnapshot> {
  const limit =
    typeof options?.limit === "number"
      ? Math.max(1, Math.min(Math.trunc(options.limit), 100))
      : 100;
  const [snapshot, reviewCenter] = await Promise.all([
    loadShellChainGraphSnapshotData({
      discoveryIdeaLimit: limit,
      includeArchivedProjects: true,
    }),
    buildShellReviewCenterSnapshot({ limit }).catch(() =>
      emptyShellReviewCenterSnapshot(),
    ),
  ]);
  const errors = [...snapshot.errors, ...reviewCenter.errors];

  return {
    generatedAt: new Date().toISOString(),
    records: snapshot.chains.slice(0, limit),
    reviewCenter,
    error: errors.length > 0 ? errors.join(" ") : null,
    loadState:
      snapshot.loadState === "error" && reviewCenter.loadState === "error"
        ? "error"
        : "ready",
  };
}
