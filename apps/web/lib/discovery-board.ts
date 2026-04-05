import type {
  QuorumDiscoveryIdea,
  QuorumDiscoveryObservabilityScoreboard,
  QuorumNextPairResponse,
  QuorumRankingLeaderboardResponse,
  QuorumSwipeQueueResponse,
} from "@founderos/api-clients";

import {
  buildUpstreamQuery,
  formatUpstreamErrorMessage,
  requestUpstreamJson,
} from "@/lib/upstream";

export interface ShellDiscoveryBoardSnapshot {
  generatedAt: string;
  scoreboard: QuorumDiscoveryObservabilityScoreboard | null;
  scoreboardError: string | null;
  scoreboardLoadState: "ready" | "error";
  leaderboard: QuorumRankingLeaderboardResponse | null;
  nextPair: QuorumNextPairResponse | null;
  rankingError: string | null;
  rankingLoadState: "ready" | "error";
  swipeQueue: QuorumSwipeQueueResponse | null;
  swipeQueueError: string | null;
  swipeQueueLoadState: "ready" | "error";
  simulationIdeas: QuorumDiscoveryIdea[];
  simulationIdeasError: string | null;
  simulationIdeasLoadState: "ready" | "error";
  errors: string[];
  loadState: "ready" | "error";
}

function simulationPriority(idea: QuorumDiscoveryIdea) {
  if (idea.latest_stage === "executed") return 5;
  if (idea.latest_stage === "handed_off") return 4;
  if (idea.latest_stage === "simulated") return 3;
  if (idea.simulation_state && idea.simulation_state !== "idle") return 2;
  return 1;
}

function sortDiscoveryIdeas(items: QuorumDiscoveryIdea[]) {
  return [...items].sort((left, right) => {
    const stageDelta = simulationPriority(right) - simulationPriority(left);
    if (stageDelta !== 0) {
      return stageDelta;
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

export function emptyShellDiscoveryBoardSnapshot(): ShellDiscoveryBoardSnapshot {
  return {
    generatedAt: "",
    scoreboard: null,
    scoreboardError: null,
    scoreboardLoadState: "ready",
    leaderboard: null,
    nextPair: null,
    rankingError: null,
    rankingLoadState: "ready",
    swipeQueue: null,
    swipeQueueError: null,
    swipeQueueLoadState: "ready",
    simulationIdeas: [],
    simulationIdeasError: null,
    simulationIdeasLoadState: "ready",
    errors: [],
    loadState: "ready",
  };
}

export async function buildDiscoveryBoardSnapshot(): Promise<ShellDiscoveryBoardSnapshot> {
  const [scoreboardResult, rankingResult, nextPairResult, swipeQueueResult, ideasResult] =
    await Promise.allSettled([
      requestUpstreamJson<QuorumDiscoveryObservabilityScoreboard>(
        "quorum",
        "orchestrate/observability/scoreboards/discovery"
      ),
      requestUpstreamJson<QuorumRankingLeaderboardResponse>(
        "quorum",
        "orchestrate/ranking/leaderboard",
        buildUpstreamQuery({ limit: 10 })
      ),
      requestUpstreamJson<{ pair?: QuorumNextPairResponse | null }>(
        "quorum",
        "orchestrate/ranking/next-pair"
      ),
      requestUpstreamJson<QuorumSwipeQueueResponse>(
        "quorum",
        "orchestrate/discovery/swipe-queue",
        buildUpstreamQuery({ limit: 6 })
      ),
      requestUpstreamJson<{ ideas: QuorumDiscoveryIdea[] }>(
        "quorum",
        "orchestrate/discovery/ideas",
        buildUpstreamQuery({ limit: 18 })
      ),
    ]);

  const errors: string[] = [];

  const scoreboard =
    scoreboardResult.status === "fulfilled"
      ? scoreboardResult.value
      : (errors.push(
          formatUpstreamErrorMessage(
            "Discovery observability scoreboard",
            scoreboardResult.reason
          )
        ),
        null);

  const leaderboard =
    rankingResult.status === "fulfilled"
      ? rankingResult.value
      : (errors.push(
          formatUpstreamErrorMessage("Ranking leaderboard", rankingResult.reason)
        ),
        null);

  const nextPair =
    nextPairResult.status === "fulfilled"
      ? nextPairResult.value.pair ?? null
      : (errors.push(
          formatUpstreamErrorMessage("Ranking next pair", nextPairResult.reason)
        ),
        null);

  const swipeQueue =
    swipeQueueResult.status === "fulfilled"
      ? swipeQueueResult.value
      : (errors.push(
          formatUpstreamErrorMessage("Swipe queue", swipeQueueResult.reason)
        ),
        null);

  const simulationIdeas =
    ideasResult.status === "fulfilled"
      ? sortDiscoveryIdeas(
          ideasResult.value.ideas.filter(
            (idea) => idea.validation_state !== "archived"
          )
        ).slice(0, 6)
      : (errors.push(
          formatUpstreamErrorMessage("Discovery ideas", ideasResult.reason)
        ),
        []);

  return {
    generatedAt: new Date().toISOString(),
    scoreboard,
    scoreboardError:
      scoreboardResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage(
            "Discovery observability scoreboard",
            scoreboardResult.reason
          ),
    scoreboardLoadState: scoreboardResult.status === "fulfilled" ? "ready" : "error",
    leaderboard,
    nextPair,
    rankingError:
      rankingResult.status === "fulfilled" && nextPairResult.status === "fulfilled"
        ? null
        : [
            rankingResult.status === "rejected"
              ? formatUpstreamErrorMessage("Ranking leaderboard", rankingResult.reason)
              : null,
            nextPairResult.status === "rejected"
              ? formatUpstreamErrorMessage("Ranking next pair", nextPairResult.reason)
              : null,
          ]
            .filter(Boolean)
            .join(" "),
    rankingLoadState:
      rankingResult.status === "fulfilled" && nextPairResult.status === "fulfilled"
        ? "ready"
        : "error",
    swipeQueue,
    swipeQueueError:
      swipeQueueResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage("Swipe queue", swipeQueueResult.reason),
    swipeQueueLoadState: swipeQueueResult.status === "fulfilled" ? "ready" : "error",
    simulationIdeas,
    simulationIdeasError:
      ideasResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage("Discovery ideas", ideasResult.reason),
    simulationIdeasLoadState: ideasResult.status === "fulfilled" ? "ready" : "error",
    errors,
    loadState:
      scoreboardResult.status === "fulfilled" ||
      rankingResult.status === "fulfilled" ||
      swipeQueueResult.status === "fulfilled" ||
      ideasResult.status === "fulfilled"
        ? "ready"
        : "error",
  };
}
