import type { QuorumIdeaDossier } from "@founderos/api-clients";
import type { LinkedShellChainRecord } from "@/lib/chain-graph";
import type { ShellChainGraphSnapshotData } from "@/lib/chain-graph-data";

import { loadShellChainGraphSnapshotData } from "@/lib/chain-graph-data";
import {
  buildShellDiscoveryAuthoringSummary,
  type ShellDiscoveryAuthoringSummary,
} from "@/lib/discovery-authoring";

export interface ShellDiscoveryAuthoringQueueRecord {
  key: string;
  dossier: QuorumIdeaDossier;
  authoring: ShellDiscoveryAuthoringSummary;
  chain: LinkedShellChainRecord | null;
  priority: number;
  searchText: string;
}

export interface ShellDiscoveryAuthoringQueueStats {
  totalCount: number;
  readyCount: number;
  needsWorkCount: number;
  linkedCount: number;
  attentionLinkedCount: number;
  evidenceGapCount: number;
  validationGapCount: number;
  decisionGapCount: number;
  timelineGapCount: number;
}

export interface ShellDiscoveryAuthoringQueueSnapshot {
  generatedAt: string;
  records: ShellDiscoveryAuthoringQueueRecord[];
  stats: ShellDiscoveryAuthoringQueueStats;
  error: string | null;
  loadState: "ready" | "error";
}

export const DISCOVERY_AUTHORING_STAGES = [
  "sourced",
  "ranked",
  "debated",
  "simulated",
  "swiped",
  "handed_off",
  "executed",
];

function stagePriority(stage: string) {
  if (stage === "executed") return 40;
  if (stage === "handed_off") return 35;
  if (stage === "simulated") return 25;
  if (stage === "debated") return 20;
  if (stage === "ranked" || stage === "swiped") return 15;
  return 10;
}

function buildAuthoringPriority(
  dossier: QuorumIdeaDossier,
  authoring: ShellDiscoveryAuthoringSummary,
  chain: LinkedShellChainRecord | null
) {
  return (
    authoring.gapCount * 100 +
    stagePriority(dossier.idea.latest_stage) +
    (chain ? 30 : 0) +
    (chain?.attention?.total ?? 0) * 3
  );
}

function buildSearchText(
  dossier: QuorumIdeaDossier,
  authoring: ShellDiscoveryAuthoringSummary,
  chain: LinkedShellChainRecord | null
) {
  return [
    dossier.idea.idea_id,
    dossier.idea.title,
    dossier.idea.summary,
    dossier.idea.thesis,
    dossier.idea.latest_stage,
    dossier.idea.topic_tags.join(" "),
    authoring.status,
    authoring.headline,
    authoring.detail,
    authoring.gaps.join(" "),
    chain?.briefId,
    chain?.project?.id,
    chain?.project?.name,
    chain?.intakeSession?.id,
    chain?.intakeSession?.title,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function sortAuthoringRecords(
  records: ShellDiscoveryAuthoringQueueRecord[]
) {
  return [...records].sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }

    const leftTime =
      Date.parse(
        left.authoring.lastUpdatedAt ||
          left.dossier.idea.updated_at ||
          left.dossier.idea.created_at ||
          ""
      ) || 0;
    const rightTime =
      Date.parse(
        right.authoring.lastUpdatedAt ||
          right.dossier.idea.updated_at ||
          right.dossier.idea.created_at ||
          ""
      ) || 0;

    return rightTime - leftTime;
  });
}

function emptyStats(): ShellDiscoveryAuthoringQueueStats {
  return {
    totalCount: 0,
    readyCount: 0,
    needsWorkCount: 0,
    linkedCount: 0,
    attentionLinkedCount: 0,
    evidenceGapCount: 0,
    validationGapCount: 0,
    decisionGapCount: 0,
    timelineGapCount: 0,
  };
}

export function buildDiscoveryAuthoringQueueStats(
  records: ShellDiscoveryAuthoringQueueRecord[]
) {
  return records.reduce<ShellDiscoveryAuthoringQueueStats>((stats, record) => {
    stats.totalCount += 1;

    if (record.authoring.gapCount === 0) {
      stats.readyCount += 1;
    } else {
      stats.needsWorkCount += 1;
    }

    if (record.chain) {
      stats.linkedCount += 1;
      if ((record.chain.attention?.total ?? 0) > 0) {
        stats.attentionLinkedCount += 1;
      }
    }

    if (record.authoring.gaps.includes("evidence")) {
      stats.evidenceGapCount += 1;
    }
    if (record.authoring.gaps.includes("validation")) {
      stats.validationGapCount += 1;
    }
    if (record.authoring.gaps.includes("decision")) {
      stats.decisionGapCount += 1;
    }
    if (record.authoring.gaps.includes("timeline")) {
      stats.timelineGapCount += 1;
    }

    return stats;
  }, emptyStats());
}

export function buildDiscoveryAuthoringQueueRecords(
  snapshot: Pick<ShellChainGraphSnapshotData, "chains" | "dossiers">
) {
  const linkedChainsByIdeaId = new Map(
    snapshot.chains
      .filter((record): record is LinkedShellChainRecord => record.kind === "linked")
      .map((record) => [record.idea.idea_id, record])
  );

  return sortAuthoringRecords(
    snapshot.dossiers.map((dossier) => {
      const chain = linkedChainsByIdeaId.get(dossier.idea.idea_id) ?? null;
      const authoring = chain?.authoring ?? buildShellDiscoveryAuthoringSummary(dossier);
      return {
        key: dossier.idea.idea_id,
        dossier,
        authoring,
        chain,
        priority: buildAuthoringPriority(dossier, authoring, chain),
        searchText: buildSearchText(dossier, authoring, chain),
      };
    })
  );
}

export function emptyShellDiscoveryAuthoringQueueSnapshot(): ShellDiscoveryAuthoringQueueSnapshot {
  return {
    generatedAt: "",
    records: [],
    stats: emptyStats(),
    error: null,
    loadState: "ready",
  };
}

type DiscoveryAuthoringQueueSnapshotOptions = {
  upstreamTimeoutMs?: number;
};

export async function buildDiscoveryAuthoringQueueSnapshot(
  options?: DiscoveryAuthoringQueueSnapshotOptions
): Promise<ShellDiscoveryAuthoringQueueSnapshot> {
  const snapshot = await loadShellChainGraphSnapshotData({
    discoveryIdeaLimit: 60,
    includeArchivedProjects: true,
    discoveryStages: DISCOVERY_AUTHORING_STAGES,
    upstreamTimeoutMs: options?.upstreamTimeoutMs,
  });
  const records = buildDiscoveryAuthoringQueueRecords(snapshot);

  return {
    generatedAt: new Date().toISOString(),
    records,
    stats: buildDiscoveryAuthoringQueueStats(records),
    error: snapshot.errors.length > 0 ? snapshot.errors.join(" ") : null,
    loadState: snapshot.loadState,
  };
}
