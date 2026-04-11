"use client";

import {
  swipeDiscoveryIdeaFromBoard,
  type DiscoveryMutationEffect,
} from "@/lib/discovery-mutations";
import type {
  QuorumDiscoverySwipeAction,
  QuorumIdeaQueueItem,
  ShellPreferences,
} from "@founderos/api-clients";
import { useCallback, useState } from "react";

import {
  ShellActionStateLabel,
  ShellActionLink,
  ShellEmptyState,
  ShellPage,
  ShellPillButton,
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
  buildDiscoveryIdeaScopeHref,
  buildSettingsScopeHref,
  type ShellRouteScope,
} from "@/lib/route-scope";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";
import { useShellRouteMutationRunner } from "@/lib/use-shell-route-mutation-runner";
import { useShellSnapshotRefreshNonce } from "@/lib/use-shell-snapshot-refresh-nonce";

type DiscoveryBoardSimulationsRouteScope = ShellRouteScope;

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

function formatRelativeTime(value?: string | null): string {
  if (!value) return "n/a";
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.round(diffHours / 24)}d ago`;
}

function SwipeCard({
  item,
  index,
  total,
  busyActionKey,
  onSwipe,
}: {
  item: QuorumIdeaQueueItem;
  index: number;
  total: number;
  busyActionKey: string;
  onSwipe: (ideaId: string, action: QuorumDiscoverySwipeAction) => void;
}) {
  const idea = item.idea;
  const thesis = idea.summary || idea.thesis || idea.description || "";
  const truncatedThesis =
    thesis.length > 240 ? thesis.slice(0, 240).trimEnd() + "…" : thesis;

  const actions: {
    action: QuorumDiscoverySwipeAction;
    label: string;
    className: string;
  }[] = [
    {
      action: "pass",
      label: "Pass",
      className:
        "border border-border bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
    },
    {
      action: "maybe",
      label: "Maybe",
      className:
        "border border-amber-400/60 bg-amber-50/10 text-amber-500 hover:bg-amber-50/20 dark:border-amber-500/40 dark:text-amber-400",
    },
    {
      action: "yes",
      label: "Yes",
      className:
        "border border-green-500/60 bg-green-50/10 text-green-600 hover:bg-green-50/20 dark:border-green-500/40 dark:text-green-400",
    },
    {
      action: "now",
      label: "Now",
      className:
        "border border-indigo-500/60 bg-indigo-50/10 text-indigo-600 hover:bg-indigo-50/20 dark:border-indigo-500/40 dark:text-indigo-400",
    },
  ];

  return (
    <ShellSectionCard
      title="Simulation target"
      description={`Idea ${index + 1} of ${total}`}
      contentClassName="space-y-4 pt-0"
    >
      <div className="rounded-[10px] border border-border/70 bg-card/80 p-4 shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="text-[18px] font-medium leading-snug text-foreground">
              {idea.title}
            </div>
            {truncatedThesis ? (
              <p className="max-w-[68ch] text-[14px] leading-6 text-muted-foreground">
                {truncatedThesis}
              </p>
            ) : null}
          </div>
          <span className="shrink-0 rounded-full border border-border/70 bg-muted/30 px-2.5 py-1 text-[12px] font-medium tabular-nums text-muted-foreground">
            #{index + 1}/{total}
          </span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [
              "Score",
              idea.rank_score.toLocaleString(undefined, { maximumFractionDigits: 0 }),
            ],
            ["Stage", idea.latest_stage],
            ["Belief", idea.belief_score.toFixed(2)],
            ["Updated", formatRelativeTime(idea.updated_at)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-md border border-border/70 bg-muted/20 px-3 py-2"
            >
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {label}
              </div>
              <div className="mt-1 text-[13px] font-medium text-foreground">
                {value}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {actions.map(({ action, label, className: actionClassName }) => {
            const isBusy = busyActionKey === `swipe:${idea.idea_id}:${action}`;
            return (
              <button
                key={action}
                type="button"
                disabled={Boolean(busyActionKey)}
                onClick={() => onSwipe(idea.idea_id, action)}
                className={`flex items-center justify-center gap-1.5 rounded-[8px] px-3 py-2 text-[12px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${actionClassName}`}
              >
                <ShellActionStateLabel
                  busy={isBusy}
                  idleLabel={label}
                  busyLabel={label}
                  spinnerClassName="h-3.5 w-3.5 animate-spin"
                />
              </button>
            );
          })}
        </div>
      </div>
    </ShellSectionCard>
  );
}

export function DiscoveryBoardSimulationsWorkspace({
  activeIdeaId,
  initialPreferences,
  initialSnapshot,
  routeScope = { projectId: "", intakeSessionId: "" },
}: {
  activeIdeaId: string | null;
  initialPreferences?: ShellPreferences;
  initialSnapshot?: ShellDiscoveryBoardSnapshot | null;
  routeScope?: DiscoveryBoardSimulationsRouteScope;
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
    source: "discovery-board-simulations",
    reason: "discovery-board-simulations-swipe",
  }, {
    fallbackErrorMessage: "Swipe action failed.",
  });

  const snapshotRefreshNonce = useShellSnapshotRefreshNonce({
    baseRefreshNonce: refreshNonce,
    invalidation: {
      planes: ["discovery"],
      scope: routeScope,
    },
    invalidationOptions: {
      ignoreSources: ["discovery-board-simulations"],
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

  const selectLoadState = useCallback(
    (nextSnapshot: ShellDiscoveryBoardSnapshot) => nextSnapshot.loadState,
    []
  );
  const { snapshot } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_DISCOVERY_BOARD_SNAPSHOT,
    initialSnapshot: initialSnapshot ?? undefined,
    refreshNonce: snapshotRefreshNonce,
    pollIntervalMs: pollInterval,
    loadSnapshot,
    selectLoadState,
  });

  // Local dismissed set — swipes remove items from view immediately
  const [dismissedIds, setDismissedIds] = useState<ReadonlySet<string>>(
    new Set()
  );

  const allItems = snapshot.swipeQueue?.items ?? [];
  const visibleItems = allItems.filter(
    (item) => !dismissedIds.has(item.idea.idea_id)
  );
  const prioritizedItems = activeIdeaId
    ? [
        ...visibleItems.filter((item) => item.idea.idea_id === activeIdeaId),
        ...visibleItems.filter((item) => item.idea.idea_id !== activeIdeaId),
      ]
    : visibleItems;
  const currentItem = prioritizedItems[0] ?? null;
  const currentIndex = currentItem
    ? Math.max(
        0,
        allItems.findIndex((item) => item.idea.idea_id === currentItem.idea.idea_id)
      )
    : 0;
  const totalCount = allItems.length;
  const requestedIdeaMissing = Boolean(activeIdeaId) && !currentItem;
  const effectiveIdeaId = activeIdeaId || currentItem?.idea.idea_id || "";
  const settingsHref = buildSettingsScopeHref(routeScope, {
    discoveryIdeaId: effectiveIdeaId,
  });
  const dossierHref = effectiveIdeaId
    ? buildDiscoveryIdeaScopeHref(effectiveIdeaId, routeScope)
    : null;

  function handleSwipe(ideaId: string, action: QuorumDiscoverySwipeAction) {
    // Optimistically remove from view.
    setDismissedIds((prev) => new Set([...prev, ideaId]));

    void runMutation(`swipe:${ideaId}:${action}`, () =>
      swipeDiscoveryIdeaFromBoard({
        ideaId,
        action,
        routeScope,
        source: "discovery-board-simulations",
      })
    );
  }

  const errors = [...snapshot.errors, errorMessage ?? ""].filter(Boolean);
  const visibleCount = visibleItems.length;
  const dismissedCount = totalCount - visibleCount;

  return (
    <ShellPage className="mx-auto max-w-[800px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ShellActionLink href={settingsHref} label="Open scoped settings" />
          {dossierHref ? (
            <ShellActionLink href={dossierHref} label="Open dossier" />
          ) : null}
        </div>
        <ShellPillButton
          type="button"
          tone="outline"
          compact
          onClick={() => refreshClient()}
        >
          Refresh
        </ShellPillButton>
      </div>

      {statusMessage ? (
        <ShellStatusBanner tone="success">{statusMessage}</ShellStatusBanner>
      ) : null}

      {requestedIdeaMissing ? (
        <ShellStatusBanner tone="info">
          Requested simulation target {activeIdeaId} is not currently present in the swipe queue, so the page is holding scope and parity links while the queue refreshes.
        </ShellStatusBanner>
      ) : null}

      {errors.length > 0 ? (
        <ShellStatusBanner tone="warning">{errors.join(" ")}</ShellStatusBanner>
      ) : null}

      <ShellSectionCard
        title="Queue context"
        description="Keep the active simulation target pinned while the swipe queue refreshes."
        contentClassName="space-y-3 pt-0"
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [
              "Visible",
              `${visibleCount.toLocaleString()}/${totalCount.toLocaleString()}`,
              "Ideas left in the swipe queue.",
            ],
            [
              "Active target",
              activeIdeaId || currentItem?.idea.idea_id || "n/a",
              "Pinned idea for this simulation pass.",
            ],
            [
              "Dismissed",
              dismissedCount.toLocaleString(),
              "Optimistically hidden from view.",
            ],
            [
              "Refreshed",
              formatRelativeTime(snapshot.generatedAt),
              currentItem ? currentItem.idea.latest_stage : "Waiting for a target.",
            ],
          ].map(([label, value, detail]) => (
            <div
              key={label}
              className="rounded-md border border-border/70 bg-muted/20 px-3 py-2"
            >
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {label}
              </div>
              <div className="mt-1 truncate text-[13px] font-medium text-foreground">
                {value}
              </div>
              <div className="mt-1 text-[12px] leading-5 text-muted-foreground">
                {detail}
              </div>
            </div>
          ))}
        </div>
      </ShellSectionCard>

      {currentItem ? (
        <SwipeCard
          item={currentItem}
          index={currentIndex}
          total={totalCount}
          busyActionKey={busyActionKey ?? ""}
          onSwipe={handleSwipe}
        />
      ) : (
        <ShellEmptyState
          centered
          description="No ideas in the swipe queue. Run a discovery session to generate ideas."
        />
      )}
    </ShellPage>
  );
}
