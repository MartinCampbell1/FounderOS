import type {
  QuorumDiscoveryIdea,
  QuorumIdeaArchiveSnapshot,
  QuorumMarketSimulationReport,
  QuorumNextPairResponse,
  QuorumRankingLeaderboardResponse,
  QuorumSimulationFeedbackReport,
} from "@founderos/api-clients";

import {
  buildUpstreamQuery,
  formatUpstreamErrorMessage,
  requestUpstreamJson,
} from "@/lib/upstream";

export interface ShellDiscoveryRankingSnapshot {
  generatedAt: string;
  leaderboard: QuorumRankingLeaderboardResponse | null;
  leaderboardError: string | null;
  leaderboardLoadState: "ready" | "error";
  nextPair: QuorumNextPairResponse | null;
  nextPairError: string | null;
  nextPairLoadState: "ready" | "error";
  archive: QuorumIdeaArchiveSnapshot | null;
  archiveError: string | null;
  archiveLoadState: "ready" | "error";
  errors: string[];
  loadState: "ready" | "error";
}

export interface ShellDiscoverySimulationSnapshot {
  generatedAt: string;
  ideas: QuorumDiscoveryIdea[];
  ideasError: string | null;
  ideasLoadState: "ready" | "error";
  selectedIdea: QuorumDiscoveryIdea | null;
  selectedIdeaError: string | null;
  selectedIdeaLoadState: "idle" | "ready" | "error";
  personaReport: QuorumSimulationFeedbackReport | null;
  personaReportError: string | null;
  personaReportLoadState: "idle" | "ready" | "error";
  marketReport: QuorumMarketSimulationReport | null;
  marketReportError: string | null;
  marketReportLoadState: "idle" | "ready" | "error";
  errors: string[];
  loadState: "ready" | "error";
}

function sortDiscoveryIdeas(items: QuorumDiscoveryIdea[]) {
  return [...items]
    .filter((idea) => idea.validation_state !== "archived")
    .sort((left, right) => {
      const rankDelta = right.rank_score - left.rank_score;
      if (rankDelta !== 0) {
        return rankDelta;
      }

      const leftTime = Date.parse(left.updated_at || left.created_at || "") || 0;
      const rightTime = Date.parse(right.updated_at || right.created_at || "") || 0;
      return rightTime - leftTime;
    });
}

export function emptyShellDiscoveryRankingSnapshot(): ShellDiscoveryRankingSnapshot {
  return {
    generatedAt: "",
    leaderboard: null,
    leaderboardError: null,
    leaderboardLoadState: "ready",
    nextPair: null,
    nextPairError: null,
    nextPairLoadState: "ready",
    archive: null,
    archiveError: null,
    archiveLoadState: "ready",
    errors: [],
    loadState: "ready",
  };
}

export function emptyShellDiscoverySimulationSnapshot(): ShellDiscoverySimulationSnapshot {
  return {
    generatedAt: "",
    ideas: [],
    ideasError: null,
    ideasLoadState: "ready",
    selectedIdea: null,
    selectedIdeaError: null,
    selectedIdeaLoadState: "idle",
    personaReport: null,
    personaReportError: null,
    personaReportLoadState: "idle",
    marketReport: null,
    marketReportError: null,
    marketReportLoadState: "idle",
    errors: [],
    loadState: "ready",
  };
}

export async function buildDiscoveryRankingSnapshot(options?: {
  leaderboardLimit?: number;
  archiveLimitCells?: number;
}): Promise<ShellDiscoveryRankingSnapshot> {
  const leaderboardLimit = Math.max(
    1,
    Math.min(Math.trunc(options?.leaderboardLimit ?? 16), 100)
  );
  const archiveLimitCells = Math.max(
    1,
    Math.min(Math.trunc(options?.archiveLimitCells ?? 12), 50)
  );

  const [leaderboardResult, nextPairResult, archiveResult] =
    await Promise.allSettled([
      requestUpstreamJson<QuorumRankingLeaderboardResponse>(
        "quorum",
        "orchestrate/ranking/leaderboard",
        buildUpstreamQuery({ limit: leaderboardLimit })
      ),
      requestUpstreamJson<{ pair?: QuorumNextPairResponse | null }>(
        "quorum",
        "orchestrate/ranking/next-pair"
      ),
      requestUpstreamJson<QuorumIdeaArchiveSnapshot>(
        "quorum",
        "orchestrate/ranking/archive",
        buildUpstreamQuery({ limit_cells: archiveLimitCells })
      ),
    ]);

  const errors: string[] = [];

  const leaderboard =
    leaderboardResult.status === "fulfilled"
      ? leaderboardResult.value
      : (errors.push(
          formatUpstreamErrorMessage("Ranking leaderboard", leaderboardResult.reason)
        ),
        null);
  const nextPair =
    nextPairResult.status === "fulfilled"
      ? nextPairResult.value.pair ?? null
      : (errors.push(
          formatUpstreamErrorMessage("Ranking next pair", nextPairResult.reason)
        ),
        null);
  const archive =
    archiveResult.status === "fulfilled"
      ? archiveResult.value
      : (errors.push(
          formatUpstreamErrorMessage("Ranking archive", archiveResult.reason)
        ),
        null);

  return {
    generatedAt: new Date().toISOString(),
    leaderboard,
    leaderboardError:
      leaderboardResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage("Ranking leaderboard", leaderboardResult.reason),
    leaderboardLoadState:
      leaderboardResult.status === "fulfilled" ? "ready" : "error",
    nextPair,
    nextPairError:
      nextPairResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage("Ranking next pair", nextPairResult.reason),
    nextPairLoadState: nextPairResult.status === "fulfilled" ? "ready" : "error",
    archive,
    archiveError:
      archiveResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage("Ranking archive", archiveResult.reason),
    archiveLoadState: archiveResult.status === "fulfilled" ? "ready" : "error",
    errors,
    loadState:
      leaderboardResult.status === "fulfilled" ||
      nextPairResult.status === "fulfilled" ||
      archiveResult.status === "fulfilled"
        ? "ready"
        : "error",
  };
}

export async function buildDiscoverySimulationSnapshot(
  ideaId: string | null,
  options?: {
    ideaLimit?: number;
  }
): Promise<ShellDiscoverySimulationSnapshot> {
  const ideaLimit = Math.max(
    1,
    Math.min(Math.trunc(options?.ideaLimit ?? 18), 100)
  );
  const normalizedIdeaId = (ideaId || "").trim();

  const [ideasResult, selectedIdeaResult, personaReportResult, marketReportResult] =
    await Promise.allSettled([
      requestUpstreamJson<{ ideas: QuorumDiscoveryIdea[] }>(
        "quorum",
        "orchestrate/discovery/ideas",
        buildUpstreamQuery({ limit: ideaLimit })
      ),
      normalizedIdeaId
        ? requestUpstreamJson<QuorumDiscoveryIdea>(
            "quorum",
            `orchestrate/discovery/ideas/${encodeURIComponent(normalizedIdeaId)}`
          )
        : Promise.resolve(null),
      normalizedIdeaId
        ? requestUpstreamJson<QuorumSimulationFeedbackReport>(
            "quorum",
            `orchestrate/discovery/ideas/${encodeURIComponent(normalizedIdeaId)}/simulation`
          )
        : Promise.resolve(null),
      normalizedIdeaId
        ? requestUpstreamJson<QuorumMarketSimulationReport>(
            "quorum",
            `orchestrate/discovery/ideas/${encodeURIComponent(normalizedIdeaId)}/simulation/lab`
          )
        : Promise.resolve(null),
    ]);

  const errors: string[] = [];

  const ideas =
    ideasResult.status === "fulfilled"
      ? sortDiscoveryIdeas(ideasResult.value.ideas)
      : (errors.push(formatUpstreamErrorMessage("Discovery ideas", ideasResult.reason)),
        []);
  const selectedIdea =
    selectedIdeaResult.status === "fulfilled"
      ? selectedIdeaResult.value
      : normalizedIdeaId
        ? (errors.push(
            formatUpstreamErrorMessage(
              "Discovery idea detail",
              selectedIdeaResult.reason
            )
          ),
          null)
        : null;
  const personaReport =
    personaReportResult.status === "fulfilled"
      ? personaReportResult.value
      : normalizedIdeaId
        ? (errors.push(
            formatUpstreamErrorMessage(
              "Persona simulation report",
              personaReportResult.reason
            )
          ),
          null)
        : null;
  const marketReport =
    marketReportResult.status === "fulfilled"
      ? marketReportResult.value
      : normalizedIdeaId
        ? (errors.push(
            formatUpstreamErrorMessage(
              "Market simulation report",
              marketReportResult.reason
            )
          ),
          null)
        : null;

  return {
    generatedAt: new Date().toISOString(),
    ideas,
    ideasError:
      ideasResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage("Discovery ideas", ideasResult.reason),
    ideasLoadState: ideasResult.status === "fulfilled" ? "ready" : "error",
    selectedIdea,
    selectedIdeaError:
      !normalizedIdeaId
        ? null
        : selectedIdeaResult.status === "fulfilled"
          ? null
          : formatUpstreamErrorMessage(
              "Discovery idea detail",
              selectedIdeaResult.reason
            ),
    selectedIdeaLoadState: !normalizedIdeaId
      ? "idle"
      : selectedIdeaResult.status === "fulfilled"
        ? "ready"
        : "error",
    personaReport,
    personaReportError:
      !normalizedIdeaId
        ? null
        : personaReportResult.status === "fulfilled"
          ? null
          : formatUpstreamErrorMessage(
              "Persona simulation report",
              personaReportResult.reason
            ),
    personaReportLoadState: !normalizedIdeaId
      ? "idle"
      : personaReportResult.status === "fulfilled"
        ? "ready"
        : "error",
    marketReport,
    marketReportError:
      !normalizedIdeaId
        ? null
        : marketReportResult.status === "fulfilled"
          ? null
          : formatUpstreamErrorMessage(
              "Market simulation report",
              marketReportResult.reason
            ),
    marketReportLoadState: !normalizedIdeaId
      ? "idle"
      : marketReportResult.status === "fulfilled"
        ? "ready"
        : "error",
    errors,
    loadState:
      ideasResult.status === "fulfilled" ||
      selectedIdeaResult.status === "fulfilled" ||
      personaReportResult.status === "fulfilled" ||
      marketReportResult.status === "fulfilled"
        ? "ready"
        : "error",
  };
}
