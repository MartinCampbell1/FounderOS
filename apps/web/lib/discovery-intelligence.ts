import type {
  QuorumRepoDNAProfile,
  QuorumRepoDigestResult,
  QuorumRepoGraphResult,
} from "@founderos/api-clients";

import type {
  ShellDiscoveryIntelligenceRecord,
  ShellDiscoveryIntelligenceSnapshot,
  ShellDiscoveryRepoGraphSummary,
} from "@/lib/discovery-intelligence-model";
import {
  buildUpstreamQuery,
  formatUpstreamErrorMessage,
  requestUpstreamJson,
} from "@/lib/upstream";

function sortProfiles(items: QuorumRepoDNAProfile[]) {
  return [...items].sort((left, right) => right.generated_at - left.generated_at);
}

function sortGraphs(items: QuorumRepoGraphResult[]) {
  return [...items].sort((left, right) => right.generated_at - left.generated_at);
}

function normalizeSourceKey(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function graphSummary(graph: QuorumRepoGraphResult): ShellDiscoveryRepoGraphSummary {
  return {
    graphId: graph.graph_id,
    source: graph.source,
    repoName: graph.repo_name,
    trigger: graph.trigger,
    generatedAt: new Date(graph.generated_at * 1000).toISOString(),
    warningsCount: graph.warnings.length,
    cacheHit: graph.cache_hit,
    stats: graph.stats,
  };
}

function buildRecords(
  profiles: QuorumRepoDNAProfile[],
  graphs: QuorumRepoGraphResult[]
): ShellDiscoveryIntelligenceRecord[] {
  const graphGroups = new Map<string, QuorumRepoGraphResult[]>();
  for (const graph of graphs) {
    const key = normalizeSourceKey(graph.source);
    const bucket = graphGroups.get(key);
    if (bucket) {
      bucket.push(graph);
      continue;
    }
    graphGroups.set(key, [graph]);
  }

  for (const bucket of graphGroups.values()) {
    bucket.sort((left, right) => right.generated_at - left.generated_at);
  }

  return profiles.map((profile) => {
    const graphsForSource = graphGroups.get(normalizeSourceKey(profile.source)) ?? [];
    return {
      profile,
      latestGraph: graphsForSource[0] ? graphSummary(graphsForSource[0]) : null,
      graphCount: graphsForSource.length,
    };
  });
}

export async function buildDiscoveryIntelligenceSnapshot(
  profileId: string | null,
  options?: {
    limit?: number | null;
  }
): Promise<ShellDiscoveryIntelligenceSnapshot> {
  const limit =
    typeof options?.limit === "number"
      ? Math.max(1, Math.min(Math.trunc(options.limit), 24))
      : 12;
  const [profilesResult, graphsResult] = await Promise.allSettled([
    requestUpstreamJson<{ items: QuorumRepoDNAProfile[] }>(
      "quorum",
      "orchestrate/repo-digest/profiles",
      buildUpstreamQuery({ limit })
    ),
    requestUpstreamJson<{ items: QuorumRepoGraphResult[] }>(
      "quorum",
      "orchestrate/repo-graph/results",
      buildUpstreamQuery({ limit })
    ),
  ]);

  const profiles =
    profilesResult.status === "fulfilled"
      ? sortProfiles(profilesResult.value.items)
      : [];
  const graphs =
    graphsResult.status === "fulfilled" ? sortGraphs(graphsResult.value.items) : [];
  const records = buildRecords(profiles, graphs);
  const requestedProfileId = (profileId || "").trim();
  const selectedProfileId =
    requestedProfileId || records[0]?.profile.profile_id || null;

  const digestResult =
    selectedProfileId
      ? await Promise.allSettled([
          requestUpstreamJson<QuorumRepoDigestResult>(
            "quorum",
            `orchestrate/repo-digest/results/${encodeURIComponent(selectedProfileId)}`
          ),
        ]).then((results) => results[0])
      : null;

  const selectedSource =
    records.find((record) => record.profile.profile_id === selectedProfileId)?.profile.source ||
    (digestResult && digestResult.status === "fulfilled"
      ? digestResult.value.profile.source
      : "");
  const selectedGraphSummary =
    records.find((record) => record.profile.profile_id === selectedProfileId)
      ?.latestGraph ??
    (selectedSource
      ? buildRecords(
          digestResult && digestResult.status === "fulfilled"
            ? [digestResult.value.profile]
            : [],
          graphs
        )[0]?.latestGraph ?? null
      : null);

  const graphResult =
    selectedGraphSummary
      ? await Promise.allSettled([
          requestUpstreamJson<QuorumRepoGraphResult>(
            "quorum",
            `orchestrate/repo-graph/results/${encodeURIComponent(selectedGraphSummary.graphId)}`
          ),
        ]).then((results) => results[0])
      : null;

  return {
    generatedAt: new Date().toISOString(),
    records,
    recordsError:
      profilesResult.status === "fulfilled" && graphsResult.status === "fulfilled"
        ? null
        : [
            profilesResult.status === "rejected"
              ? formatUpstreamErrorMessage(
                  "Repo intelligence profiles",
                  profilesResult.reason
                )
              : null,
            graphsResult.status === "rejected"
              ? formatUpstreamErrorMessage("Repo graph results", graphsResult.reason)
              : null,
          ]
            .filter(Boolean)
            .join(" "),
    recordsLoadState:
      profilesResult.status === "fulfilled" && graphsResult.status === "fulfilled"
        ? "ready"
        : "error",
    selectedProfileId,
    selectedDigest:
      digestResult && digestResult.status === "fulfilled" ? digestResult.value : null,
    selectedDigestError:
      !selectedProfileId
        ? null
        : digestResult && digestResult.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Repo digest result",
              digestResult.reason
            )
          : null,
    selectedDigestLoadState:
      !selectedProfileId
        ? "idle"
        : digestResult && digestResult.status === "fulfilled"
          ? "ready"
          : "error",
    selectedGraph:
      graphResult && graphResult.status === "fulfilled" ? graphResult.value : null,
    selectedGraphError:
      !selectedGraphSummary
        ? null
        : graphResult && graphResult.status === "rejected"
          ? formatUpstreamErrorMessage("Repo graph result", graphResult.reason)
          : null,
    selectedGraphLoadState:
      !selectedGraphSummary
        ? "idle"
        : graphResult && graphResult.status === "fulfilled"
          ? "ready"
          : "error",
  };
}
