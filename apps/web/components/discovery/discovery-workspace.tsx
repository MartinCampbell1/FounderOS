"use client";

import {
  getQuorumSessionEventsUrl,
  type QuorumAutopilotLaunchPreset,
  type QuorumMessage,
  type QuorumSession,
  type QuorumSessionEvent,
  type QuorumSessionSummary,
  type ShellPreferences,
} from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import { cn } from "@founderos/ui/lib/utils";
import {
  GitBranch,
  PauseCircle,
  PlayCircle,
  Rocket,
  Send,
  Square,
  Upload,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ShellRecordSection } from "@/components/shell/shell-record-primitives";
import {
  ShellActionStateLabel,
  ShellActionLink,
  ShellComposerTextarea,
  ShellEmptyState,
  ShellInlineStatus,
  ShellPillButton,
  ShellRefreshButton,
  ShellSectionCard,
  ShellSelectField,
  ShellStatusBanner,
} from "@/components/shell/shell-screen-primitives";
import { SkeletonList } from "@/components/shell/shell-skeleton";
import {
  shellChainRouteScope,
  type LinkedShellChainRecord,
  type ShellChainGraphStats,
} from "@/lib/chain-graph";
import {
  runDiscoverySessionAction,
  type DiscoveryMutationEffect,
} from "@/lib/discovery-mutations";
import {
  resolveDiscoveryLaunchPresetId,
  resolveDiscoveryMutationBrief,
  resolveDiscoverySessionActionState,
} from "@/lib/discovery-ui-state";
import {
  buildRememberedDiscoveryReviewScopeHref,
  resolveReviewMemoryBucket,
} from "@/lib/review-memory";
import {
  resolveDiscoverySessionAutoOpenHref,
} from "@/lib/shell-route-intents";
import { fetchShellDiscoverySessionsSnapshot } from "@/lib/shell-snapshot-client";
import { useShellMutationRunner } from "@/lib/use-shell-mutation-runner";
import {
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";
import { useShellManualRefresh } from "@/lib/use-shell-manual-refresh";
import { useShellRouteMutationRunner } from "@/lib/use-shell-route-mutation-runner";
import { useShellSnapshotRefreshNonce } from "@/lib/use-shell-snapshot-refresh-nonce";
import {
  buildDiscoveryAuthoringScopeHref,
  buildDiscoveryBoardArchiveScopeHref,
  buildDiscoveryBoardFinalsScopeHref,
  buildDiscoveryBoardScopeHref,
  buildDiscoveryIdeaScopeHref,
  buildDiscoveryReplayScopeHref,
  buildDiscoverySessionScopeHref,
  buildDiscoveryTracesScopeHref,
  buildInboxScopeHref,
  buildSettingsScopeHref,
  buildPortfolioScopeHref,
  hasShellRouteScope,
  type ShellRouteScope,
} from "@/lib/route-scope";
import type { ShellDiscoverySessionsSnapshot } from "@/lib/discovery";

type SessionLoadState = "idle" | "loading" | "ready" | "error";
type SessionStreamState = "idle" | "connecting" | "live" | "reconnecting" | "error";
type DiscoveryRouteScope = ShellRouteScope;

function sortEvents(items: QuorumSessionEvent[]) {
  return [...items].sort((left, right) => left.id - right.id);
}

const EMPTY_DISCOVERY_SESSIONS_SNAPSHOT: ShellDiscoverySessionsSnapshot = {
  generatedAt: "",
  sessions: [],
  sessionsError: null,
  sessionsLoadState: "ready",
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
  chainsError: null,
  chainsLoadState: "ready",
  launchPresets: [],
  launchPresetsError: null,
  launchPresetsLoadState: "ready",
  session: null,
  events: [],
  sessionError: null,
  sessionLoadState: "idle",
};

function mergeEvents(
  existing: QuorumSessionEvent[],
  incoming: QuorumSessionEvent[]
) {
  const byId = new Map<number, QuorumSessionEvent>();
  for (const item of existing) {
    byId.set(item.id, item);
  }
  for (const item of incoming) {
    byId.set(item.id, item);
  }
  return sortEvents([...byId.values()]);
}

function maxEventId(items: QuorumSessionEvent[]) {
  return items.reduce((maxValue, item) => Math.max(maxValue, item.id), 0);
}

function formatDateTime(timestamp: number | null | undefined) {
  if (!timestamp) return "";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp * 1000));
}

function formatRelativeTime(timestamp: number | null | undefined) {
  if (!timestamp) return "";
  const diffSeconds = Math.max(0, Math.floor(Date.now() / 1000 - timestamp));
  if (diffSeconds < 60) return "just now";
  if (diffSeconds < 3600) return `${Math.max(1, Math.floor(diffSeconds / 60))}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  return `${Math.floor(diffSeconds / 86400)}d ago`;
}

function formatElapsed(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "n/a";
  if (value < 60) return `${Math.round(value)}s`;
  if (value < 3600) return `${Math.floor(value / 60)}m`;
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function statusTone(status: string) {
  if (status === "running") return "success" as const;
  if (status === "completed") return "info" as const;
  if (status === "paused" || status === "pause_requested") return "warning" as const;
  if (status === "failed" || status === "cancelled") return "danger" as const;
  return "neutral" as const;
}

function streamTone(state: SessionStreamState) {
  if (state === "live") return "success" as const;
  if (state === "connecting" || state === "reconnecting") return "warning" as const;
  if (state === "error") return "danger" as const;
  return "neutral" as const;
}

function streamLabel(state: SessionStreamState) {
  if (state === "live") return "live SSE";
  if (state === "connecting") return "connecting";
  if (state === "reconnecting") return "reconnecting";
  if (state === "error") return "stream retry";
  return "stream idle";
}

function readableAgentName(message: QuorumMessage) {
  const normalized = (message.agent_id || "").replace(/[_-]/g, " ").trim();
  if (!normalized) return "agent";
  return normalized;
}

function sanitizeMessage(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function clearDiscoveryScopeHref(activeSessionId: string | null) {
  return activeSessionId
    ? `/discovery/sessions/${encodeURIComponent(activeSessionId)}`
    : "/discovery";
}

function useQuorumDiscoverySnapshot(
  sessionId: string | null,
  refreshNonce: number,
  initialSnapshot?: ShellDiscoverySessionsSnapshot | null,
  initialPreferences?: ShellPreferences
) {
  const { preferences } = useShellPreferences(initialPreferences);
  const pollInterval = getShellPollInterval(
    sessionId ? "discovery_session_detail" : "discovery_sessions",
    preferences.refreshProfile
  );
  const loadSnapshot = useCallback(
    () => fetchShellDiscoverySessionsSnapshot(sessionId),
    [sessionId]
  );
  const selectLoadState = useCallback(
    (snapshot: ShellDiscoverySessionsSnapshot) =>
      sessionId
        ? snapshot.sessionLoadState === "ready"
          ? "ready"
          : snapshot.sessionLoadState === "idle"
            ? "ready"
            : "error"
        : snapshot.sessionsLoadState,
    [sessionId]
  );
  return useShellPolledSnapshot({
    emptySnapshot: EMPTY_DISCOVERY_SESSIONS_SNAPSHOT,
    initialSnapshot,
    refreshNonce,
    pollIntervalMs: pollInterval,
    loadSnapshot,
    selectLoadState,
  });

}

function applySessionEventOverlay(
  session: QuorumSession | null,
  events: QuorumSessionEvent[]
) {
  if (!session) {
    return null;
  }

  let nextStatus = session.status;
  let nextPendingInstructions = session.pending_instructions;
  let nextElapsed = session.elapsed_sec;
  let nextMode = session.mode;
  let nextActiveNode = session.active_node;

  for (const event of events) {
    if (typeof event.status === "string" && event.status.trim()) {
      nextStatus = event.status;
    }
    if (typeof event.pending_instructions === "number") {
      nextPendingInstructions = event.pending_instructions;
    }
    if (typeof event.elapsed_sec === "number" && Number.isFinite(event.elapsed_sec)) {
      nextElapsed = event.elapsed_sec;
    }
    if (typeof event.mode === "string" && event.mode.trim()) {
      nextMode = event.mode;
    }
    if (typeof event.next_node === "string" || event.next_node === null) {
      nextActiveNode = event.next_node;
    }
  }

  if (
    nextStatus === session.status &&
    nextPendingInstructions === session.pending_instructions &&
    nextElapsed === session.elapsed_sec &&
    nextMode === session.mode &&
    nextActiveNode === session.active_node
  ) {
    return session;
  }

  return {
    ...session,
    status: nextStatus,
    pending_instructions: nextPendingInstructions,
    elapsed_sec: nextElapsed,
    mode: nextMode,
    active_node: nextActiveNode,
  };
}

function useQuorumLiveSessionState(
  sessionId: string | null,
  snapshot: ShellDiscoverySessionsSnapshot
) {
  const baseSession = snapshot.session?.id === sessionId ? snapshot.session : null;
  const baseEvents = useMemo(
    () =>
      baseSession ? sortEvents(snapshot.events ?? baseSession.events ?? []) : [],
    [baseSession, snapshot.events]
  );
  const [liveState, setLiveState] = useState<{
    sessionId: string | null;
    events: QuorumSessionEvent[];
    streamState: SessionStreamState;
  }>({
    sessionId,
    events: [],
    streamState: sessionId ? "connecting" : "idle",
  });
  const baseEventId = useMemo(() => maxEventId(baseEvents), [baseEvents]);
  const baseEventsRef = useRef(baseEvents);
  const overlayEvents = useMemo(
    () =>
      liveState.sessionId === sessionId
        ? liveState.events.filter((event) => event.id > baseEventId)
        : [],
    [baseEventId, liveState.events, liveState.sessionId, sessionId]
  );
  const mergedEvents = useMemo(
    () => (baseSession ? mergeEvents(baseEvents, overlayEvents) : []),
    [baseEvents, baseSession, overlayEvents]
  );
  const lastEventIdRef = useRef(baseEventId);
  const streamState =
    liveState.sessionId === sessionId
      ? liveState.streamState
      : sessionId
        ? "connecting"
        : "idle";

  useEffect(() => {
    baseEventsRef.current = baseEvents;
  }, [baseEvents]);

  useEffect(() => {
    lastEventIdRef.current = maxEventId(mergedEvents);
  }, [mergedEvents]);

  useEffect(() => {
    if (!sessionId) {
      lastEventIdRef.current = 0;
      return;
    }

    let active = true;
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryAttempt = 0;

    const updateLiveState = (
      nextState: SessionStreamState,
      transformEvents?: (events: QuorumSessionEvent[]) => QuorumSessionEvent[]
    ) => {
      setLiveState((current) => {
        const currentEvents =
          current.sessionId === sessionId ? current.events : [];
        const nextEvents = transformEvents
          ? transformEvents(currentEvents)
          : currentEvents;

        return {
          sessionId,
          events: nextEvents,
          streamState: nextState,
        };
      });
    };

    const connect = () => {
      if (!active) {
        return;
      }

      source = new EventSource(
        getQuorumSessionEventsUrl(sessionId, lastEventIdRef.current)
      );

      source.onopen = () => {
        retryAttempt = 0;
        if (active) {
          updateLiveState("live");
        }
      };

      source.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data) as QuorumSessionEvent;
          updateLiveState("live", (currentEvents) => {
            const merged = mergeEvents(currentEvents, [event]);
            lastEventIdRef.current = maxEventId(
              mergeEvents(baseEventsRef.current, merged)
            );
            return merged;
          });
        } catch {
          // Ignore malformed SSE payloads and keep the stream alive.
        }
      };

      source.onerror = () => {
        source?.close();
        source = null;
        if (!active) {
          return;
        }
        updateLiveState("error");
        const nextDelay = Math.min(10000, 1000 * Math.max(1, retryAttempt + 1));
        retryAttempt += 1;
        retryTimer = setTimeout(() => {
          updateLiveState("reconnecting");
          connect();
        }, nextDelay);
      };
    };

    connect();

    return () => {
      active = false;
      source?.close();
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, [sessionId]);

  const visibleSession = useMemo(
    () => applySessionEventOverlay(baseSession, mergedEvents),
    [baseSession, mergedEvents]
  );

  return {
    session: visibleSession,
    events: visibleSession ? mergedEvents : [],
    streamState: visibleSession ? streamState : ("idle" as const),
  };
}

function DiscoverySessionsList({
  sessions,
  linkedIdeas,
  chainStats,
  activeSessionId,
  loadState,
  error,
  chainsError,
  reviewHref,
  routeScope,
}: {
  sessions: QuorumSessionSummary[];
  linkedIdeas: LinkedShellChainRecord[];
  chainStats: ShellChainGraphStats;
  activeSessionId: string | null;
  loadState: SessionLoadState;
  error: string | null;
  chainsError: string | null;
  reviewHref: string;
  routeScope: DiscoveryRouteScope;
}) {
  const [query, setQuery] = useState("");

  const filteredSessions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sessions;
    return sessions.filter((session) => {
      return (
        session.task.toLowerCase().includes(normalized) ||
        session.mode.toLowerCase().includes(normalized) ||
        (session.active_scenario ?? "").toLowerCase().includes(normalized)
      );
    });
  }, [query, sessions]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[14px] font-medium text-foreground">
          Sessions{" "}
          <span className="text-muted-foreground">{sessions.length}</span>
        </h3>
      </div>

      {/* Search */}
      <div className="mb-3">
        <div className="flex h-8 items-center gap-2 rounded-md border border-border px-2.5 focus-within:ring-2 focus-within:ring-primary/20">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter sessions..."
            className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
      </div>

      {/* Session list */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loadState === "loading" && sessions.length === 0 ? (
          <SkeletonList rows={6} className="px-3" />
        ) : null}

        {error ? (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-200">
            {error}
          </div>
        ) : null}

        <div className="divide-y divide-border">
          {filteredSessions.map((session) => {
            const isActive = session.id === activeSessionId;
            return (
              <Link
                key={session.id}
                href={buildDiscoverySessionScopeHref(session.id, routeScope)}
                className={cn(
                  "block px-2 py-3 transition-colors hover:bg-[color:var(--shell-control-hover)]",
                  isActive && "bg-[color:var(--shell-nav-active)]"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-foreground">
                      {session.task || session.id}
                    </div>
                    <div className="mt-1 text-[12px] text-muted-foreground">
                      {session.mode} · {formatRelativeTime(session.created_at)}
                    </div>
                  </div>
                  <Badge tone={statusTone(session.status)}>{session.status}</Badge>
                </div>
              </Link>
            );
          })}
        </div>

        {loadState !== "loading" && filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-[13px] text-muted-foreground">
              {sessions.length === 0
                ? "No sessions available. Connect Quorum to see discovery sessions."
                : "No sessions match the current filter."}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DiscoveryConversation({
  messages,
}: {
  messages: QuorumMessage[];
}) {
  const visibleMessages = messages.filter((message) =>
    Boolean(sanitizeMessage(message.content))
  );

  return (
    <ShellSectionCard
      title="Conversation"
      className="min-h-[420px]"
      contentClassName="space-y-3"
    >
        {visibleMessages.length === 0 ? (
          <ShellEmptyState
            title="Conversation state"
            description="No readable messages are available yet."
          />
        ) : (
          visibleMessages.map((message, index) => (
            <ShellRecordSection
              key={`${message.agent_id}-${message.timestamp}-${index}`}
              title={
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral" className="capitalize">
                    {readableAgentName(message)}
                  </Badge>
                  <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    {message.phase}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(message.timestamp)}
                  </span>
                </div>
              }
              className="bg-background/70"
            >
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground/88">
                {message.content.trim()}
              </p>
            </ShellRecordSection>
          ))
        )}
    </ShellSectionCard>
  );
}

function DiscoveryTimeline({
  events,
  streamState,
}: {
  events: QuorumSessionEvent[];
  streamState: SessionStreamState;
}) {
  const visibleEvents = [...events].reverse();

  return (
    <ShellSectionCard
      title="Timeline"
      className="min-h-[420px]"
      contentClassName="space-y-3"
    >
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge tone={streamTone(streamState)}>{streamLabel(streamState)}</Badge>
          <span>cursor {maxEventId(events)}</span>
        </div>
        {visibleEvents.length === 0 ? (
          <ShellEmptyState
            title="Timeline state"
            description="No runtime events are available yet."
          />
        ) : (
          visibleEvents.map((event) => (
            <ShellRecordSection
              key={event.id}
              title={
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(event.status ?? "neutral")}>
                    {event.type}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(event.timestamp)}
                  </span>
                </div>
              }
              className="bg-background/70"
            >
              <div className="mt-3 text-sm font-semibold text-foreground">
                {event.title}
              </div>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                {event.detail}
              </p>
            </ShellRecordSection>
          ))
        )}
    </ShellSectionCard>
  );
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function SessionControlsPanel({
  isPending,
  session,
  launchPresets,
  routeScope,
  onDidMutate,
}: {
  isPending: boolean;
  session: QuorumSession;
  launchPresets: QuorumAutopilotLaunchPreset[];
  routeScope?: Partial<ShellRouteScope> | null;
  onDidMutate: (effect: DiscoveryMutationEffect) => void;
}) {
  const [draft, setDraft] = useState("");
  const [selectedLaunchPresetId, setSelectedLaunchPresetId] = useState("team");
  const {
    busyActionKey: busyAction,
    errorMessage,
    runMutation: runAction,
    statusMessage,
  } = useShellMutationRunner<DiscoveryMutationEffect>({
    applyEffect: onDidMutate,
  });
  const sessionActionState = useMemo(
    () => resolveDiscoverySessionActionState(session),
    [session]
  );

  const effectiveSelectedLaunchPresetId = useMemo(
    () =>
      resolveDiscoveryLaunchPresetId(
        launchPresets,
        selectedLaunchPresetId,
        session.mode
      ),
    [launchPresets, selectedLaunchPresetId, session.mode]
  );

  async function handleQueueInstruction() {
    const content = draft.trim();
    if (!content) return;
    await runAction("queue", async () => {
      setDraft("");
      return runDiscoverySessionAction({
        action: "queue",
        sessionId: session.id,
        content,
        routeScope,
        source: "discovery-workspace",
      });
    });
  }

  async function handleResume() {
    await runAction("resume", async () => {
      setDraft("");
      return runDiscoverySessionAction({
        action: "resume",
        sessionId: session.id,
        content: draft.trim() || undefined,
        routeScope,
        source: "discovery-workspace",
      });
    });
  }

  async function handleCancel() {
    await runAction("cancel", () =>
      runDiscoverySessionAction({
        action: "cancel",
        sessionId: session.id,
        routeScope,
        source: "discovery-workspace",
      })
    );
  }

  async function handleRestartBranch() {
    const checkpointId = session.current_checkpoint_id;
    if (!checkpointId) return;
    await runAction("restart", async () => {
      setDraft("");
      return runDiscoverySessionAction({
        action: "restart",
        sessionId: session.id,
        checkpointId,
        content: draft.trim() || undefined,
        routeScope,
        source: "discovery-workspace",
      });
    });
  }

  async function handleContinueConversation() {
    const content = draft.trim();
    if (!content) return;
    await runAction("continue", async () => {
      setDraft("");
      return runDiscoverySessionAction({
        action: "continue",
        sessionId: session.id,
        content,
        routeScope,
        source: "discovery-workspace",
      });
    });
  }

  async function handleExportBrief() {
    await runAction("export", async () => {
      const effect = await runDiscoverySessionAction({
        action: "export",
        sessionId: session.id,
      });
      const brief = resolveDiscoveryMutationBrief(effect);
      if (brief) {
        downloadJson(`${session.id}-execution-brief.json`, brief);
      }
      return effect;
    });
  }

  async function handleOpenExecutionHandoff(launch: boolean) {
    await runAction(launch ? "launch" : "handoff", () =>
      runDiscoverySessionAction({
        action: launch ? "launch" : "handoff",
        sessionId: session.id,
        selectedLaunchPresetId: effectiveSelectedLaunchPresetId,
        launchPresets,
        routeScope,
        source: "discovery-workspace",
      })
    );
  }

  async function handlePrepareTournament() {
    await runAction("tournament", () =>
      runDiscoverySessionAction({
        action: "tournament",
        sessionId: session.id,
        routeScope,
        source: "discovery-workspace",
      })
    );
  }

  return (
    <div className="space-y-4">
      <ShellSectionCard
        title="Controls"
        contentClassName="space-y-4"
      >
          <div className="flex flex-wrap gap-2">
            {sessionActionState.isPaused ? (
              <ShellPillButton
                type="button"
                tone="primary"
                onClick={handleResume}
                disabled={busyAction.length > 0 || !sessionActionState.canResume}
              >
                <ShellActionStateLabel
                  busy={busyAction === "resume"}
                  idleLabel="Resume session"
                  busyLabel="Resume session"
                  icon={<PlayCircle className="h-4 w-4" />}
                />
              </ShellPillButton>
            ) : null}

            {sessionActionState.isRunning ? (
              <ShellPillButton
                type="button"
                tone="outline"
                onClick={handleCancel}
                disabled={
                  busyAction.length > 0 || !sessionActionState.canCancel
                }
              >
                <ShellActionStateLabel
                  busy={busyAction === "cancel"}
                  idleLabel="Stop session"
                  busyLabel="Stop session"
                  icon={<Square className="h-4 w-4" />}
                />
              </ShellPillButton>
            ) : null}

            {(sessionActionState.isPaused || sessionActionState.isTerminal) &&
            sessionActionState.canRestart ? (
              <ShellPillButton
                type="button"
                tone="outline"
                onClick={handleRestartBranch}
                disabled={busyAction.length > 0 || !session.current_checkpoint_id}
              >
                <ShellActionStateLabel
                  busy={busyAction === "restart"}
                  idleLabel="New branch"
                  busyLabel="New branch"
                  icon={<GitBranch className="h-4 w-4" />}
                />
              </ShellPillButton>
            ) : null}
          </div>

          {(sessionActionState.isPaused || sessionActionState.isTerminal) ? (
            <ShellRecordSection
              title={
                sessionActionState.isPaused
                  ? "Checkpoint instructions"
                  : "Continue with the team"
              }
              className="bg-background/60"
            >
              <div className="mt-3 space-y-3">
                <ShellComposerTextarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={
                    sessionActionState.isPaused
                      ? "Add guidance for the next resumed step"
                      : "Write the next instruction for the continuation branch"
                  }
                  className="min-h-[112px]"
                />
                <div className="flex flex-wrap gap-2">
                  {sessionActionState.isPaused ? (
                    <ShellPillButton
                      type="button"
                      tone="outline"
                      onClick={handleQueueInstruction}
                      disabled={
                        busyAction.length > 0 ||
                        !draft.trim() ||
                        !sessionActionState.canQueueInstruction
                      }
                    >
                      <ShellActionStateLabel
                        busy={busyAction === "queue"}
                        idleLabel="Save instruction"
                        busyLabel="Save instruction"
                        icon={<Send className="h-4 w-4" />}
                      />
                    </ShellPillButton>
                  ) : null}

                  {sessionActionState.isTerminal ? (
                    <ShellPillButton
                      type="button"
                      tone="primary"
                      onClick={handleContinueConversation}
                      disabled={
                        busyAction.length > 0 ||
                        !draft.trim() ||
                        !sessionActionState.canContinueConversation
                      }
                    >
                      <ShellActionStateLabel
                        busy={busyAction === "continue"}
                        idleLabel="Continue discussion"
                        busyLabel="Continue discussion"
                        icon={<PlayCircle className="h-4 w-4" />}
                      />
                    </ShellPillButton>
                  ) : null}
                </div>
              </div>
            </ShellRecordSection>
          ) : null}
      </ShellSectionCard>

      <ShellSectionCard
        title="Execution handoff"
        contentClassName="space-y-4"
      >
          {launchPresets.length > 0 ? (
            <label className="block space-y-2">
              <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Autopilot launch mode
              </span>
              <ShellSelectField
                value={effectiveSelectedLaunchPresetId}
                onChange={(event) => setSelectedLaunchPresetId(event.target.value)}
              >
                {launchPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </ShellSelectField>
            </label>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <ShellPillButton
              type="button"
              tone="outline"
              onClick={handleExportBrief}
              disabled={busyAction.length > 0}
            >
              <ShellActionStateLabel
                busy={busyAction === "export"}
                idleLabel="Export Brief"
                busyLabel="Export Brief"
                icon={<Upload className="h-4 w-4" />}
              />
            </ShellPillButton>
            <ShellPillButton
              type="button"
              tone="outline"
              onClick={() => void handleOpenExecutionHandoff(false)}
              disabled={busyAction.length > 0}
            >
              <ShellActionStateLabel
                busy={busyAction === "handoff"}
                idleLabel="Open in Execution"
                busyLabel="Open in Execution"
                icon={<Send className="h-4 w-4" />}
              />
            </ShellPillButton>
            <ShellPillButton
              type="button"
              tone="primary"
              onClick={() => void handleOpenExecutionHandoff(true)}
              disabled={busyAction.length > 0}
            >
              <ShellActionStateLabel
                busy={busyAction === "launch"}
                idleLabel="Launch via Execution"
                busyLabel="Launch via Execution"
                icon={<Rocket className="h-4 w-4" />}
              />
            </ShellPillButton>
            {sessionActionState.showTournamentPrep ? (
              <ShellPillButton
                type="button"
                tone="outline"
                onClick={handlePrepareTournament}
                disabled={busyAction.length > 0}
              >
                <ShellActionStateLabel
                  busy={busyAction === "tournament"}
                  idleLabel="Prepare tournament"
                  busyLabel="Prepare tournament"
                  icon={<PauseCircle className="h-4 w-4" />}
                />
              </ShellPillButton>
            ) : null}
          </div>

          {statusMessage ? (
            <ShellStatusBanner tone="success">{statusMessage}</ShellStatusBanner>
          ) : null}
          {errorMessage ? (
            <ShellStatusBanner tone="danger">{errorMessage}</ShellStatusBanner>
          ) : null}
          {isPending ? (
            <ShellInlineStatus busy label="Updating discovery view..." className="text-xs" />
          ) : null}
      </ShellSectionCard>
    </div>
  );
}

function DiscoverySessionMonitor({
  session,
  events,
  launchPresets,
  loadState,
  streamState,
  error,
  isRefreshing,
  isPending,
  routeScope,
  onDidMutate,
  onRefresh,
}: {
  session: QuorumSession | null;
  events: QuorumSessionEvent[];
  launchPresets: QuorumAutopilotLaunchPreset[];
  loadState: SessionLoadState;
  streamState: SessionStreamState;
  error: string | null;
  isRefreshing: boolean;
  isPending: boolean;
  routeScope?: Partial<ShellRouteScope> | null;
  onDidMutate: (effect: DiscoveryMutationEffect) => void;
  onRefresh: () => void;
}) {
  if (loadState === "loading" && !session) {
    return <SkeletonList rows={6} className="py-4" />;
  }

  if (error) {
    return (
      <ShellStatusBanner tone="danger" className="py-10">
        {error}
      </ShellStatusBanner>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-[500px] items-center justify-center text-[13px] text-muted-foreground">
        Select a session to view details.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Session header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold text-foreground">
            {session.task || session.id}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
            <span>{session.mode}</span>
            <span>·</span>
            <Badge tone={statusTone(session.status)}>{session.status}</Badge>
            <span>·</span>
            <span>{formatRelativeTime(session.created_at)}</span>
          </div>
        </div>
        <ShellRefreshButton type="button" onClick={onRefresh} busy={isRefreshing} />
      </div>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-3">
            <ShellActionLink
              href={buildDiscoveryReplayScopeHref(session.id, routeScope)}
              label="Open replay route"
            />
            <ShellActionLink
              href={buildDiscoveryTracesScopeHref(routeScope)}
              label="Open trace coverage"
            />
            <ShellActionLink
              href={buildDiscoveryBoardArchiveScopeHref(routeScope)}
              label="Open archive frontier"
            />
            <ShellActionLink
              href={buildDiscoveryBoardFinalsScopeHref(routeScope)}
              label="Open finals route"
            />
          </div>
          <section className="grid gap-4 xl:grid-cols-2">
            <DiscoveryConversation messages={session.messages} />
            <DiscoveryTimeline events={events} streamState={streamState} />
          </section>
        </div>
        <SessionControlsPanel
          isPending={isPending}
          session={session}
          launchPresets={launchPresets}
          routeScope={routeScope}
          onDidMutate={onDidMutate}
        />
      </section>
    </div>
  );
}

export function DiscoveryWorkspace({
  activeSessionId,
  initialPreferences,
  initialSnapshot,
  routeScope = { projectId: "", intakeSessionId: "" },
}: {
  activeSessionId: string | null;
  initialPreferences?: ShellPreferences;
  initialSnapshot?: ShellDiscoverySessionsSnapshot | null;
  routeScope?: DiscoveryRouteScope;
}) {
  const router = useRouter();
  const { preferences } = useShellPreferences(initialPreferences);
  const reviewHref = useMemo(
    () =>
      buildRememberedDiscoveryReviewScopeHref({
        scope: routeScope,
        preferences,
        bucket: resolveReviewMemoryBucket({ scope: routeScope }),
      }),
    [preferences, routeScope]
  );
  const { isRefreshing, refresh, refreshNonce: manualRefreshNonce } = useShellManualRefresh();
  const { applyEffect, isPending, refreshNonce } =
    useShellRouteMutationRunner<DiscoveryMutationEffect>({
    planes: ["discovery"],
    scope: routeScope,
    source: "discovery-workspace",
    reason: "session-mutation",
  });
  const routeRefreshNonce = useShellSnapshotRefreshNonce({
    baseRefreshNonce: refreshNonce,
    additionalRefreshNonce: manualRefreshNonce,
    invalidation: {
      planes: ["discovery", "execution"],
      resource: {
        discoverySessionId: activeSessionId || "",
      },
      scope: routeScope,
    },
    invalidationOptions: {
      ignoreSources: ["discovery-workspace"],
      since: initialSnapshot?.generatedAt ?? null,
    },
  });
  const scopeActive = hasShellRouteScope(routeScope);
  const { loadState, snapshot } = useQuorumDiscoverySnapshot(
    activeSessionId,
    routeRefreshNonce,
    initialSnapshot,
    initialPreferences
  );
  const { session, events, streamState } = useQuorumLiveSessionState(
    activeSessionId,
    snapshot
  );
  const sessions = snapshot.sessions;
  const linkedIdeas = snapshot.linkedIdeas;
  const chainStats = snapshot.chainStats;
  const sessionsState: SessionLoadState =
    snapshot.sessionsLoadState === "ready"
      ? "ready"
      : loadState === "loading" && sessions.length === 0
        ? "loading"
        : "error";
  const sessionsError = snapshot.sessionsError;
  const chainsError = snapshot.chainsError;
  const launchPresets = snapshot.launchPresets;
  const sessionState: SessionLoadState = activeSessionId
    ? snapshot.sessionLoadState === "ready"
      ? "ready"
      : snapshot.sessionLoadState === "idle"
        ? loadState
        : loadState === "loading" && !session
          ? "loading"
          : "error"
    : "idle";
  const sessionError = activeSessionId ? snapshot.sessionError : null;

  useEffect(() => {
    const nextHref = resolveDiscoverySessionAutoOpenHref({
      activeSessionId,
      sessions,
      routeScope: scopeActive ? routeScope : null,
    });
    if (!nextHref) {
      return;
    }
    router.replace(nextHref);
  }, [activeSessionId, routeScope, router, scopeActive, sessions]);

  return (
    <div className="mx-auto flex h-[calc(100vh-89px)] w-full max-w-[1600px] gap-4 px-4 py-4 md:px-6">
      <aside className="hidden min-h-0 w-[340px] shrink-0 xl:block">
        <DiscoverySessionsList
          sessions={sessions}
          linkedIdeas={linkedIdeas}
          chainStats={chainStats}
          activeSessionId={activeSessionId}
          loadState={sessionsState}
          error={sessionsError}
          chainsError={chainsError}
          reviewHref={reviewHref}
          routeScope={routeScope}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto">
        <div className="xl:hidden">
          <DiscoverySessionsList
            sessions={sessions}
            linkedIdeas={linkedIdeas}
            chainStats={chainStats}
            activeSessionId={activeSessionId}
            loadState={sessionsState}
            error={sessionsError}
            chainsError={chainsError}
            reviewHref={reviewHref}
            routeScope={routeScope}
          />
        </div>

        <DiscoverySessionMonitor
          session={session}
          events={events}
          launchPresets={launchPresets}
          loadState={sessionState}
          streamState={streamState}
          error={sessionError}
          isRefreshing={isRefreshing}
          isPending={isPending}
          routeScope={routeScope}
          onDidMutate={applyEffect}
          onRefresh={refresh}
        />
      </div>
    </div>
  );
}
