import type {
  QuorumRepoDNAProfile,
  QuorumRepoDigestResult,
  QuorumRepoGraphResult,
  QuorumRepoGraphStats,
  QuorumRepoGraphTrigger,
} from "@founderos/api-clients";

export interface ShellDiscoveryRepoGraphSummary {
  graphId: string;
  source: string;
  repoName: string;
  trigger: QuorumRepoGraphTrigger;
  generatedAt: string;
  warningsCount: number;
  cacheHit: boolean;
  stats: QuorumRepoGraphStats;
}

export interface ShellDiscoveryIntelligenceRecord {
  profile: QuorumRepoDNAProfile;
  latestGraph: ShellDiscoveryRepoGraphSummary | null;
  graphCount: number;
}

export interface ShellDiscoveryIntelligenceSnapshot {
  generatedAt: string;
  records: ShellDiscoveryIntelligenceRecord[];
  recordsError: string | null;
  recordsLoadState: "ready" | "error";
  selectedProfileId: string | null;
  selectedDigest: QuorumRepoDigestResult | null;
  selectedDigestError: string | null;
  selectedDigestLoadState: "idle" | "ready" | "error";
  selectedGraph: QuorumRepoGraphResult | null;
  selectedGraphError: string | null;
  selectedGraphLoadState: "idle" | "ready" | "error";
}

export function emptyShellDiscoveryIntelligenceSnapshot(): ShellDiscoveryIntelligenceSnapshot {
  return {
    generatedAt: "",
    records: [],
    recordsError: null,
    recordsLoadState: "ready",
    selectedProfileId: null,
    selectedDigest: null,
    selectedDigestError: null,
    selectedDigestLoadState: "idle",
    selectedGraph: null,
    selectedGraphError: null,
    selectedGraphLoadState: "idle",
  };
}
