"use client";

import {
  compareDiscoveryRankingPair,
  swipeDiscoveryIdeaFromBoard,
  type DiscoveryMutationEffect,
} from "@/lib/discovery-mutations";
import type {
  QuorumDiscoveryIdea,
  QuorumDiscoverySwipeAction,
  ShellPreferences,
} from "@founderos/api-clients";
import Link from "next/link";
import { useCallback, useMemo } from "react";

import {
  ShellFilterChipLink,
  ShellPage,
  ShellRefreshButton,
} from "@/components/shell/shell-screen-primitives";
import type { ShellDiscoveryBoardSnapshot } from "@/lib/discovery-board";
import { fetchShellDiscoveryBoardSnapshot } from "@/lib/shell-snapshot-client";
import {
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import {
  buildDiscoveryBoardArchiveScopeHref,
  buildDiscoveryBoardFinalsScopeHref,
  buildDiscoveryBoardRankingScopeHref,
  buildDiscoveryBoardSimulationsScopeHref,
  buildDiscoveryIdeaScopeHref,
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

function formatDate(value?: string | null) {
  if (!value) return "n/a";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

/* ------------------------------------------------------------------ */
/*  Kanban column definitions                                         */
/* ------------------------------------------------------------------ */

interface BoardColumn {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly borderColor: string;
  readonly badgeBg: string;
  readonly stages: readonly string[];
}

const BOARD_COLUMNS: readonly BoardColumn[] = [
  {
    key: "draft",
    label: "Draft",
    description: "Raw ideas from discovery sessions",
    borderColor: "border-t-neutral-400",
    badgeBg: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
    stages: ["sourced"],
  },
  {
    key: "queued",
    label: "Queued",
    description: "Ranked and ready for evaluation",
    borderColor: "border-t-blue-500",
    badgeBg: "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    stages: ["ranked", "swiped"],
  },
  {
    key: "simulated",
    label: "Simulated",
    description: "Market simulation completed",
    borderColor: "border-t-amber-500",
    badgeBg: "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    stages: ["simulated"],
  },
  {
    key: "debated",
    label: "Debated",
    description: "Agent debate and analysis done",
    borderColor: "border-t-purple-500",
    badgeBg: "bg-purple-50 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    stages: ["debated"],
  },
  {
    key: "validated",
    label: "Validated",
    description: "Ready for execution",
    borderColor: "border-t-green-500",
    badgeBg: "bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    stages: ["executed"],
  },
  {
    key: "handed_off",
    label: "Handed off",
    description: "Moved to execution pipeline",
    borderColor: "border-t-indigo-500",
    badgeBg: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    stages: ["handed_off"],
  },
] as const;

function collectAllIdeas(snapshot: ShellDiscoveryBoardSnapshot): QuorumDiscoveryIdea[] {
  const seen = new Set<string>();
  const result: QuorumDiscoveryIdea[] = [];

  const push = (idea: QuorumDiscoveryIdea) => {
    if (seen.has(idea.idea_id)) return;
    seen.add(idea.idea_id);
    result.push(idea);
  };

  for (const idea of snapshot.simulationIdeas) {
    push(idea);
  }
  if (snapshot.leaderboard?.items) {
    for (const item of snapshot.leaderboard.items) {
      push(item.idea);
    }
  }
  if (snapshot.swipeQueue?.items) {
    for (const item of snapshot.swipeQueue.items) {
      push(item.idea);
    }
  }
  if (snapshot.nextPair) {
    push(snapshot.nextPair.left.idea);
    push(snapshot.nextPair.right.idea);
  }

  return result;
}

function groupIdeasByColumn(
  ideas: readonly QuorumDiscoveryIdea[],
): ReadonlyMap<string, QuorumDiscoveryIdea[]> {
  const stageToColumn = new Map<string, string>();
  for (const col of BOARD_COLUMNS) {
    for (const stage of col.stages) {
      stageToColumn.set(stage, col.key);
    }
  }

  const groups = new Map<string, QuorumDiscoveryIdea[]>();
  for (const col of BOARD_COLUMNS) {
    groups.set(col.key, []);
  }

  for (const idea of ideas) {
    const columnKey = stageToColumn.get(idea.latest_stage) ?? "draft";
    const bucket = groups.get(columnKey);
    if (bucket) {
      bucket.push(idea);
    }
  }

  // Sort each column by rank_score descending
  for (const bucket of groups.values()) {
    bucket.sort((a, b) => b.rank_score - a.rank_score);
  }

  return groups;
}

/* ------------------------------------------------------------------ */
/*  Kanban card                                                       */
/* ------------------------------------------------------------------ */

function BoardCard({
  idea,
  routeScope,
}: {
  idea: QuorumDiscoveryIdea;
  routeScope: DiscoveryBoardRouteScope;
}) {
  return (
    <Link
      href={buildDiscoveryIdeaScopeHref(idea.idea_id, routeScope)}
      className="group block rounded-lg border border-border/60 bg-card p-3 transition-shadow hover:shadow-sm"
    >
      <div className="truncate text-[13px] font-medium leading-5 text-foreground group-hover:text-accent-foreground">
        {idea.title}
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-[12px] text-muted-foreground">
        <span>Score: {idea.rank_score.toFixed(0)}</span>
        <span>Belief: {idea.belief_score.toFixed(2)}</span>
      </div>
      {idea.topic_tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {idea.topic_tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-block rounded-full bg-muted/60 px-1.5 py-0.5 text-[11px] leading-tight text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Kanban column                                                     */
/* ------------------------------------------------------------------ */

function BoardColumnView({
  column,
  ideas,
  routeScope,
}: {
  column: BoardColumn;
  ideas: readonly QuorumDiscoveryIdea[];
  routeScope: DiscoveryBoardRouteScope;
}) {
  return (
    <div className="flex min-w-[160px] sm:min-w-[200px] max-w-[260px] shrink-0 flex-col">
      <div
        className={`rounded-t-lg border-t-2 ${column.borderColor} border-x border-border/40 bg-muted/30 px-3 py-2.5`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-medium text-foreground">
            {column.label}
          </span>
          <span
            className={`inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-medium leading-none ${column.badgeBg}`}
          >
            {ideas.length}
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto rounded-b-lg border-x border-b border-border/40 bg-muted/10 p-2">
        {ideas.length > 0 ? (
          ideas.map((idea) => (
            <BoardCard
              key={idea.idea_id}
              idea={idea}
              routeScope={routeScope}
            />
          ))
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border/50 p-4 text-center">
            <span className="text-[11px] text-muted-foreground/60">{column.description}</span>
          </div>
        )}
      </div>
    </div>
  );
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
  const selectLoadState = useCallback(
    (nextSnapshot: ShellDiscoveryBoardSnapshot) => nextSnapshot.loadState,
    []
  );
  const { snapshot } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_DISCOVERY_BOARD_SNAPSHOT,
    initialSnapshot,
    refreshNonce: snapshotRefreshNonce,
    pollIntervalMs: pollInterval,
    loadSnapshot,
    selectLoadState,
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

  const allIdeas = useMemo(() => collectAllIdeas(snapshot), [snapshot]);
  const columnGroups = useMemo(() => groupIdeasByColumn(allIdeas), [allIdeas]);

  const errors = [
    ...snapshot.errors,
    errorMessage ?? "",
  ].filter(Boolean);

  return (
    <ShellPage className="max-w-[1400px]">
      <div className="sticky top-11 z-10 -mx-6 flex items-center justify-between border-b border-border/40 bg-background/95 px-6 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
          <span>{allIdeas.length} ideas</span>
          <span>{formatDate(snapshot.generatedAt)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ShellFilterChipLink href={buildDiscoveryBoardRankingScopeHref(routeScope)} label="Ranking" />
          <ShellFilterChipLink href={buildDiscoveryBoardArchiveScopeHref(routeScope)} label="Archive" />
          <ShellFilterChipLink href={buildDiscoveryBoardFinalsScopeHref(routeScope)} label="Finals" />
          <ShellFilterChipLink href={buildDiscoveryBoardSimulationsScopeHref(routeScope)} label="Simulations" />
          <ShellRefreshButton type="button" onClick={() => refreshClient()} compact />
        </div>
      </div>

      <div className="relative">
        <div className="flex gap-4 overflow-x-auto pb-4">
          {BOARD_COLUMNS.map((col) => (
            <BoardColumnView
              key={col.key}
              column={col}
              ideas={columnGroups.get(col.key) ?? []}
              routeScope={routeScope}
            />
          ))}
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent" />
      </div>
    </ShellPage>
  );
}
