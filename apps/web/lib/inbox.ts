import type {
  AutopilotExecutionApprovalRecord,
  AutopilotExecutionIssueRecord,
  AutopilotIntakeSessionSummary,
  AutopilotProjectSummary,
  AutopilotToolPermissionRuntimeRecord,
  QuorumDiscoveryInboxFeed,
} from "@founderos/api-clients";
import type { ShellChainRecord } from "@/lib/chain-graph";

import { loadShellChainGraphSnapshotData } from "@/lib/chain-graph-data";
import {
  buildUpstreamQuery,
  formatUpstreamErrorMessage,
  requestUpstreamJson,
} from "@/lib/upstream";

export interface ShellInboxSnapshot {
  generatedAt: string;
  discoveryFeed: QuorumDiscoveryInboxFeed;
  projects: AutopilotProjectSummary[];
  intakeSessions: AutopilotIntakeSessionSummary[];
  approvals: AutopilotExecutionApprovalRecord[];
  issues: AutopilotExecutionIssueRecord[];
  runtimes: AutopilotToolPermissionRuntimeRecord[];
  chains: ShellChainRecord[];
  errors: string[];
  loadState: "ready" | "error";
}

export function emptyDiscoveryInboxFeed(): QuorumDiscoveryInboxFeed {
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

export async function buildInboxSnapshot(options?: {
  limit?: number;
}): Promise<ShellInboxSnapshot> {
  const limit =
    typeof options?.limit === "number"
      ? Math.max(1, Math.min(Math.trunc(options.limit), 100))
      : 50;
  const [discoveryResult, chainDataResult] = await Promise.allSettled([
    requestUpstreamJson<QuorumDiscoveryInboxFeed>(
      "quorum",
      "orchestrate/discovery/inbox",
      buildUpstreamQuery({ limit, status: "open" }),
    ),
    loadShellChainGraphSnapshotData({
      discoveryIdeaLimit: limit,
      includeArchivedProjects: true,
    }),
  ]);

  const errors: string[] = [];

  const discoveryFeed =
    discoveryResult.status === "fulfilled"
      ? discoveryResult.value
      : (errors.push(
          formatUpstreamErrorMessage("Discovery inbox", discoveryResult.reason),
        ),
        emptyDiscoveryInboxFeed());
  const chainData =
    chainDataResult.status === "fulfilled"
      ? chainDataResult.value
      : {
          ideas: [],
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

  return {
    generatedAt: new Date().toISOString(),
    discoveryFeed,
    projects: chainData.projects.slice(0, limit),
    intakeSessions: chainData.intakeSessions.slice(0, limit),
    approvals: chainData.approvals.slice(0, limit),
    issues: chainData.issues.slice(0, limit),
    runtimes: chainData.runtimes.slice(0, limit),
    chains: chainData.chains.slice(0, limit),
    errors,
    loadState:
      discoveryResult.status === "rejected" && chainData.loadState === "error"
        ? "error"
        : "ready",
  };
}
