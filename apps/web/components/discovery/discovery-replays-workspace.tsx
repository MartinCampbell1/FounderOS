"use client";

import type {
  QuorumDebateReplaySession,
  QuorumDebateReplayStep,
  QuorumSessionSummary,
  ShellPreferences,
} from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import {
  GitBranch,
  PlayCircle,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  ShellRecordAccessory,
  ShellRecordBody,
  ShellRecordCard,
  ShellRecordHeader,
  ShellRecordMeta,
  ShellRecordSection,
} from "@/components/shell/shell-record-primitives";
import {
  ShellActionLink,
  ShellEmptyState,
  ShellFilterChipLink,
  ShellHero,
  ShellLinkTileGrid,
  ShellListLink,
  ShellLoadingState,
  ShellPage,
  ShellSearchSectionCard,
  ShellSectionCard,
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
  buildDashboardScopeHref,
  buildDiscoveryReplayScopeHref,
  buildDiscoverySessionScopeHref,
  buildDiscoveryTracesScopeHref,
  buildInboxScopeHref,
  buildSettingsScopeHref,
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

function ReplayStepRow({
  replay,
  step,
}: {
  replay: QuorumDebateReplaySession;
  step: QuorumDebateReplayStep;
}) {
  return (
    <ShellRecordCard>
      <ShellRecordHeader
        badges={<Badge tone="info">{step.kind}</Badge>}
        title={step.title}
        description={step.detail || step.kind}
        accessory={
          <ShellRecordAccessory
            label="Offset"
            value={formatDelta(replay.created_at, step.timestamp)}
          />
        }
      />
    </ShellRecordCard>
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
    if (!normalized) {
      return sessions;
    }

    return sessions.filter((session) => {
      return (
        session.task.toLowerCase().includes(normalized) ||
        session.mode.toLowerCase().includes(normalized) ||
        session.status.toLowerCase().includes(normalized)
      );
    });
  }, [query, sessions]);

  return (
    <ShellSearchSectionCard
      title="Debate replay"
      description="Replay sessions"
      actions={<Badge tone="info">{sessions.length} total</Badge>}
      searchValue={query}
      onSearchChange={(event) => setQuery(event.target.value)}
      searchPlaceholder="Filter sessions"
      contentClassName="space-y-3"
    >
      {filteredSessions.length ? (
        filteredSessions.map((session) => {
          const active = session.id === activeSessionId;
          return (
            <ShellListLink
              key={session.id}
              href={buildDiscoveryReplayScopeHref(session.id, routeScope)}
              className={
                active
                  ? "border-primary/35 bg-[color:var(--shell-nav-active)] p-4"
                  : "p-4"
              }
            >
              <div className="text-sm font-semibold text-foreground">{session.task}</div>
              <div className="mt-1 text-xs leading-6 text-muted-foreground">
                {session.mode} · {session.status} · {formatDate(session.created_at)}
              </div>
            </ShellListLink>
          );
        })
      ) : (
        <ShellEmptyState description="No replayable sessions are visible yet." />
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
      resource: activeSessionId ? { discoverySessionId: activeSessionId } : undefined,
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
  const { snapshot, loadState } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_DISCOVERY_REPLAY_SNAPSHOT,
    initialSnapshot,
    refreshNonce: snapshotRefreshNonce,
    pollIntervalMs: pollInterval,
    loadSnapshot,
    selectLoadState: (nextSnapshot) =>
      activeSessionId
        ? nextSnapshot.replayLoadState === "idle"
          ? "ready"
          : nextSnapshot.replayLoadState
        : nextSnapshot.sessionsLoadState,
  });

  const replay = snapshot.replay;
  const errors = [
    ...snapshot.errors,
    snapshot.sessionsError ?? "",
    snapshot.replayError ?? "",
  ].filter(Boolean);

  return (
    <ShellPage className="max-w-[1600px]">
      <ShellHero
        eyebrow={<Badge tone="info">Debate replay</Badge>}
        title="Replayable Quorum session history now lives inside the shell."
        meta={
          <>
            <span>{snapshot.sessions.length} sessions</span>
            <span>{replay ? `${replay.timeline.length} replay steps` : "No replay selected"}</span>
            <span>Snapshot {snapshot.generatedAt ? formatDate(Math.floor(Date.parse(snapshot.generatedAt) / 1000)) : "n/a"}</span>
          </>
        }
        actions={
          <>
            <ShellFilterChipLink href={buildDiscoveryTracesScopeHref(routeScope)} label="Traces" />
            <ShellFilterChipLink href={reviewHref} label="Review" />
            <ShellFilterChipLink
              href={buildDiscoveryReplayScopeHref(undefined, routeScope)}
              label="Refresh route"
            />
          </>
        }
        aside="Replay routes keep the active execution-chain context attached, so session history can return directly into the same dashboard, inbox, and discovery loop."
      />

      {errors.length > 0 ? (
        <ShellStatusBanner tone="warning">{errors.join(" ")}</ShellStatusBanner>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <SessionRail
          sessions={snapshot.sessions}
          activeSessionId={activeSessionId}
          routeScope={routeScope}
        />

        <div className="space-y-4">
          {replay ? (
            <>
              <ShellHero
                eyebrow={<Badge tone="info">Replay session</Badge>}
                title={replay.task}
                description="Replay surface for generation, checkpoint, and protocol trace history."
                meta={
                  <>
                    <span>{replay.session_id}</span>
                    <span>{formatDate(replay.created_at)}</span>
                    <span>{formatElapsed(replay.elapsed_sec)}</span>
                    <span>{replay.timeline.length} steps</span>
                    <span>{replay.invalid_transition_count} invalid transitions</span>
                  </>
                }
                aside={
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="neutral">{replay.mode}</Badge>
                      <Badge tone="info">{replay.status}</Badge>
                      <Badge tone="neutral">{replay.timeline.length} steps</Badge>
                    </div>
                    <div className="space-y-2">
                      <ShellActionLink
                        href={buildDiscoverySessionScopeHref(replay.session_id, routeScope)}
                        label="Open session monitor"
                      />
                      <ShellActionLink
                        href={buildDiscoveryTracesScopeHref(routeScope)}
                        label="Open trace coverage"
                      />
                      <ShellActionLink href={reviewHref} label="Open discovery review" />
                      <ShellActionLink
                        href={buildSettingsScopeHref(routeScope, {
                          discoverySessionId: activeSessionId || "",
                        })}
                        label="Open scoped settings"
                      />
                    </div>
                  </div>
                }
              />


              <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                <ShellSectionCard
                  title="Replay timeline"
                  contentClassName="space-y-3"
                >
                  {replay.timeline.length ? (
                    replay.timeline
                      .slice()
                      .reverse()
                      .slice(0, 12)
                      .map((item) => (
                        <ReplayStepRow
                          key={item.replay_id}
                          replay={replay}
                          step={item}
                        />
                      ))
                  ) : (
                    <ShellEmptyState description="No replay timeline steps are available yet." />
                  )}
                </ShellSectionCard>

                <div className="space-y-4">
                  <ShellSectionCard
                    title="Participants"
                    contentClassName="space-y-3"
                  >
                    {replay.participants.length ? (
                      replay.participants.map((item, index) => (
                        <ShellRecordCard key={`${item.role}:${item.provider}:${index}`}>
                          <ShellRecordHeader
                            title={item.role}
                            description={item.provider}
                            accessory={
                              <ShellRecordAccessory
                                label="Tools"
                                value={String(item.tools.length)}
                                detail={item.tools.join(", ") || "no tools"}
                              />
                            }
                          />
                          <ShellRecordBody>
                            <ShellRecordMeta>
                              <span>{item.provider}</span>
                              <span>{item.tools.join(", ") || "no tools"}</span>
                            </ShellRecordMeta>
                          </ShellRecordBody>
                        </ShellRecordCard>
                      ))
                    ) : (
                      <ShellEmptyState description="No participants are visible for this replay." />
                    )}
                  </ShellSectionCard>

                  <ShellSectionCard
                    title="Protocol trace"
                  >
                    <ShellRecordCard>
                      <ShellRecordBody>
                        <ShellRecordSection title="Trace excerpt">
                          <pre className="max-h-[320px] overflow-auto text-xs leading-6 text-muted-foreground">
                            {JSON.stringify(replay.protocol_trace.slice(0, 12), null, 2)}
                          </pre>
                        </ShellRecordSection>
                      </ShellRecordBody>
                    </ShellRecordCard>
                  </ShellSectionCard>
                </div>
              </section>
            </>
          ) : loadState === "loading" ? (
            <ShellLoadingState description="Loading replay surface..." />
          ) : (
            <div className="flex min-h-[300px] items-center justify-center">
              <div className="text-center text-[13px] text-muted-foreground">
                Select an item to view details.
              </div>
            </div>
          )}

          <ShellLinkTileGrid
            className="md:grid-cols-2 xl:grid-cols-4"
            items={[
              {
                href: buildDiscoveryTracesScopeHref(routeScope),
                label: "Open trace coverage",
                icon: <GitBranch className="h-4 w-4 text-accent" />,
              },
              {
                href: reviewHref,
                label: "Open discovery review",
                icon: <GitBranch className="h-4 w-4 text-accent" />,
              },
              {
                href: buildDashboardScopeHref(routeScope),
                label: "Open scoped dashboard",
                icon: <PlayCircle className="h-4 w-4 text-accent" />,
              },
              {
                href: buildInboxScopeHref(routeScope),
                label: "Open scoped inbox",
                icon: <GitBranch className="h-4 w-4 text-accent" />,
              },
              {
                href: buildSettingsScopeHref(routeScope, {
                  discoverySessionId: activeSessionId || "",
                }),
                label: "Open scoped settings",
                icon: <PlayCircle className="h-4 w-4 text-accent" />,
              },
            ]}
          />
        </div>
      </section>
    </ShellPage>
  );
}
