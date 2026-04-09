import type {
  GatewayHealthSnapshot,
  AutopilotExecutionApprovalRecord,
  AutopilotExecutionIssueRecord,
  AutopilotIntakeSessionSummary,
  AutopilotProjectSummary,
  QuorumDiscoveryInboxFeed,
  QuorumSessionSummary,
  AutopilotToolPermissionRuntimeRecord,
  QuorumDiscoveryIdea,
} from "@founderos/api-clients";

import type { ShellChainRecord } from "@/lib/chain-graph";
import { loadShellChainGraphSnapshotData } from "@/lib/chain-graph-data";
import { buildGatewayHealthSnapshot } from "@/lib/gateway";
import {
  buildShellReviewCenterSnapshot,
  emptyShellReviewCenterSnapshot,
  type ShellReviewCenterSnapshot,
} from "@/lib/review-center";
import {
  buildUpstreamQuery,
  formatUpstreamErrorMessage,
  requestUpstreamJson,
} from "@/lib/upstream";

export interface ShellDashboardSnapshot {
  generatedAt: string;
  health: GatewayHealthSnapshot | null;
  sessions: QuorumSessionSummary[];
  ideas: QuorumDiscoveryIdea[];
  discoveryFeed: QuorumDiscoveryInboxFeed;
  projects: AutopilotProjectSummary[];
  intakeSessions: AutopilotIntakeSessionSummary[];
  issues: AutopilotExecutionIssueRecord[];
  approvals: AutopilotExecutionApprovalRecord[];
  runtimes: AutopilotToolPermissionRuntimeRecord[];
  chains: ShellChainRecord[];
  reviewCenter: ShellReviewCenterSnapshot;
  errors: string[];
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

function sortSessions(items: QuorumSessionSummary[]) {
  return [...items].sort((left, right) => right.created_at - left.created_at);
}

type DashboardSnapshotOptions = {
  upstreamTimeoutMs?: number;
  limit?: number;
};

export async function buildDashboardSnapshot(
  options?: DashboardSnapshotOptions,
): Promise<ShellDashboardSnapshot> {
  const limit =
    typeof options?.limit === "number"
      ? Math.max(1, Math.min(Math.trunc(options.limit), 100))
      : 24;
  const [
    healthResult,
    sessionsResult,
    discoveryFeedResult,
    chainDataResult,
    reviewCenterResult,
  ] = await Promise.allSettled([
    buildGatewayHealthSnapshot(),
    requestUpstreamJson<QuorumSessionSummary[]>(
      "quorum",
      "orchestrate/sessions",
      undefined,
      { timeoutMs: options?.upstreamTimeoutMs },
    ),
    requestUpstreamJson<QuorumDiscoveryInboxFeed>(
      "quorum",
      "orchestrate/discovery/inbox",
      buildUpstreamQuery({ limit, status: "open" }),
      { timeoutMs: options?.upstreamTimeoutMs },
    ),
    loadShellChainGraphSnapshotData({
      discoveryIdeaLimit: limit,
      includeArchivedProjects: false,
      upstreamTimeoutMs: options?.upstreamTimeoutMs,
    }),
    buildShellReviewCenterSnapshot({
      upstreamTimeoutMs: options?.upstreamTimeoutMs,
    }),
  ]);

  const errors: string[] = [];

  const health =
    healthResult.status === "fulfilled"
      ? healthResult.value
      : (errors.push(formatUpstreamErrorMessage("Health", healthResult.reason)),
        null);
  const sessions =
    sessionsResult.status === "fulfilled"
      ? sortSessions(sessionsResult.value)
      : (errors.push(
          formatUpstreamErrorMessage(
            "Discovery sessions",
            sessionsResult.reason,
          ),
        ),
        []);
  const discoveryFeed =
    discoveryFeedResult.status === "fulfilled"
      ? discoveryFeedResult.value
      : (errors.push(
          formatUpstreamErrorMessage(
            "Discovery inbox",
            discoveryFeedResult.reason,
          ),
        ),
        emptyDiscoveryInboxFeed());
  const chainData =
    chainDataResult.status === "fulfilled"
      ? chainDataResult.value
      : {
          ideas: [] as QuorumDiscoveryIdea[],
          dossiers: [],
          projects: [] as AutopilotProjectSummary[],
          intakeSessions: [] as AutopilotIntakeSessionSummary[],
          issues: [] as AutopilotExecutionIssueRecord[],
          approvals: [] as AutopilotExecutionApprovalRecord[],
          runtimes: [] as AutopilotToolPermissionRuntimeRecord[],
          chains: [] as ShellChainRecord[],
          errors: [
            formatUpstreamErrorMessage(
              "Chain graph snapshot",
              chainDataResult.reason,
            ),
          ],
          loadState: "error" as const,
        };
  errors.push(...chainData.errors);
  const reviewCenter =
    reviewCenterResult.status === "fulfilled"
      ? reviewCenterResult.value
      : (errors.push(
          formatUpstreamErrorMessage(
            "Review center snapshot",
            reviewCenterResult.reason,
          ),
        ),
        emptyShellReviewCenterSnapshot());
  errors.push(...reviewCenter.errors);

  return {
    generatedAt: new Date().toISOString(),
    health,
    sessions: sessions.slice(0, limit),
    ideas: chainData.ideas,
    discoveryFeed,
    projects: chainData.projects.slice(0, limit),
    intakeSessions: chainData.intakeSessions.slice(0, limit),
    issues: chainData.issues.slice(0, limit),
    approvals: chainData.approvals.slice(0, limit),
    runtimes: chainData.runtimes.slice(0, limit),
    chains: chainData.chains.slice(0, limit),
    reviewCenter,
    errors,
    loadState:
      (healthResult.status === "rejected" ? 1 : 0) +
        (sessionsResult.status === "rejected" ? 1 : 0) +
        (discoveryFeedResult.status === "rejected" ? 1 : 0) +
        (chainData.loadState === "error" ? 1 : 0) +
        (reviewCenter.loadState === "error" ? 1 : 0) ===
      5
        ? "error"
        : "ready",
  };
}
