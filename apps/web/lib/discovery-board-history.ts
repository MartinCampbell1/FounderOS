import type {
  QuorumDiscoveryIdea,
  QuorumIdeaArchiveSnapshot,
  QuorumRankingLeaderboardResponse,
} from "@founderos/api-clients";

import {
  buildUpstreamQuery,
  formatUpstreamErrorMessage,
  requestUpstreamJson,
} from "@/lib/upstream";

export interface ShellDiscoveryArchiveSnapshot {
  generatedAt: string;
  archive: QuorumIdeaArchiveSnapshot | null;
  archiveError: string | null;
  archiveLoadState: "ready" | "error";
  leaderboard: QuorumRankingLeaderboardResponse | null;
  leaderboardError: string | null;
  leaderboardLoadState: "ready" | "error";
  ideas: QuorumDiscoveryIdea[];
  ideasError: string | null;
  ideasLoadState: "ready" | "error";
  errors: string[];
  loadState: "ready" | "error";
}

export interface ShellDiscoveryFinalsSnapshot {
  generatedAt: string;
  archive: QuorumIdeaArchiveSnapshot | null;
  archiveError: string | null;
  archiveLoadState: "ready" | "error";
  leaderboard: QuorumRankingLeaderboardResponse | null;
  leaderboardError: string | null;
  leaderboardLoadState: "ready" | "error";
  ideas: QuorumDiscoveryIdea[];
  ideasError: string | null;
  ideasLoadState: "ready" | "error";
  errors: string[];
  loadState: "ready" | "error";
}

function sortDiscoveryIdeas(items: QuorumDiscoveryIdea[]) {
  return [...items].sort((left, right) => {
    const archivedDelta =
      Number(left.validation_state === "archived") -
      Number(right.validation_state === "archived");
    if (archivedDelta !== 0) {
      return archivedDelta;
    }

    const rankDelta = right.rank_score - left.rank_score;
    if (rankDelta !== 0) {
      return rankDelta;
    }

    const leftTime = Date.parse(left.updated_at || left.created_at || "") || 0;
    const rightTime = Date.parse(right.updated_at || right.created_at || "") || 0;
    return rightTime - leftTime;
  });
}

function emptySharedSnapshot() {
  return {
    generatedAt: "",
    archive: null,
    archiveError: null,
    archiveLoadState: "ready" as const,
    leaderboard: null,
    leaderboardError: null,
    leaderboardLoadState: "ready" as const,
    ideas: [],
    ideasError: null,
    ideasLoadState: "ready" as const,
    errors: [],
    loadState: "ready" as const,
  };
}

export function emptyShellDiscoveryArchiveSnapshot(): ShellDiscoveryArchiveSnapshot {
  return emptySharedSnapshot();
}

export function emptyShellDiscoveryFinalsSnapshot(): ShellDiscoveryFinalsSnapshot {
  return emptySharedSnapshot();
}

async function buildSharedBoardHistorySnapshot(options?: {
  archiveLimitCells?: number;
  ideaLimit?: number;
  leaderboardLimit?: number;
}): Promise<ShellDiscoveryArchiveSnapshot> {
  const archiveLimitCells = Math.max(
    1,
    Math.min(Math.trunc(options?.archiveLimitCells ?? 20), 60)
  );
  const ideaLimit = Math.max(1, Math.min(Math.trunc(options?.ideaLimit ?? 32), 120));
  const leaderboardLimit = Math.max(
    2,
    Math.min(Math.trunc(options?.leaderboardLimit ?? 16), 100)
  );

  const [archiveResult, leaderboardResult, ideasResult] = await Promise.allSettled([
    requestUpstreamJson<QuorumIdeaArchiveSnapshot>(
      "quorum",
      "orchestrate/ranking/archive",
      buildUpstreamQuery({ limit_cells: archiveLimitCells })
    ),
    requestUpstreamJson<QuorumRankingLeaderboardResponse>(
      "quorum",
      "orchestrate/ranking/leaderboard",
      buildUpstreamQuery({ limit: leaderboardLimit })
    ),
    requestUpstreamJson<{ ideas: QuorumDiscoveryIdea[] }>(
      "quorum",
      "orchestrate/discovery/ideas",
      buildUpstreamQuery({ limit: ideaLimit })
    ),
  ]);

  const errors: string[] = [];
  const archive =
    archiveResult.status === "fulfilled"
      ? archiveResult.value
      : (errors.push(
          formatUpstreamErrorMessage("Ranking archive", archiveResult.reason)
        ),
        null);
  const leaderboard =
    leaderboardResult.status === "fulfilled"
      ? leaderboardResult.value
      : (errors.push(
          formatUpstreamErrorMessage("Ranking leaderboard", leaderboardResult.reason)
        ),
        null);
  const ideas =
    ideasResult.status === "fulfilled"
      ? sortDiscoveryIdeas(ideasResult.value.ideas)
      : (errors.push(
          formatUpstreamErrorMessage("Discovery ideas", ideasResult.reason)
        ),
        []);

  return {
    generatedAt: new Date().toISOString(),
    archive,
    archiveError:
      archiveResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage("Ranking archive", archiveResult.reason),
    archiveLoadState: archiveResult.status === "fulfilled" ? "ready" : "error",
    leaderboard,
    leaderboardError:
      leaderboardResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage("Ranking leaderboard", leaderboardResult.reason),
    leaderboardLoadState:
      leaderboardResult.status === "fulfilled" ? "ready" : "error",
    ideas,
    ideasError:
      ideasResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage("Discovery ideas", ideasResult.reason),
    ideasLoadState: ideasResult.status === "fulfilled" ? "ready" : "error",
    errors,
    loadState:
      archiveResult.status === "fulfilled" ||
      leaderboardResult.status === "fulfilled" ||
      ideasResult.status === "fulfilled"
        ? "ready"
        : "error",
  };
}

export async function buildDiscoveryArchiveSnapshot(options?: {
  archiveLimitCells?: number;
  ideaLimit?: number;
  leaderboardLimit?: number;
}): Promise<ShellDiscoveryArchiveSnapshot> {
  return buildSharedBoardHistorySnapshot({
    archiveLimitCells: options?.archiveLimitCells ?? 24,
    ideaLimit: options?.ideaLimit ?? 40,
    leaderboardLimit: options?.leaderboardLimit ?? 20,
  });
}

export async function buildDiscoveryFinalsSnapshot(options?: {
  archiveLimitCells?: number;
  ideaLimit?: number;
  leaderboardLimit?: number;
}): Promise<ShellDiscoveryFinalsSnapshot> {
  return buildSharedBoardHistorySnapshot({
    archiveLimitCells: options?.archiveLimitCells ?? 16,
    ideaLimit: options?.ideaLimit ?? 24,
    leaderboardLimit: options?.leaderboardLimit ?? 12,
  });
}
