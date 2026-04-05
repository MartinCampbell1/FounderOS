"use client";

import {
  compareDiscoveryRankingPair,
  swipeDiscoveryIdeaFromBoard,
  type DiscoveryMutationEffect,
} from "@/lib/discovery-mutations";
import {
  buildRememberedDiscoveryReviewScopeHref,
  resolveReviewMemoryBucket,
} from "@/lib/review-memory";
import type {
  QuorumDiscoveryIdea,
  QuorumDiscoverySwipeAction,
  QuorumIdeaQueueItem,
  QuorumNextPairResponse,
  QuorumRankedIdeaRecord,
  ShellPreferences,
} from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import {
  Activity,
  BrainCircuit,
  Radar,
  Sparkles,
  Swords,
  Telescope,
  Trophy,
} from "lucide-react";
import { useCallback, useMemo } from "react";

import {
  ShellRecordAccessory,
  ShellRecordActionBar,
  ShellRecordBody,
  ShellRecordCard,
  ShellRecordHeader,
  ShellRecordLinkButton,
  ShellRecordMeta,
  ShellRecordSection,
} from "@/components/shell/shell-record-primitives";
import {
  ShellActionStateLabel,
  ShellEmptyState,
  ShellFilterChipLink,
  ShellHero,
  ShellLinkTileGrid,
  ShellListLink,
  ShellPage,
  ShellPillButton,
  ShellRefreshButton,
  ShellSectionCard,
  ShellStatusBanner,
} from "@/components/shell/shell-screen-primitives";
import type { ShellDiscoveryBoardSnapshot } from "@/lib/discovery-board";
import { fetchShellDiscoveryBoardSnapshot } from "@/lib/shell-snapshot-client";
import {
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import {
  buildDashboardScopeHref,
  buildDiscoveryBoardArchiveScopeHref,
  buildDiscoveryBoardFinalsScopeHref,
  buildDiscoveryBoardRankingScopeHref,
  buildDiscoveryBoardSimulationIdeaScopeHref,
  buildDiscoveryBoardSimulationsScopeHref,
  buildDiscoveryBoardScopeHref,
  buildDiscoveryIdeaScopeHref,
  buildDiscoveryIdeasScopeHref,
  buildDiscoveryReplayScopeHref,
  buildDiscoveryTracesScopeHref,
  buildDiscoveryScopeHref,
  buildInboxScopeHref,
  buildPortfolioScopeHref,
  buildSettingsScopeHref,
  type ShellRouteScope,
} from "@/lib/route-scope";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";
import { useShellRouteMutationRunner } from "@/lib/use-shell-route-mutation-runner";
import { useShellSnapshotRefreshNonce } from "@/lib/use-shell-snapshot-refresh-nonce";

type DiscoveryBoardRouteScope = ShellRouteScope;

const EMPTY_DISCOVERY_BOARD_SNAPSHOT: ShellDiscoveryBoardSnapshot = {
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

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDate(value?: string | null) {
  if (!value) return "n/a";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function stageTone(stage: string) {
  if (stage === "executed") return "success" as const;
  if (stage === "handed_off") return "info" as const;
  if (stage === "simulated" || stage === "debated") return "warning" as const;
  return "neutral" as const;
}

function swipeTone(action: string) {
  if (action === "now") return "success" as const;
  if (action === "yes") return "info" as const;
  if (action === "maybe") return "warning" as const;
  if (action === "pass") return "neutral" as const;
  return "neutral" as const;
}

function simulationTone(state: string) {
  if (state === "complete" || state === "market_complete") return "success" as const;
  if (state === "running" || state === "queued") return "warning" as const;
  if (state === "failed") return "danger" as const;
  return "neutral" as const;
}

function scorecardTone(value: number) {
  if (value >= 0.7) return "success" as const;
  if (value >= 0.45) return "warning" as const;
  return "danger" as const;
}


function RankRow({
  item,
  routeScope,
}: {
  item: QuorumRankedIdeaRecord;
  routeScope: DiscoveryBoardRouteScope;
}) {
  return (
    <ShellListLink
      href={buildDiscoveryIdeaScopeHref(item.idea.idea_id, routeScope)}
      className="grid gap-3 lg:grid-cols-[64px_minmax(0,1.4fr)_120px_120px_130px]"
    >
      <div className="flex items-center">
        <div className="rounded-full border border-border/80 bg-card/70 px-3 py-1 text-[11px] font-semibold tracking-[0.04em] text-foreground">
          #{item.rank_position}
        </div>
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-foreground">{item.idea.title}</div>
        <div className="mt-1 truncate text-xs leading-6 text-muted-foreground">
          {item.idea.summary || item.idea.thesis || item.idea.description || item.idea.source}
        </div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Rating
        </div>
        <div className="mt-1 text-sm font-semibold text-foreground">
          {item.rating.toFixed(1)}
        </div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Merit
        </div>
        <div className="mt-1 text-sm font-semibold text-foreground">
          {percent(item.merit_score)}
        </div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Stability
        </div>
        <div className="mt-1 text-sm font-semibold text-foreground">
          {percent(item.stability_score)}
        </div>
      </div>
    </ShellListLink>
  );
}

function QueueRow({
  item,
  routeScope,
  busyActionKey,
  onSwipe,
}: {
  item: QuorumIdeaQueueItem;
  routeScope: DiscoveryBoardRouteScope;
  busyActionKey: string;
  onSwipe: (ideaId: string, action: QuorumDiscoverySwipeAction) => void;
}) {
  const actions: QuorumDiscoverySwipeAction[] = ["pass", "maybe", "yes", "now"];

  return (
    <ShellRecordCard>
      <ShellRecordHeader
        badges={
          <>
            <Badge tone={stageTone(item.idea.latest_stage)}>{item.idea.latest_stage}</Badge>
            <Badge tone={swipeTone(item.idea.swipe_state)}>{item.idea.swipe_state}</Badge>
          </>
        }
        title={item.idea.title}
        description={item.explanation.headline}
        accessory={
          <ShellRecordAccessory
            label="Queue score"
            value={`rank ${item.idea.rank_score.toFixed(2)}`}
            detail={item.idea.source}
          />
        }
      />
      <ShellRecordBody>
        <ShellRecordMeta>
          <span>{item.idea.idea_id}</span>
          <span>belief {item.idea.belief_score.toFixed(2)}</span>
          <span>{formatDate(item.idea.updated_at)}</span>
        </ShellRecordMeta>
        <ShellRecordSection title="Why this moved">
          <div className="text-[13px] leading-6 text-muted-foreground">
            {item.explanation.change_summary[0] ||
              item.explanation.source_signals[0] ||
              "No change summary available yet."}
          </div>
        </ShellRecordSection>
        {item.idea.topic_tags.length ? (
          <ShellRecordSection title="Signals">
            <div className="flex flex-wrap gap-2">
              {item.idea.topic_tags.slice(0, 4).map((tag) => (
                <Badge key={tag} tone="neutral">
                  {tag}
                </Badge>
              ))}
            </div>
          </ShellRecordSection>
        ) : null}
        <ShellRecordActionBar>
          <ShellRecordLinkButton
            href={buildDiscoveryIdeaScopeHref(item.idea.idea_id, routeScope)}
            label="Open dossier"
          />
          <ShellRecordLinkButton
            href={buildDiscoveryBoardSimulationIdeaScopeHref(item.idea.idea_id, routeScope)}
            label="Open simulation"
          />
        </ShellRecordActionBar>
        <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const isBusy = busyActionKey === `swipe:${item.idea.idea_id}:${action}`;
          return (
            <ShellPillButton
              key={action}
              type="button"
              tone={action === "now" ? "primary" : "outline"}
              disabled={Boolean(busyActionKey)}
              onClick={() => onSwipe(item.idea.idea_id, action)}
            >
              <ShellActionStateLabel
                busy={isBusy}
                idleLabel={action}
                busyLabel={action}
                spinnerClassName="h-3.5 w-3.5 animate-spin"
              />
            </ShellPillButton>
          );
        })}
        </div>
      </ShellRecordBody>
    </ShellRecordCard>
  );
}

function SimulationIdeaRow({
  idea,
  routeScope,
}: {
  idea: QuorumDiscoveryIdea;
  routeScope: DiscoveryBoardRouteScope;
}) {
  return (
    <ShellRecordCard>
      <ShellRecordHeader
        badges={
          <>
            <Badge tone={stageTone(idea.latest_stage)}>{idea.latest_stage}</Badge>
            <Badge tone={simulationTone(idea.simulation_state)}>{idea.simulation_state}</Badge>
          </>
        }
        title={idea.title}
        description={idea.summary || idea.thesis || idea.description}
        accessory={
          <ShellRecordAccessory
            label="Rank"
            value={idea.rank_score.toFixed(2)}
            detail={`belief ${idea.belief_score.toFixed(2)}`}
          />
        }
      />
      <ShellRecordBody>
        <ShellRecordMeta>
          <span>{idea.idea_id}</span>
          <span>{idea.source}</span>
          <span>{formatDate(idea.updated_at)}</span>
        </ShellRecordMeta>
        {idea.topic_tags.length ? (
          <ShellRecordSection title="Signals">
            <div className="flex flex-wrap gap-2">
              {idea.topic_tags.slice(0, 4).map((tag) => (
                <Badge key={tag} tone="neutral">
                  {tag}
                </Badge>
              ))}
            </div>
          </ShellRecordSection>
        ) : null}
        <ShellRecordActionBar>
          <ShellRecordLinkButton
            href={buildDiscoveryIdeaScopeHref(idea.idea_id, routeScope)}
            label="Open dossier"
          />
          <ShellRecordLinkButton
            href={buildDiscoveryBoardSimulationIdeaScopeHref(idea.idea_id, routeScope)}
            label="Inspect simulation"
          />
        </ShellRecordActionBar>
      </ShellRecordBody>
    </ShellRecordCard>
  );
}

function NextPairCard({
  nextPair,
  routeScope,
  busyActionKey,
  onCompare,
}: {
  nextPair: QuorumNextPairResponse | null;
  routeScope: DiscoveryBoardRouteScope;
  busyActionKey: string;
  onCompare: (verdict: "left" | "right" | "tie") => void;
}) {
  if (!nextPair) {
    return (
      <ShellSectionCard
        title="Next pair"
        contentClassName="py-2"
      >
        <BoardEmptyState message="Ranking queue has no suggested next pair yet." />
      </ShellSectionCard>
    );
  }

  return (
    <ShellSectionCard
      title="Next pair"
      contentClassName="space-y-4"
    >
        <ShellRecordSection title="Pair rationale">
          <div className="text-[13px] leading-6 text-muted-foreground">{nextPair.reason}</div>
        </ShellRecordSection>
        <div className="grid gap-4 xl:grid-cols-2">
          {[nextPair.left, nextPair.right].map((item, index) => (
            <ShellRecordCard
              key={`${item.idea.idea_id}:${index}`}
              className="shadow-none"
            >
              <ShellRecordHeader
                badges={<Badge tone={stageTone(item.idea.latest_stage)}>{item.idea.latest_stage}</Badge>}
                title={item.idea.title}
                description={item.idea.summary || item.idea.thesis || item.idea.description}
                accessory={
                  <ShellRecordAccessory
                    label="Position"
                    value={`#${item.rank_position}`}
                    detail={`${percent(item.stability_score)} stable`}
                  />
                }
              />
              <ShellRecordBody>
                <ShellRecordMeta>
                  <span>{item.idea.idea_id}</span>
                  <span>{item.idea.source}</span>
                  <span>{percent(item.merit_score)} merit</span>
                </ShellRecordMeta>
                {item.idea.topic_tags.length ? (
                  <ShellRecordSection title="Signals">
                    <div className="flex flex-wrap gap-2">
                      {item.idea.topic_tags.slice(0, 4).map((tag) => (
                        <Badge key={tag} tone="neutral">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </ShellRecordSection>
                ) : null}
                <ShellRecordActionBar>
                  <ShellRecordLinkButton
                    href={buildDiscoveryIdeaScopeHref(item.idea.idea_id, routeScope)}
                    label="Open dossier"
                  />
                </ShellRecordActionBar>
              </ShellRecordBody>
            </ShellRecordCard>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <ShellPillButton
            type="button"
            tone="primary"
            disabled={Boolean(busyActionKey)}
            onClick={() => onCompare("left")}
          >
            <ShellActionStateLabel
              busy={busyActionKey === "compare:left"}
              idleLabel="Left wins"
              busyLabel="Left wins"
              spinnerClassName="h-3.5 w-3.5 animate-spin"
            />
          </ShellPillButton>
          <ShellPillButton
            type="button"
            tone="primary"
            disabled={Boolean(busyActionKey)}
            onClick={() => onCompare("tie")}
          >
            <ShellActionStateLabel
              busy={busyActionKey === "compare:tie"}
              idleLabel="Tie"
              busyLabel="Tie"
              spinnerClassName="h-3.5 w-3.5 animate-spin"
            />
          </ShellPillButton>
          <ShellPillButton
            type="button"
            tone="primary"
            disabled={Boolean(busyActionKey)}
            onClick={() => onCompare("right")}
          >
            <ShellActionStateLabel
              busy={busyActionKey === "compare:right"}
              idleLabel="Right wins"
              busyLabel="Right wins"
              spinnerClassName="h-3.5 w-3.5 animate-spin"
            />
          </ShellPillButton>
        </div>
    </ShellSectionCard>
  );
}

function BoardEmptyState({
  message,
}: {
  message: string;
}) {
  return <ShellEmptyState description={message} />;
}

export function DiscoveryBoardWorkspace({
  initialPreferences,
  initialSnapshot,
  routeScope = { projectId: "", intakeSessionId: "" },
}: {
  initialPreferences?: ShellPreferences;
  initialSnapshot?: ShellDiscoveryBoardSnapshot | null;
  routeScope?: DiscoveryBoardRouteScope;
}) {
  const { preferences } = useShellPreferences(initialPreferences);
  const {
    busyActionKey,
    errorMessage,
    refreshClient,
    refreshNonce,
    runMutation,
    statusMessage,
  } = useShellRouteMutationRunner<DiscoveryMutationEffect>({
    planes: ["discovery"],
    scope: routeScope,
    source: "discovery-board",
    reason: "discovery-board-mutation",
  }, {
    fallbackErrorMessage: "Discovery board action failed.",
  });
  const snapshotRefreshNonce = useShellSnapshotRefreshNonce({
    baseRefreshNonce: refreshNonce,
    invalidation: {
      planes: ["discovery"],
      scope: routeScope,
    },
    invalidationOptions: {
      ignoreSources: ["discovery-board"],
      since: initialSnapshot?.generatedAt ?? null,
    },
  });
  const pollInterval = getShellPollInterval(
    "discovery_board",
    preferences.refreshProfile
  );
  const loadSnapshot = useCallback(
    () => fetchShellDiscoveryBoardSnapshot(),
    []
  );
  const { snapshot } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_DISCOVERY_BOARD_SNAPSHOT,
    initialSnapshot,
    refreshNonce: snapshotRefreshNonce,
    pollIntervalMs: pollInterval,
    loadSnapshot,
    selectLoadState: (nextSnapshot) => nextSnapshot.loadState,
  });

  const settingsTargetIdeaId = useMemo(
    () =>
      snapshot.nextPair?.left.idea.idea_id ||
      snapshot.leaderboard?.items[0]?.idea.idea_id ||
      snapshot.swipeQueue?.items[0]?.idea.idea_id ||
      snapshot.simulationIdeas[0]?.idea_id ||
      "",
    [
      snapshot.leaderboard,
      snapshot.nextPair,
      snapshot.simulationIdeas,
      snapshot.swipeQueue,
    ]
  );

  const handleCompare = useCallback(
    (verdict: "left" | "right" | "tie") => {
      const nextPair = snapshot.nextPair;
      if (!nextPair) {
        return;
      }

      void runMutation(`compare:${verdict}`, () =>
        compareDiscoveryRankingPair({
          leftIdeaId: nextPair.left.idea.idea_id,
          rightIdeaId: nextPair.right.idea.idea_id,
          verdict,
          routeScope,
          source: "discovery-board",
        })
      );
    },
    [routeScope, runMutation, snapshot.nextPair]
  );

  const handleSwipe = useCallback(
    (ideaId: string, action: QuorumDiscoverySwipeAction) => {
      void runMutation(`swipe:${ideaId}:${action}`, () =>
        swipeDiscoveryIdeaFromBoard({
          ideaId,
          action,
          routeScope,
          source: "discovery-board",
        })
      );
    },
    [routeScope, runMutation]
  );

  const errors = [
    ...snapshot.errors,
    errorMessage ?? "",
  ].filter(Boolean);

  return (
    <ShellPage className="max-w-[1600px]">
      <ShellHero
        eyebrow={<Badge tone="info">FounderOS board</Badge>}
        title="Ranking, swipe, and simulation now sit inside the unified shell."
        meta={
          <>
            <span>{snapshot.scoreboard?.idea_count ?? 0} ideas observed</span>
            <span>{snapshot.leaderboard?.metrics.comparisons_count ?? 0} comparisons</span>
            <span>{snapshot.swipeQueue?.summary.active_count ?? 0} triage items</span>
            <span>{snapshot.simulationIdeas.length} simulation candidates</span>
            <span>{formatDate(snapshot.generatedAt)}</span>
          </>
        }
        actions={
          <>
            <ShellRefreshButton type="button" onClick={() => refreshClient()} compact />
            <ShellFilterChipLink href={buildDiscoveryScopeHref(routeScope)} label="Sessions" />
            <ShellFilterChipLink href={buildDiscoveryIdeasScopeHref(routeScope)} label="Ideas" />
            <ShellFilterChipLink
              href={buildDiscoveryBoardRankingScopeHref(routeScope)}
              label="Ranking"
            />
            <ShellFilterChipLink
              href={buildDiscoveryBoardArchiveScopeHref(routeScope)}
              label="Archive"
            />
            <ShellFilterChipLink
              href={buildDiscoveryBoardFinalsScopeHref(routeScope)}
              label="Finals"
            />
            <ShellFilterChipLink
              href={buildDiscoveryBoardSimulationsScopeHref(routeScope)}
              label="Simulations"
            />
            <ShellFilterChipLink href={buildDiscoveryTracesScopeHref(routeScope)} label="Traces" />
            <ShellFilterChipLink
              href={buildDiscoveryReplayScopeHref(undefined, routeScope)}
              label="Replays"
            />
            <ShellFilterChipLink
              href={buildRememberedDiscoveryReviewScopeHref({
                scope: routeScope,
                preferences,
                bucket: resolveReviewMemoryBucket({ scope: routeScope }),
              })}
              label="Review"
            />
          </>
        }
        aside={
          <div className="space-y-2.5">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Current pulse
            </div>
            <div className="text-sm text-foreground">
              {snapshot.nextPair
                ? `${snapshot.nextPair.left.idea.title} vs ${snapshot.nextPair.right.idea.title}`
                : "Ranking queue is waiting for the next strong comparison."}
            </div>
            <div className="text-[12px] leading-6 text-muted-foreground">
              Board routes keep ranking, swipe, and simulation decisions in one operator loop with scoped returns across review, dashboard, and settings.
            </div>
          </div>
        }
      />

      {statusMessage ? (
        <ShellStatusBanner tone="success">{statusMessage}</ShellStatusBanner>
      ) : null}

      {errors.length > 0 ? (
        <ShellStatusBanner tone="warning">{errors.join(" ")}</ShellStatusBanner>
      ) : null}


      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <div className="grid gap-4">
          <NextPairCard
            nextPair={snapshot.nextPair}
            routeScope={routeScope}
            busyActionKey={busyActionKey}
            onCompare={handleCompare}
          />

          <ShellSectionCard
            title="Ranking board"
            contentClassName="space-y-3"
          >
            {snapshot.leaderboard?.items.length ? (
              snapshot.leaderboard.items.slice(0, 6).map((item) => (
                <RankRow
                  key={item.idea.idea_id}
                  item={item}
                  routeScope={routeScope}
                />
              ))
            ) : (
              <BoardEmptyState message="Ranking leaderboard is not available yet." />
            )}
          </ShellSectionCard>

          <ShellSectionCard
            title="Observability watchlist"
            contentClassName="grid gap-4 xl:grid-cols-2"
          >
            <div className="space-y-3">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Strongest ideas
              </div>
              {snapshot.scoreboard?.strongest_ideas.length ? (
                snapshot.scoreboard.strongest_ideas.slice(0, 4).map((item) => (
                  <ShellListLink
                    key={item.idea_id}
                    href={buildDiscoveryIdeaScopeHref(item.idea_id, routeScope)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-foreground">{item.title}</div>
                      <Badge tone={scorecardTone(item.overall_health)}>
                        {percent(item.overall_health)}
                      </Badge>
                    </div>
                  </ShellListLink>
                ))
              ) : (
                <BoardEmptyState message="No strongest ideas are visible yet." />
              )}
            </div>
            <div className="space-y-3">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Watchlist
              </div>
              {snapshot.scoreboard?.weakest_ideas.length ? (
                snapshot.scoreboard.weakest_ideas.slice(0, 4).map((item) => (
                  <ShellListLink
                    key={item.idea_id}
                    href={buildDiscoveryIdeaScopeHref(item.idea_id, routeScope)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-foreground">{item.title}</div>
                      <Badge tone={scorecardTone(item.overall_health)}>
                        {percent(item.overall_health)}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs leading-6 text-muted-foreground">
                      {item.flags.slice(0, 2).join(" · ") || "No flags recorded."}
                    </div>
                  </ShellListLink>
                ))
              ) : (
                <BoardEmptyState message="No watchlist ideas are visible yet." />
              )}
            </div>
          </ShellSectionCard>
        </div>

        <div className="grid gap-4">
          <ShellSectionCard
            title="Swipe queue"
            contentClassName="space-y-3"
          >
            {snapshot.swipeQueue?.items.length ? (
              snapshot.swipeQueue.items.slice(0, 4).map((item) => (
                <QueueRow
                  key={item.queue_id}
                  item={item}
                  routeScope={routeScope}
                  busyActionKey={busyActionKey}
                  onSwipe={handleSwipe}
                />
              ))
            ) : (
              <BoardEmptyState message="Swipe queue is empty right now." />
            )}
          </ShellSectionCard>

          <ShellSectionCard
            title="Founder preference model"
            contentClassName="space-y-3"
          >
            <ShellRecordSection title="Strong domains" className="bg-background/70">
              <div className="text-sm leading-7 text-foreground">
                {Object.entries(
                  snapshot.swipeQueue?.preference_profile.domain_weights ?? {}
                )
                  .sort((left, right) => right[1] - left[1])
                  .slice(0, 3)
                  .map(([label]) => label)
                  .join(", ") || "Neutral"}
              </div>
            </ShellRecordSection>
          </ShellSectionCard>

          <ShellSectionCard
            title="Simulation lane"
            contentClassName="space-y-3"
          >
            {snapshot.simulationIdeas.length ? (
              snapshot.simulationIdeas.map((idea) => (
                <SimulationIdeaRow
                  key={idea.idea_id}
                  idea={idea}
                  routeScope={routeScope}
                />
              ))
            ) : (
              <BoardEmptyState message="No simulation candidates are visible yet." />
            )}
          </ShellSectionCard>
        </div>
      </section>

      <ShellLinkTileGrid
        className="md:grid-cols-3 xl:grid-cols-6"
        items={[
          {
            href: buildDiscoveryBoardRankingScopeHref(routeScope),
            label: "Open ranking detail",
            icon: <Trophy className="h-4 w-4 text-accent" />,
          },
          {
            href: buildDiscoveryBoardArchiveScopeHref(routeScope),
            label: "Open archive frontier",
            icon: <Telescope className="h-4 w-4 text-accent" />,
          },
          {
            href: buildDiscoveryBoardFinalsScopeHref(routeScope),
            label: "Open finals route",
            icon: <Sparkles className="h-4 w-4 text-accent" />,
          },
          {
            href: snapshot.simulationIdeas[0]
              ? buildDiscoveryBoardSimulationIdeaScopeHref(
                  snapshot.simulationIdeas[0].idea_id,
                  routeScope
                )
              : buildDiscoveryBoardSimulationsScopeHref(routeScope),
            label: "Open simulation review",
            icon: <BrainCircuit className="h-4 w-4 text-accent" />,
          },
          {
            href: buildDiscoveryTracesScopeHref(routeScope),
            label: "Open trace coverage",
            icon: <Radar className="h-4 w-4 text-accent" />,
          },
          {
            href: buildDiscoveryReplayScopeHref(undefined, routeScope),
            label: "Open replay routes",
            icon: <Swords className="h-4 w-4 text-accent" />,
          },
          {
            href: buildRememberedDiscoveryReviewScopeHref({
              scope: routeScope,
              preferences,
              bucket: resolveReviewMemoryBucket({ scope: routeScope }),
            }),
            label: "Open discovery review",
            icon: <Radar className="h-4 w-4 text-accent" />,
          },
          {
            href: buildDashboardScopeHref(routeScope),
            label: "Open scoped dashboard",
            icon: <Activity className="h-4 w-4 text-accent" />,
          },
          {
            href: buildInboxScopeHref(routeScope),
            label: "Open scoped inbox",
            icon: <Telescope className="h-4 w-4 text-accent" />,
          },
          {
            href: buildPortfolioScopeHref(routeScope),
            label: "Open scoped portfolio",
            icon: <Radar className="h-4 w-4 text-accent" />,
          },
          {
            href: buildSettingsScopeHref(routeScope, {
              discoveryIdeaId: settingsTargetIdeaId,
            }),
            label: "Open scoped settings",
            icon: <Activity className="h-4 w-4 text-accent" />,
          },
        ]}
      />
    </ShellPage>
  );
}
