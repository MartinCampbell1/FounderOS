import type {
  QuorumDebateReplaySession,
  QuorumDiscoveryObservabilityScoreboard,
  QuorumDiscoveryTraceSnapshot,
  QuorumIdeaTraceBundle,
  QuorumSessionSummary,
} from "@founderos/api-clients";

import {
  buildUpstreamQuery,
  formatUpstreamErrorMessage,
  requestUpstreamJson,
} from "@/lib/upstream";

export interface ShellDiscoveryTracesSnapshot {
  generatedAt: string;
  scoreboard: QuorumDiscoveryObservabilityScoreboard | null;
  scoreboardError: string | null;
  scoreboardLoadState: "ready" | "error";
  traces: QuorumDiscoveryTraceSnapshot | null;
  tracesError: string | null;
  tracesLoadState: "ready" | "error";
  ideaTrace: QuorumIdeaTraceBundle | null;
  ideaTraceError: string | null;
  ideaTraceLoadState: "idle" | "ready" | "error";
  errors: string[];
  loadState: "ready" | "error";
}

export interface ShellDiscoveryReplaySnapshot {
  generatedAt: string;
  sessions: QuorumSessionSummary[];
  sessionsError: string | null;
  sessionsLoadState: "ready" | "error";
  replay: QuorumDebateReplaySession | null;
  replayError: string | null;
  replayLoadState: "idle" | "ready" | "error";
  errors: string[];
  loadState: "ready" | "error";
}

function sortSessions(items: QuorumSessionSummary[]) {
  return [...items].sort((left, right) => right.created_at - left.created_at);
}

function sortTraceBundles(items: QuorumIdeaTraceBundle[]) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.last_updated_at || "") || 0;
    const rightTime = Date.parse(right.last_updated_at || "") || 0;
    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }
    return right.steps.length - left.steps.length;
  });
}

export function emptyShellDiscoveryTracesSnapshot(): ShellDiscoveryTracesSnapshot {
  return {
    generatedAt: "",
    scoreboard: null,
    scoreboardError: null,
    scoreboardLoadState: "ready",
    traces: null,
    tracesError: null,
    tracesLoadState: "ready",
    ideaTrace: null,
    ideaTraceError: null,
    ideaTraceLoadState: "idle",
    errors: [],
    loadState: "ready",
  };
}

export function emptyShellDiscoveryReplaySnapshot(): ShellDiscoveryReplaySnapshot {
  return {
    generatedAt: "",
    sessions: [],
    sessionsError: null,
    sessionsLoadState: "ready",
    replay: null,
    replayError: null,
    replayLoadState: "idle",
    errors: [],
    loadState: "ready",
  };
}

export async function buildDiscoveryTracesSnapshot(
  ideaId: string | null,
  options?: {
    traceLimit?: number;
  }
): Promise<ShellDiscoveryTracesSnapshot> {
  const traceLimit = Math.max(1, Math.min(Math.trunc(options?.traceLimit ?? 8), 50));
  const normalizedIdeaId = (ideaId || "").trim();

  const [scoreboardResult, tracesResult, ideaTraceResult] = await Promise.allSettled([
    requestUpstreamJson<QuorumDiscoveryObservabilityScoreboard>(
      "quorum",
      "orchestrate/observability/scoreboards/discovery"
    ),
    requestUpstreamJson<QuorumDiscoveryTraceSnapshot>(
      "quorum",
      "orchestrate/observability/traces/discovery",
      buildUpstreamQuery({ limit: traceLimit })
    ),
    normalizedIdeaId
      ? requestUpstreamJson<QuorumIdeaTraceBundle>(
          "quorum",
          `orchestrate/observability/traces/discovery/${encodeURIComponent(normalizedIdeaId)}`
        )
      : Promise.resolve(null),
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
  const traces =
    tracesResult.status === "fulfilled"
      ? {
          ...tracesResult.value,
          traces: sortTraceBundles(tracesResult.value.traces),
        }
      : (errors.push(
          formatUpstreamErrorMessage("Discovery traces", tracesResult.reason)
        ),
        null);
  const ideaTrace =
    ideaTraceResult.status === "fulfilled"
      ? ideaTraceResult.value
      : normalizedIdeaId
        ? (errors.push(
            formatUpstreamErrorMessage("Discovery idea trace", ideaTraceResult.reason)
          ),
          null)
        : null;

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
    traces,
    tracesError:
      tracesResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage("Discovery traces", tracesResult.reason),
    tracesLoadState: tracesResult.status === "fulfilled" ? "ready" : "error",
    ideaTrace,
    ideaTraceError:
      !normalizedIdeaId
        ? null
        : ideaTraceResult.status === "fulfilled"
          ? null
          : formatUpstreamErrorMessage("Discovery idea trace", ideaTraceResult.reason),
    ideaTraceLoadState: !normalizedIdeaId
      ? "idle"
      : ideaTraceResult.status === "fulfilled"
        ? "ready"
        : "error",
    errors,
    loadState:
      scoreboardResult.status === "fulfilled" || tracesResult.status === "fulfilled"
        ? "ready"
        : "error",
  };
}

export async function buildDiscoveryReplaySnapshot(
  sessionId: string | null,
  options?: {
    sessionLimit?: number;
  }
): Promise<ShellDiscoveryReplaySnapshot> {
  const sessionLimit = Math.max(
    1,
    Math.min(Math.trunc(options?.sessionLimit ?? 12), 100)
  );
  const normalizedSessionId = (sessionId || "").trim();

  const [sessionsResult, replayResult] = await Promise.allSettled([
    requestUpstreamJson<QuorumSessionSummary[]>("quorum", "orchestrate/sessions"),
    normalizedSessionId
      ? requestUpstreamJson<QuorumDebateReplaySession>(
          "quorum",
          `orchestrate/observability/debate-replay/sessions/${encodeURIComponent(normalizedSessionId)}`
        )
      : Promise.resolve(null),
  ]);

  const errors: string[] = [];
  const sessions =
    sessionsResult.status === "fulfilled"
      ? sortSessions(sessionsResult.value).slice(0, sessionLimit)
      : (errors.push(
          formatUpstreamErrorMessage("Quorum sessions", sessionsResult.reason)
        ),
        []);
  const replay =
    replayResult.status === "fulfilled"
      ? replayResult.value
      : normalizedSessionId
        ? (errors.push(
            formatUpstreamErrorMessage("Debate replay", replayResult.reason)
          ),
          null)
        : null;

  return {
    generatedAt: new Date().toISOString(),
    sessions,
    sessionsError:
      sessionsResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage("Quorum sessions", sessionsResult.reason),
    sessionsLoadState: sessionsResult.status === "fulfilled" ? "ready" : "error",
    replay,
    replayError:
      !normalizedSessionId
        ? null
        : replayResult.status === "fulfilled"
          ? null
          : formatUpstreamErrorMessage("Debate replay", replayResult.reason),
    replayLoadState: !normalizedSessionId
      ? "idle"
      : replayResult.status === "fulfilled"
        ? "ready"
        : "error",
    errors,
    loadState:
      sessionsResult.status === "fulfilled" ||
      replayResult.status === "fulfilled"
        ? "ready"
        : "error",
  };
}
