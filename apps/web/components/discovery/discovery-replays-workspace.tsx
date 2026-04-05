"use client";

import type {
  QuorumDebateReplaySession,
  QuorumDebateReplayStep,
  QuorumSessionSummary,
  ShellPreferences,
} from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import { useCallback, useMemo, useState } from "react";

import {
  ShellEmptyState,
  ShellHero,
  ShellLoadingState,
  ShellPage,
  ShellSearchSectionCard,
  ShellListLink,
  ShellStatusBanner,
} from "@/components/shell/shell-screen-primitives";
import type { ShellDiscoveryReplaySnapshot } from "@/lib/discovery-history";
import {
  buildRememberedDiscoveryReviewScopeHref,
  resolveReviewMemoryBucket,
} from "@/lib/review-memory";
import { fetchShellDiscoveryReplaySnapshot } from "@/lib/shell-snapshot-client";
import {
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import { useShellSnapshotRefreshNonce } from "@/lib/use-shell-snapshot-refresh-nonce";
import {
  buildDiscoveryReplayScopeHref,
  type ShellRouteScope,
} from "@/lib/route-scope";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";

type DiscoveryReplayRouteScope = ShellRouteScope;

const EMPTY_DISCOVERY_REPLAY_SNAPSHOT: ShellDiscoveryReplaySnapshot = {
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

function formatDate(value?: number | null) {
  if (!value) return "n/a";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value * 1000));
}

function formatDateShort(value?: number | null) {
  if (!value) return "n/a";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value * 1000));
}

function formatElapsed(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "n/a";
  if (value < 60) return `${Math.round(value)}s`;
  if (value < 3600) return `${Math.floor(value / 60)}m`;
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function formatDelta(createdAt: number, timestamp: number) {
  if (!timestamp || !createdAt) return "t+0s";
  const delta = Math.max(0, timestamp - createdAt);
  return `t+${delta.toFixed(delta >= 10 ? 0 : 1)}s`;
}

// Provider color mapping for agent identity
function getProviderColor(provider: string): string {
  const p = provider.toLowerCase();
  if (p.includes("claude") || p.includes("anthropic")) return "text-blue-500";
  if (p.includes("gemini") || p.includes("google")) return "text-red-500";
  if (p.includes("codex") || p.includes("openai") || p.includes("gpt")) return "text-green-500";
  if (p.includes("grok") || p.includes("xai")) return "text-orange-500";
  return "text-muted-foreground";
}

function getProviderIcon(provider: string): string {
  const p = provider.toLowerCase();
  if (p.includes("claude") || p.includes("anthropic")) return "🔵";
  if (p.includes("gemini") || p.includes("google")) return "🔴";
  if (p.includes("codex") || p.includes("openai") || p.includes("gpt")) return "🟢";
  if (p.includes("grok") || p.includes("xai")) return "🟠";
  return "⚪";
}

function getRoleIcon(role: string): string {
  const r = role.toLowerCase();
  if (r.includes("judge")) return "⚖️";
  return "";
}

// Resolve provider from agent_id or step metadata
function resolveStepProvider(
  step: QuorumDebateReplayStep,
  participants: QuorumDebateReplaySession["participants"]
): { provider: string; role: string } | null {
  if (!step.agent_id) return null;
  const participant = participants.find(
    (p) =>
      p.role.toLowerCase() === step.agent_id?.toLowerCase() ||
      p.provider.toLowerCase().includes(step.agent_id?.toLowerCase() ?? "")
  );
  if (participant) return { provider: participant.provider, role: participant.role };
  return { provider: step.agent_id, role: step.agent_id };
}

// Group timeline steps into logical rounds for display
function groupTimelineIntoRounds(
  timeline: QuorumDebateReplayStep[]
): Array<{ label: string; steps: QuorumDebateReplayStep[]; isVerdict: boolean }> {
  if (!timeline.length) return [];

  const groups: Array<{ label: string; steps: QuorumDebateReplayStep[]; isVerdict: boolean }> = [];
  let currentGroup: { label: string; steps: QuorumDebateReplayStep[]; isVerdict: boolean } | null = null;
  let roundIndex = 0;

  for (const step of timeline) {
    const isRoundBoundary =
      step.kind === "protocol_transition" ||
      step.kind === "session_event" ||
      step.title.toLowerCase().includes("round") ||
      step.title.toLowerCase().includes("verdict") ||
      step.title.toLowerCase().includes("judge");

    const isVerdict =
      step.title.toLowerCase().includes("verdict") ||
      step.title.toLowerCase().includes("judge decision") ||
      step.kind === "protocol_transition" && step.title.toLowerCase().includes("final");

    if (isRoundBoundary || !currentGroup) {
      roundIndex++;
      const label = step.title || `Round ${roundIndex}`;
      currentGroup = { label, steps: [], isVerdict };
      groups.push(currentGroup);
    } else {
      currentGroup.steps.push(step);
    }
  }

  // If everything ended up as boundary steps with no content, flatten
  const hasContent = groups.some((g) => g.steps.length > 0);
  if (!hasContent) {
    return [{ label: "Timeline", steps: timeline, isVerdict: false }];
  }

  return groups;
}

function AgentMessage({
  step,
  participants,
}: {
  step: QuorumDebateReplayStep;
  participants: QuorumDebateReplaySession["participants"];
}) {
  const agent = resolveStepProvider(step, participants);
  const provider = agent?.provider ?? "";
  const role = agent?.role ?? step.kind;
  const icon = role.toLowerCase().includes("judge")
    ? getRoleIcon(role)
    : agent
    ? getProviderIcon(provider)
    : "◦";
  const colorClass = agent ? getProviderColor(provider) : "text-muted-foreground";
  const displayName = role || provider || step.agent_id || step.kind;

  return (
    <div className="flex gap-3">
      <div className={`mt-0.5 shrink-0 text-base leading-none ${colorClass}`}>
        {icon || "◦"}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`mb-1 text-[13px] font-medium ${colorClass}`}>
          {displayName}
          {provider && role !== provider && (
            <span className="ml-1.5 font-normal text-muted-foreground">({provider})</span>
          )}
        </div>
        <div className="text-[14px] leading-relaxed text-foreground">
          {step.detail || step.title}
        </div>
        {step.status && (
          <div className="mt-1 text-[11px] text-muted-foreground">{step.status}</div>
        )}
      </div>
    </div>
  );
}

function ReplayTimeline({ replay }: { replay: QuorumDebateReplaySession }) {
  const groups = useMemo(
    () => groupTimelineIntoRounds(replay.timeline),
    [replay.timeline]
  );

  if (!replay.timeline.length) {
    return <ShellEmptyState description="No timeline steps available for this replay." />;
  }

  return (
    <div className="space-y-6">
      {groups.map((group, groupIndex) => (
        <div key={`group-${groupIndex}`}>
          {/* Round header */}
          <div
            className={`mb-3 ${
              group.isVerdict
                ? "rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2"
                : ""
            }`}
          >
            <div className="flex items-center gap-2">
              {group.isVerdict && (
                <span className="text-sm text-amber-500">⚖️</span>
              )}
              <span className="text-[14px] font-medium text-foreground">
                {group.label}
              </span>
            </div>
            <div className="mt-1 h-px bg-border" />
          </div>

          {/* Messages in this round */}
          {group.steps.length > 0 && (
            <div className="space-y-4 pl-1">
              {group.steps.map((step) => (
                <AgentMessage
                  key={step.replay_id}
                  step={step}
                  participants={replay.participants}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ReplayDetail({ replay }: { replay: QuorumDebateReplaySession }) {
  return (
    <div className="space-y-6 rounded-lg border border-border bg-card p-6">
      {/* Session header */}
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">{replay.status}</Badge>
          <Badge tone="neutral">{replay.mode}</Badge>
          {replay.elapsed_sec != null && (
            <span className="text-[12px] text-muted-foreground">
              {formatElapsed(replay.elapsed_sec)}
            </span>
          )}
        </div>
        <h2 className="text-[15px] font-semibold text-foreground leading-snug">
          {replay.task}
        </h2>
        <div className="flex flex-wrap gap-3 text-[12px] text-muted-foreground">
          <span>{formatDate(replay.created_at)}</span>
          <span>{replay.timeline.length} steps</span>
          <span>{replay.participants.length} participants</span>
        </div>
      </div>

      {/* Participants */}
      {replay.participants.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {replay.participants.map((p, i) => {
            const icon = p.role.toLowerCase().includes("judge")
              ? "⚖️"
              : getProviderIcon(p.provider);
            const colorClass = getProviderColor(p.provider);
            return (
              <div
                key={`${p.role}:${p.provider}:${i}`}
                className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1"
              >
                <span className={`text-sm ${colorClass}`}>{icon}</span>
                <span className="text-[12px] font-medium text-foreground">{p.role}</span>
                <span className="text-[11px] text-muted-foreground">· {p.provider}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Debate timeline */}
      <ReplayTimeline replay={replay} />
    </div>
  );
}

function SessionRail({
  sessions,
  activeSessionId,
  routeScope,
}: {
  sessions: QuorumSessionSummary[];
  activeSessionId: string | null;
  routeScope: DiscoveryReplayRouteScope;
}) {
  const [query, setQuery] = useState("");
  const filteredSessions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sessions;
    return sessions.filter(
      (session) =>
        session.task.toLowerCase().includes(normalized) ||
        session.mode.toLowerCase().includes(normalized) ||
        session.status.toLowerCase().includes(normalized)
    );
  }, [query, sessions]);

  return (
    <ShellSearchSectionCard
      title="Replay sessions"
      actions={<Badge tone="info">{sessions.length}</Badge>}
      searchValue={query}
      onSearchChange={(event) => setQuery(event.target.value)}
      searchPlaceholder="Filter sessions"
      contentClassName="space-y-1"
    >
      {filteredSessions.length ? (
        filteredSessions.map((session) => {
          const active = session.id === activeSessionId;
          const statusTone =
            session.status === "completed"
              ? ("success" as const)
              : session.status === "failed"
              ? ("danger" as const)
              : ("info" as const);
          return (
            <ShellListLink
              key={session.id}
              href={buildDiscoveryReplayScopeHref(session.id, routeScope)}
              className={
                active
                  ? "border-primary/35 bg-[color:var(--shell-nav-active)] px-3 py-2.5"
                  : "px-3 py-2.5"
              }
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-foreground">
                    {session.task}
                  </div>
                  <div className="mt-0.5 text-[12px] text-muted-foreground">
                    {session.mode} · {formatDateShort(session.created_at)}
                  </div>
                </div>
                <Badge tone={statusTone} className="shrink-0">
                  {session.status}
                </Badge>
              </div>
            </ShellListLink>
          );
        })
      ) : (
        <ShellEmptyState description="No replay sessions available." />
      )}
    </ShellSearchSectionCard>
  );
}

export function DiscoveryReplaysWorkspace({
  activeSessionId,
  initialPreferences,
  initialSnapshot,
  routeScope = { projectId: "", intakeSessionId: "" },
}: {
  activeSessionId: string | null;
  initialPreferences?: ShellPreferences;
  initialSnapshot?: ShellDiscoveryReplaySnapshot | null;
  routeScope?: DiscoveryReplayRouteScope;
}) {
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
  const snapshotRefreshNonce = useShellSnapshotRefreshNonce({
    invalidation: {
      planes: ["discovery"],
      scope: routeScope,
      resource: activeSessionId
        ? { discoverySessionId: activeSessionId }
        : undefined,
    },
    invalidationOptions: {
      since: initialSnapshot?.generatedAt ?? null,
    },
  });
  const pollInterval = getShellPollInterval(
    activeSessionId ? "discovery_replay" : "discovery_sessions",
    preferences.refreshProfile
  );
  const loadSnapshot = useCallback(
    () => fetchShellDiscoveryReplaySnapshot(activeSessionId),
    [activeSessionId]
  );
  const selectLoadState = useCallback(
    (nextSnapshot: ShellDiscoveryReplaySnapshot) =>
      activeSessionId
        ? nextSnapshot.replayLoadState === "idle"
          ? "ready"
          : nextSnapshot.replayLoadState
        : nextSnapshot.sessionsLoadState,
    [activeSessionId]
  );
  const { snapshot, loadState } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_DISCOVERY_REPLAY_SNAPSHOT,
    initialSnapshot,
    refreshNonce: snapshotRefreshNonce,
    pollIntervalMs: pollInterval,
    loadSnapshot,
    selectLoadState,
  });

  const replay = snapshot.replay;
  const errors = [
    ...snapshot.errors,
    snapshot.sessionsError ?? "",
    snapshot.replayError ?? "",
  ].filter(Boolean);

  return (
    <ShellPage className="max-w-[1600px]">
      <ShellHero title="Replays" />

      {errors.length > 0 && (
        <ShellStatusBanner tone="warning">{errors.join(" ")}</ShellStatusBanner>
      )}

      <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <SessionRail
          sessions={snapshot.sessions}
          activeSessionId={activeSessionId}
          routeScope={routeScope}
        />

        <div>
          {replay ? (
            <ReplayDetail replay={replay} />
          ) : loadState === "loading" ? (
            <ShellLoadingState description="Loading replay..." />
          ) : (
            <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-border">
              <p className="text-[13px] text-muted-foreground">
                No replay sessions available.
              </p>
            </div>
          )}
        </div>
      </section>
    </ShellPage>
  );
}
