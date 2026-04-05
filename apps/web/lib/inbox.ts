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

export async function buildInboxSnapshot(): Promise<ShellInboxSnapshot> {
  const [discoveryResult, chainDataResult] = await Promise.allSettled([
    requestUpstreamJson<QuorumDiscoveryInboxFeed>(
      "quorum",
      "orchestrate/discovery/inbox",
      buildUpstreamQuery({ limit: 50, status: "open" })
    ),
    loadShellChainGraphSnapshotData({
      discoveryIdeaLimit: 100,
      includeArchivedProjects: true,
    }),
  ]);

  const errors: string[] = [];

  const discoveryFeed =
    discoveryResult.status === "fulfilled"
      ? discoveryResult.value
      : (errors.push(
          formatUpstreamErrorMessage("Discovery inbox", discoveryResult.reason)
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
              chainDataResult.reason
            ),
          ],
          loadState: "error" as const,
        };
  errors.push(...chainData.errors);

  return {
    generatedAt: new Date().toISOString(),
    discoveryFeed,
    projects: chainData.projects,
    intakeSessions: chainData.intakeSessions,
    approvals: chainData.approvals,
    issues: chainData.issues,
    runtimes: chainData.runtimes,
    chains: chainData.chains,
    errors,
    loadState:
      discoveryResult.status === "rejected" && chainData.loadState === "error"
        ? "error"
        : "ready",
  };
}
