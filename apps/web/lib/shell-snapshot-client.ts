import type { ShellDashboardSnapshot } from "@/lib/dashboard";
import type { ShellDiscoveryBoardSnapshot } from "@/lib/discovery-board";
import type {
  ShellDiscoveryArchiveSnapshot,
  ShellDiscoveryFinalsSnapshot,
} from "@/lib/discovery-board-history";
import type {
  ShellDiscoveryRankingSnapshot,
  ShellDiscoverySimulationSnapshot,
} from "@/lib/discovery-board-detail";
import type {
  ShellDiscoveryReplaySnapshot,
  ShellDiscoveryTracesSnapshot,
} from "@/lib/discovery-history";
import type {
  ShellDiscoveryIdeasSnapshot,
  ShellDiscoverySessionsSnapshot,
} from "@/lib/discovery";
import type { ShellDiscoveryAuthoringQueueSnapshot } from "@/lib/discovery-authoring-queue";
import type { ShellDiscoveryReviewSnapshot } from "@/lib/discovery-review";
import type { ShellExecutionAgentsSnapshot } from "@/lib/execution-agents";
import type {
  ShellExecutionHandoffSnapshot,
  ShellExecutionIntakeSnapshot,
  ShellExecutionWorkspaceSnapshot,
} from "@/lib/execution";
import type { ShellExecutionReviewSnapshot } from "@/lib/execution-review";
import type { ShellInboxSnapshot } from "@/lib/inbox";
import type { ShellPortfolioSnapshot } from "@/lib/portfolio";
import type { ShellReviewCenterSnapshot } from "@/lib/review-center";

function emptyDiscoveryInboxFeed() {
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

async function parseSnapshotError(response: Response) {
  const fallback = `Snapshot request failed: ${response.status}`;
  const raw = (await response.text()).trim();

  if (!raw) {
    return fallback;
  }

  try {
    const payload = JSON.parse(raw) as { detail?: string; message?: string };
    if (payload.detail) {
      return payload.detail;
    }
    if (payload.message) {
      return payload.message;
    }
  } catch {
    // Fall through to raw response body.
  }

  return raw;
}

async function requestShellSnapshotJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await parseSnapshotError(response));
  }

  return (await response.json()) as T;
}

function appendShellSnapshotParam(path: string, key: string, value?: string | null) {
  const url = new URL(path, "http://founderos-shell.local");
  if (value) {
    url.searchParams.set(key, value);
  }
  return `${url.pathname}${url.search}`;
}

export function fetchShellDashboardSnapshot(
  input: RequestInfo | URL = "/api/shell/dashboard",
  init?: RequestInit
): Promise<ShellDashboardSnapshot> {
  return requestShellSnapshotJson<ShellDashboardSnapshot>(input, init).catch((error) => ({
    generatedAt: new Date().toISOString(),
    health: null,
    sessions: [],
    ideas: [],
    discoveryFeed: emptyDiscoveryInboxFeed(),
    projects: [],
    intakeSessions: [],
    issues: [],
    approvals: [],
    runtimes: [],
    chains: [],
    reviewCenter: {
      generatedAt: "",
      discovery: {
        generatedAt: "",
        records: [],
        stats: {
          totalCount: 0,
          authoringCount: 0,
          traceReviewCount: 0,
          handoffReadyCount: 0,
          executionFollowthroughCount: 0,
          linkedCount: 0,
          replayLinkedCount: 0,
        },
        error: null,
        loadState: "error" as const,
      },
      execution: {
        generatedAt: "",
        records: [],
        stats: {
          totalCount: 0,
          issueCount: 0,
          approvalCount: 0,
          runtimeCount: 0,
          intakeOriginCount: 0,
          chainLinkedCount: 0,
          orphanCount: 0,
          criticalIssueCount: 0,
        },
        error: null,
        loadState: "error" as const,
      },
      stats: {
        totalCount: 0,
        discoveryCount: 0,
        executionCount: 0,
        authoringCount: 0,
        traceReviewCount: 0,
        handoffReadyCount: 0,
        executionFollowthroughCount: 0,
        issueCount: 0,
        approvalCount: 0,
        runtimeCount: 0,
        decisionCount: 0,
        criticalIssueCount: 0,
        linkedDiscoveryCount: 0,
        linkedExecutionCount: 0,
        intakeOriginCount: 0,
      },
      errors: [],
      loadState: "error" as const,
    },
    errors: [
      error instanceof Error ? `Dashboard snapshot: ${error.message}` : "Dashboard snapshot: request failed.",
    ],
    loadState: "error" as const,
  }));
}

export function fetchShellReviewCenterSnapshot(
  input: RequestInfo | URL = "/api/shell/review",
  init?: RequestInit
): Promise<ShellReviewCenterSnapshot> {
  return requestShellSnapshotJson<ShellReviewCenterSnapshot>(input, init).catch(
    (error) => ({
      generatedAt: new Date().toISOString(),
      discovery: {
        generatedAt: "",
        records: [],
        stats: {
          totalCount: 0,
          authoringCount: 0,
          traceReviewCount: 0,
          handoffReadyCount: 0,
          executionFollowthroughCount: 0,
          linkedCount: 0,
          replayLinkedCount: 0,
        },
        error: null,
        loadState: "error" as const,
      },
      execution: {
        generatedAt: "",
        records: [],
        stats: {
          totalCount: 0,
          issueCount: 0,
          approvalCount: 0,
          runtimeCount: 0,
          intakeOriginCount: 0,
          chainLinkedCount: 0,
          orphanCount: 0,
          criticalIssueCount: 0,
        },
        error: null,
        loadState: "error" as const,
      },
      stats: {
        totalCount: 0,
        discoveryCount: 0,
        executionCount: 0,
        authoringCount: 0,
        traceReviewCount: 0,
        handoffReadyCount: 0,
        executionFollowthroughCount: 0,
        issueCount: 0,
        approvalCount: 0,
        runtimeCount: 0,
        decisionCount: 0,
        criticalIssueCount: 0,
        linkedDiscoveryCount: 0,
        linkedExecutionCount: 0,
        intakeOriginCount: 0,
      },
      errors: [
        error instanceof Error
          ? `Review center snapshot: ${error.message}`
          : "Review center snapshot: request failed.",
      ],
      loadState: "error" as const,
    })
  );
}

export function fetchShellInboxSnapshot(
  input: RequestInfo | URL = "/api/shell/inbox",
  init?: RequestInit
): Promise<ShellInboxSnapshot> {
  return requestShellSnapshotJson<ShellInboxSnapshot>(input, init).catch((error) => ({
    generatedAt: new Date().toISOString(),
    discoveryFeed: emptyDiscoveryInboxFeed(),
    projects: [],
    intakeSessions: [],
    approvals: [],
    issues: [],
    runtimes: [],
    chains: [],
    errors: [
      error instanceof Error ? `Inbox snapshot: ${error.message}` : "Inbox snapshot: request failed.",
    ],
    loadState: "error" as const,
  }));
}

export function fetchShellPortfolioSnapshot(
  input: RequestInfo | URL = "/api/shell/portfolio",
  init?: RequestInit
): Promise<ShellPortfolioSnapshot> {
  return requestShellSnapshotJson<ShellPortfolioSnapshot>(input, init).catch((error) => ({
    generatedAt: new Date().toISOString(),
    records: [],
    reviewCenter: {
      generatedAt: "",
      discovery: {
        generatedAt: "",
        records: [],
        stats: {
          totalCount: 0,
          authoringCount: 0,
          traceReviewCount: 0,
          handoffReadyCount: 0,
          executionFollowthroughCount: 0,
          linkedCount: 0,
          replayLinkedCount: 0,
        },
        error: null,
        loadState: "error" as const,
      },
      execution: {
        generatedAt: "",
        records: [],
        stats: {
          totalCount: 0,
          issueCount: 0,
          approvalCount: 0,
          runtimeCount: 0,
          intakeOriginCount: 0,
          chainLinkedCount: 0,
          orphanCount: 0,
          criticalIssueCount: 0,
        },
        error: null,
        loadState: "error" as const,
      },
      stats: {
        totalCount: 0,
        discoveryCount: 0,
        executionCount: 0,
        authoringCount: 0,
        traceReviewCount: 0,
        handoffReadyCount: 0,
        executionFollowthroughCount: 0,
        issueCount: 0,
        approvalCount: 0,
        runtimeCount: 0,
        decisionCount: 0,
        criticalIssueCount: 0,
        linkedDiscoveryCount: 0,
        linkedExecutionCount: 0,
        intakeOriginCount: 0,
      },
      errors: [],
      loadState: "error" as const,
    },
    error:
      error instanceof Error
        ? `Portfolio snapshot: ${error.message}`
        : "Portfolio snapshot: request failed.",
    loadState: "error" as const,
  }));
}

export function fetchShellDiscoverySessionsSnapshot(
  sessionId?: string | null,
  init?: RequestInit
): Promise<ShellDiscoverySessionsSnapshot> {
  return requestShellSnapshotJson<ShellDiscoverySessionsSnapshot>(
    appendShellSnapshotParam("/api/shell/discovery/sessions", "sessionId", sessionId),
    init
  ).catch((error) => ({
    generatedAt: new Date().toISOString(),
    sessions: [],
    sessionsError:
      error instanceof Error
        ? `Quorum sessions: ${error.message}`
        : "Quorum sessions: request failed.",
    sessionsLoadState: "error" as const,
    linkedIdeas: [],
      chainStats: {
        activeExecutionCount: 0,
        authoringGapCount: 0,
        authoringReadyCount: 0,
        brokenIntakeCount: 0,
        chainsWithAttentionCount: 0,
        intakeLinkedCount: 0,
        linkedCount: 0,
        orphanCount: 0,
      validatedCount: 0,
    },
    chainsError:
      error instanceof Error
        ? `Discovery chain graph: ${error.message}`
        : "Discovery chain graph: request failed.",
    chainsLoadState: "error" as const,
    launchPresets: [],
    launchPresetsError:
      error instanceof Error
        ? `Quorum launch presets: ${error.message}`
        : "Quorum launch presets: request failed.",
    launchPresetsLoadState: "error" as const,
    session: null,
    events: [],
    sessionError:
      sessionId && error instanceof Error
        ? `Quorum session: ${error.message}`
        : sessionId
          ? "Quorum session: request failed."
          : null,
    sessionLoadState: sessionId ? ("error" as const) : ("idle" as const),
  }));
}

export function fetchShellDiscoveryBoardSnapshot(
  input: RequestInfo | URL = "/api/shell/discovery/board",
  init?: RequestInit
): Promise<ShellDiscoveryBoardSnapshot> {
  return requestShellSnapshotJson<ShellDiscoveryBoardSnapshot>(input, init).catch(
    (error) => ({
      generatedAt: new Date().toISOString(),
      scoreboard: null,
      scoreboardError:
        error instanceof Error
          ? `Discovery observability scoreboard: ${error.message}`
          : "Discovery observability scoreboard: request failed.",
      scoreboardLoadState: "error" as const,
      leaderboard: null,
      nextPair: null,
      rankingError:
        error instanceof Error
          ? `Ranking board: ${error.message}`
          : "Ranking board: request failed.",
      rankingLoadState: "error" as const,
      swipeQueue: null,
      swipeQueueError:
        error instanceof Error
          ? `Swipe queue: ${error.message}`
          : "Swipe queue: request failed.",
      swipeQueueLoadState: "error" as const,
      simulationIdeas: [],
      simulationIdeasError:
        error instanceof Error
          ? `Discovery ideas: ${error.message}`
          : "Discovery ideas: request failed.",
      simulationIdeasLoadState: "error" as const,
      errors: [
        error instanceof Error
          ? `Discovery board snapshot: ${error.message}`
          : "Discovery board snapshot: request failed.",
      ],
      loadState: "error" as const,
    })
  );
}

export function fetchShellDiscoveryAuthoringQueueSnapshot(
  input: RequestInfo | URL = "/api/shell/discovery/authoring",
  init?: RequestInit
): Promise<ShellDiscoveryAuthoringQueueSnapshot> {
  return requestShellSnapshotJson<ShellDiscoveryAuthoringQueueSnapshot>(
    input,
    init
  ).catch((error) => ({
    generatedAt: new Date().toISOString(),
    records: [],
    stats: {
      totalCount: 0,
      readyCount: 0,
      needsWorkCount: 0,
      linkedCount: 0,
      attentionLinkedCount: 0,
      evidenceGapCount: 0,
      validationGapCount: 0,
      decisionGapCount: 0,
      timelineGapCount: 0,
    },
    error:
      error instanceof Error
        ? `Discovery authoring queue: ${error.message}`
        : "Discovery authoring queue: request failed.",
    loadState: "error" as const,
  }));
}

export function fetchShellDiscoveryReviewSnapshot(
  input: RequestInfo | URL = "/api/shell/discovery/review",
  init?: RequestInit
): Promise<ShellDiscoveryReviewSnapshot> {
  return requestShellSnapshotJson<ShellDiscoveryReviewSnapshot>(
    input,
    init
  ).catch((error) => ({
    generatedAt: new Date().toISOString(),
    records: [],
    stats: {
      totalCount: 0,
      authoringCount: 0,
      traceReviewCount: 0,
      handoffReadyCount: 0,
      executionFollowthroughCount: 0,
      linkedCount: 0,
      replayLinkedCount: 0,
    },
    error:
      error instanceof Error
        ? `Discovery review: ${error.message}`
        : "Discovery review: request failed.",
    loadState: "error" as const,
  }));
}

export function fetchShellDiscoveryRankingSnapshot(
  input: RequestInfo | URL = "/api/shell/discovery/board/ranking",
  init?: RequestInit
): Promise<ShellDiscoveryRankingSnapshot> {
  return requestShellSnapshotJson<ShellDiscoveryRankingSnapshot>(input, init).catch(
    (error) => ({
      generatedAt: new Date().toISOString(),
      leaderboard: null,
      leaderboardError:
        error instanceof Error
          ? `Ranking leaderboard: ${error.message}`
          : "Ranking leaderboard: request failed.",
      leaderboardLoadState: "error" as const,
      nextPair: null,
      nextPairError:
        error instanceof Error
          ? `Ranking next pair: ${error.message}`
          : "Ranking next pair: request failed.",
      nextPairLoadState: "error" as const,
      archive: null,
      archiveError:
        error instanceof Error
          ? `Ranking archive: ${error.message}`
          : "Ranking archive: request failed.",
      archiveLoadState: "error" as const,
      errors: [
        error instanceof Error
          ? `Ranking snapshot: ${error.message}`
          : "Ranking snapshot: request failed.",
      ],
      loadState: "error" as const,
    })
  );
}

export function fetchShellDiscoveryArchiveSnapshot(
  input: RequestInfo | URL = "/api/shell/discovery/board/archive",
  init?: RequestInit
): Promise<ShellDiscoveryArchiveSnapshot> {
  return requestShellSnapshotJson<ShellDiscoveryArchiveSnapshot>(input, init).catch(
    (error) => ({
      generatedAt: new Date().toISOString(),
      archive: null,
      archiveError:
        error instanceof Error
          ? `Ranking archive: ${error.message}`
          : "Ranking archive: request failed.",
      archiveLoadState: "error" as const,
      leaderboard: null,
      leaderboardError:
        error instanceof Error
          ? `Ranking leaderboard: ${error.message}`
          : "Ranking leaderboard: request failed.",
      leaderboardLoadState: "error" as const,
      ideas: [],
      ideasError:
        error instanceof Error
          ? `Discovery ideas: ${error.message}`
          : "Discovery ideas: request failed.",
      ideasLoadState: "error" as const,
      errors: [
        error instanceof Error
          ? `Discovery archive snapshot: ${error.message}`
          : "Discovery archive snapshot: request failed.",
      ],
      loadState: "error" as const,
    })
  );
}

export function fetchShellDiscoveryFinalsSnapshot(
  input: RequestInfo | URL = "/api/shell/discovery/board/finals",
  init?: RequestInit
): Promise<ShellDiscoveryFinalsSnapshot> {
  return requestShellSnapshotJson<ShellDiscoveryFinalsSnapshot>(input, init).catch(
    (error) => ({
      generatedAt: new Date().toISOString(),
      archive: null,
      archiveError:
        error instanceof Error
          ? `Ranking archive: ${error.message}`
          : "Ranking archive: request failed.",
      archiveLoadState: "error" as const,
      leaderboard: null,
      leaderboardError:
        error instanceof Error
          ? `Ranking leaderboard: ${error.message}`
          : "Ranking leaderboard: request failed.",
      leaderboardLoadState: "error" as const,
      ideas: [],
      ideasError:
        error instanceof Error
          ? `Discovery ideas: ${error.message}`
          : "Discovery ideas: request failed.",
      ideasLoadState: "error" as const,
      errors: [
        error instanceof Error
          ? `Discovery finals snapshot: ${error.message}`
          : "Discovery finals snapshot: request failed.",
      ],
      loadState: "error" as const,
    })
  );
}

export function fetchShellDiscoverySimulationSnapshot(
  ideaId?: string | null,
  init?: RequestInit
): Promise<ShellDiscoverySimulationSnapshot> {
  return requestShellSnapshotJson<ShellDiscoverySimulationSnapshot>(
    appendShellSnapshotParam(
      "/api/shell/discovery/board/simulations",
      "ideaId",
      ideaId
    ),
    init
  ).catch((error) => ({
    generatedAt: new Date().toISOString(),
    ideas: [],
    ideasError:
      error instanceof Error
        ? `Discovery ideas: ${error.message}`
        : "Discovery ideas: request failed.",
    ideasLoadState: "error" as const,
    selectedIdea: null,
    selectedIdeaError:
      ideaId && error instanceof Error
        ? `Discovery idea detail: ${error.message}`
        : ideaId
          ? "Discovery idea detail: request failed."
          : null,
    selectedIdeaLoadState: ideaId ? ("error" as const) : ("idle" as const),
    personaReport: null,
    personaReportError:
      ideaId && error instanceof Error
        ? `Persona simulation report: ${error.message}`
        : ideaId
          ? "Persona simulation report: request failed."
          : null,
    personaReportLoadState: ideaId ? ("error" as const) : ("idle" as const),
    marketReport: null,
    marketReportError:
      ideaId && error instanceof Error
        ? `Market simulation report: ${error.message}`
        : ideaId
          ? "Market simulation report: request failed."
          : null,
    marketReportLoadState: ideaId ? ("error" as const) : ("idle" as const),
    errors: [
      error instanceof Error
        ? `Simulation snapshot: ${error.message}`
        : "Simulation snapshot: request failed.",
    ],
    loadState: "error" as const,
  }));
}

export function fetchShellDiscoveryTracesSnapshot(
  ideaId?: string | null,
  init?: RequestInit
): Promise<ShellDiscoveryTracesSnapshot> {
  return requestShellSnapshotJson<ShellDiscoveryTracesSnapshot>(
    appendShellSnapshotParam("/api/shell/discovery/traces", "ideaId", ideaId),
    init
  ).catch((error) => ({
    generatedAt: new Date().toISOString(),
    scoreboard: null,
    scoreboardError:
      error instanceof Error
        ? `Discovery observability scoreboard: ${error.message}`
        : "Discovery observability scoreboard: request failed.",
    scoreboardLoadState: "error" as const,
    traces: null,
    tracesError:
      error instanceof Error
        ? `Discovery traces: ${error.message}`
        : "Discovery traces: request failed.",
    tracesLoadState: "error" as const,
    ideaTrace: null,
    ideaTraceError:
      ideaId && error instanceof Error
        ? `Discovery idea trace: ${error.message}`
        : ideaId
          ? "Discovery idea trace: request failed."
          : null,
    ideaTraceLoadState: ideaId ? ("error" as const) : ("idle" as const),
    errors: [
      error instanceof Error
        ? `Discovery traces snapshot: ${error.message}`
        : "Discovery traces snapshot: request failed.",
    ],
    loadState: "error" as const,
  }));
}

export function fetchShellDiscoveryReplaySnapshot(
  sessionId?: string | null,
  init?: RequestInit
): Promise<ShellDiscoveryReplaySnapshot> {
  return requestShellSnapshotJson<ShellDiscoveryReplaySnapshot>(
    appendShellSnapshotParam(
      "/api/shell/discovery/replays",
      "sessionId",
      sessionId
    ),
    init
  ).catch((error) => ({
    generatedAt: new Date().toISOString(),
    sessions: [],
    sessionsError:
      error instanceof Error
        ? `Quorum sessions: ${error.message}`
        : "Quorum sessions: request failed.",
    sessionsLoadState: "error" as const,
    replay: null,
    replayError:
      sessionId && error instanceof Error
        ? `Debate replay: ${error.message}`
        : sessionId
          ? "Debate replay: request failed."
          : null,
    replayLoadState: sessionId ? ("error" as const) : ("idle" as const),
    errors: [
      error instanceof Error
        ? `Discovery replay snapshot: ${error.message}`
        : "Discovery replay snapshot: request failed.",
    ],
    loadState: "error" as const,
  }));
}

export function fetchShellDiscoveryIdeasSnapshot(
  ideaId?: string | null,
  init?: RequestInit
): Promise<ShellDiscoveryIdeasSnapshot> {
  return requestShellSnapshotJson<ShellDiscoveryIdeasSnapshot>(
    appendShellSnapshotParam("/api/shell/discovery/ideas", "ideaId", ideaId),
    init
  ).catch((error) => ({
    generatedAt: new Date().toISOString(),
    ideas: [],
    ideasError:
      error instanceof Error
        ? `Discovery ideas: ${error.message}`
        : "Discovery ideas: request failed.",
    ideasLoadState: "error" as const,
    chains: [],
    chainsError:
      error instanceof Error
        ? `Discovery chain graph: ${error.message}`
        : "Discovery chain graph: request failed.",
    chainsLoadState: "error" as const,
    dossier: null,
    dossierError:
      ideaId && error instanceof Error
        ? `Discovery dossier: ${error.message}`
        : ideaId
          ? "Discovery dossier: request failed."
          : null,
    dossierLoadState: ideaId ? ("error" as const) : ("idle" as const),
  }));
}

export function fetchShellExecutionWorkspaceSnapshot(
  projectId?: string | null,
  init?: RequestInit
): Promise<ShellExecutionWorkspaceSnapshot> {
  return requestShellSnapshotJson<ShellExecutionWorkspaceSnapshot>(
    appendShellSnapshotParam("/api/shell/execution/workspace", "projectId", projectId),
    init
  ).catch((error) => ({
    generatedAt: new Date().toISOString(),
    projects: [],
    projectsError:
      error instanceof Error
        ? `Autopilot projects: ${error.message}`
        : "Autopilot projects: request failed.",
    projectsLoadState: "error" as const,
    launchPresets: [],
    launchPresetsError:
      error instanceof Error
        ? `Autopilot launch presets: ${error.message}`
        : "Autopilot launch presets: request failed.",
    launchPresetsLoadState: "error" as const,
    project: null,
    projectError:
      projectId && error instanceof Error
        ? `Autopilot project: ${error.message}`
        : projectId
          ? "Autopilot project: request failed."
          : null,
    projectLoadState: projectId ? ("error" as const) : ("idle" as const),
  }));
}

export function fetchShellExecutionReviewSnapshot(
  input: RequestInfo | URL = "/api/shell/execution/review",
  init?: RequestInit
): Promise<ShellExecutionReviewSnapshot> {
  return requestShellSnapshotJson<ShellExecutionReviewSnapshot>(input, init).catch(
    (error) => ({
      generatedAt: new Date().toISOString(),
      records: [],
      stats: {
        totalCount: 0,
        issueCount: 0,
        approvalCount: 0,
        runtimeCount: 0,
        intakeOriginCount: 0,
        chainLinkedCount: 0,
        orphanCount: 0,
        criticalIssueCount: 0,
      },
      error:
        error instanceof Error
          ? `Execution review: ${error.message}`
          : "Execution review: request failed.",
      loadState: "error" as const,
    })
  );
}

export function fetchShellExecutionIntakeSnapshot(
  sessionId?: string | null,
  init?: RequestInit
): Promise<ShellExecutionIntakeSnapshot> {
  return requestShellSnapshotJson<ShellExecutionIntakeSnapshot>(
    appendShellSnapshotParam("/api/shell/execution/intake", "sessionId", sessionId),
    init
  ).catch((error) => ({
    generatedAt: new Date().toISOString(),
    launchPresets: [],
    launchPresetsError:
      error instanceof Error
        ? `Autopilot launch presets: ${error.message}`
        : "Autopilot launch presets: request failed.",
    launchPresetsLoadState: "error" as const,
    intakeSessions: [],
    intakeSessionsError:
      error instanceof Error
        ? `Autopilot intake sessions: ${error.message}`
        : "Autopilot intake sessions: request failed.",
    intakeSessionsLoadState: "error" as const,
    intakeSession: null,
    intakeSessionError:
      sessionId && error instanceof Error
        ? `Autopilot intake session: ${error.message}`
        : sessionId
          ? "Autopilot intake session: request failed."
          : null,
    intakeSessionLoadState: sessionId ? ("error" as const) : ("idle" as const),
  }));
}

export function fetchShellExecutionHandoffSnapshot(
  handoffId: string,
  init?: RequestInit
): Promise<ShellExecutionHandoffSnapshot> {
  return requestShellSnapshotJson<ShellExecutionHandoffSnapshot>(
    `/api/shell/execution/handoffs/${encodeURIComponent(handoffId)}`,
    init
  ).catch((error) => ({
    generatedAt: new Date().toISOString(),
    launchPresets: [],
    launchPresetsError:
      error instanceof Error
        ? `Autopilot launch presets: ${error.message}`
        : "Autopilot launch presets: request failed.",
    launchPresetsLoadState: "error" as const,
    intakeSessions: [],
    intakeSessionsError: null,
    intakeSessionsLoadState: "idle" as const,
    intakeSession: null,
    intakeSessionError: null,
    intakeSessionLoadState: "idle" as const,
    handoff: null,
    handoffError:
      error instanceof Error
        ? `Execution handoff: ${error.message}`
        : "Execution handoff: request failed.",
    handoffLoadState: "error" as const,
  }));
}

export function fetchShellExecutionAgentsSnapshot(
  input: RequestInfo | URL = "/api/shell/execution/agents",
  init?: RequestInit
): Promise<ShellExecutionAgentsSnapshot> {
  return requestShellSnapshotJson<ShellExecutionAgentsSnapshot>(input, init).catch(
    (error) => ({
      generatedAt: new Date().toISOString(),
      projects: [],
      projectsError:
        error instanceof Error
          ? `Autopilot projects: ${error.message}`
          : "Autopilot projects: request failed.",
      projectsLoadState: "error" as const,
    })
  );
}
