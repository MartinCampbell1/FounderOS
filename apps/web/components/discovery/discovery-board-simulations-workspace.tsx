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
  ShellEmptyState,
  ShellHero,
  ShellPage,
  ShellPillButton,
  ShellStatusBanner,
} from "@/components/shell/shell-screen-primitives";
import type { ShellDiscoveryBoardSnapshot } from "@/lib/discovery-board";
import { fetchShellDiscoveryBoardSnapshot } from "@/lib/shell-snapshot-client";
import {
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import { type ShellRouteScope } from "@/lib/route-scope";
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
    <div className="flex flex-col gap-6">
      <div className="text-center text-[12px] text-muted-foreground">
        {index + 1} of {total} ideas
      </div>

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="space-y-4">
          <div className="text-[18px] font-medium leading-snug text-foreground">
            {idea.title}
          </div>

          {truncatedThesis ? (
            <p className="text-[14px] leading-6 text-muted-foreground">
              {truncatedThesis}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
            <span>Score: {idea.rank_score.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            <span>·</span>
            <span>Stage: {idea.latest_stage}</span>
            <span>·</span>
            <span>Belief: {idea.belief_score.toFixed(2)}</span>
            <span>·</span>
            <span>Updated: {formatRelativeTime(idea.updated_at)}</span>
          </div>

          <div className="grid grid-cols-4 gap-2 pt-2">
            {actions.map(({ action, label, className: actionClassName }) => {
              const isBusy = busyActionKey === `swipe:${idea.idea_id}:${action}`;
              return (
                <button
                  key={action}
                  type="button"
                  disabled={Boolean(busyActionKey)}
                  onClick={() => onSwipe(idea.idea_id, action)}
                  className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${actionClassName}`}
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
      </div>
    </div>
  );
}

export function DiscoveryBoardSimulationsWorkspace({
  activeIdeaId: _activeIdeaId,
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

  const { snapshot } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_DISCOVERY_BOARD_SNAPSHOT,
    initialSnapshot: initialSnapshot ?? undefined,
    refreshNonce: snapshotRefreshNonce,
    pollIntervalMs: pollInterval,
    loadSnapshot,
    selectLoadState: (nextSnapshot) => nextSnapshot.loadState,
  });

  // Local dismissed set — swipes remove items from view immediately
  const [dismissedIds, setDismissedIds] = useState<ReadonlySet<string>>(
    new Set()
  );

  const allItems = snapshot.swipeQueue?.items ?? [];
  const visibleItems = allItems.filter(
    (item) => !dismissedIds.has(item.idea.idea_id)
  );
  const currentItem = visibleItems[0] ?? null;
  const currentIndex = allItems.length - visibleItems.length;
  const totalCount = allItems.length;

  const handleSwipe = useCallback(
    (ideaId: string, action: QuorumDiscoverySwipeAction) => {
      // Optimistically remove from view
      setDismissedIds((prev) => new Set([...prev, ideaId]));

      void runMutation(`swipe:${ideaId}:${action}`, () =>
        swipeDiscoveryIdeaFromBoard({
          ideaId,
          action,
          routeScope,
          source: "discovery-board-simulations",
        })
      );
    },
    [routeScope, runMutation]
  );

  const errors = [...snapshot.errors, errorMessage ?? ""].filter(Boolean);

  return (
    <ShellPage className="max-w-[800px] mx-auto">
      <ShellHero
        title="Swipe Queue"
        description="Evaluate ideas one at a time. Swipe to triage your discovery queue."
        actions={
          <ShellPillButton
            type="button"
            tone="outline"
            compact
            onClick={() => refreshClient()}
          >
            Refresh
          </ShellPillButton>
        }
      />

      {statusMessage ? (
        <ShellStatusBanner tone="success">{statusMessage}</ShellStatusBanner>
      ) : null}

      {errors.length > 0 ? (
        <ShellStatusBanner tone="warning">{errors.join(" ")}</ShellStatusBanner>
      ) : null}

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
