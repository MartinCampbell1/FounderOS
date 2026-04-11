"use client";

import { type DiscoveryMutationEffect } from "@/lib/discovery-mutations";
import type {
  QuorumDiscoveryIdea,
  ShellPreferences,
} from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import Link from "next/link";
import { useCallback, useMemo } from "react";

import {
  ShellFilterChipLink,
  ShellHero,
  ShellMetricCard,
  ShellPage,
  ShellRefreshButton,
  ShellStatusBanner,
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
  readonly stages: readonly string[];
}

const BOARD_COLUMNS: readonly BoardColumn[] = [
  {
    key: "draft",
    label: "Draft",
    description: "Raw ideas from discovery sessions",
    borderColor: "border-t-neutral-400",
    stages: ["sourced"],
  },
  {
    key: "queued",
    label: "Queued",
    description: "Ranked and ready for evaluation",
    borderColor: "border-t-blue-500",
    stages: ["ranked", "swiped"],
  },
  {
    key: "simulated",
    label: "Simulated",
    description: "Market simulation completed",
    borderColor: "border-t-amber-500",
    stages: ["simulated"],
  },
  {
    key: "debated",
    label: "Debated",
    description: "Agent debate and analysis done",
    borderColor: "border-t-purple-500",
    stages: ["debated"],
  },
  {
    key: "validated",
    label: "Validated",
    description: "Ready for execution",
    borderColor: "border-t-green-500",
    stages: ["executed"],
  },
  {
    key: "handed_off",
    label: "Handed off",
    description: "Moved to execution pipeline",
    borderColor: "border-t-indigo-500",
    stages: ["handed_off"],
  },
] as const;

function columnCount(
  groups: ReadonlyMap<string, QuorumDiscoveryIdea[]>,
  key: string,
) {
  return groups.get(key)?.length ?? 0;
}

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
      className="group block rounded-[8px] border border-border/60 bg-[color:var(--shell-control-bg)] px-2.5 py-2 transition-colors hover:border-border/80 hover:bg-[color:var(--shell-control-hover)]"
    >
      <div className="space-y-1.5">
        <div className="truncate text-[12px] font-medium leading-4 text-foreground">
          {idea.title}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral" className="px-1.5 py-0 text-[10px] leading-4">
            Score {idea.rank_score.toFixed(0)}
          </Badge>
          <Badge tone="neutral" className="px-1.5 py-0 text-[10px] leading-4">
            Belief {idea.belief_score.toFixed(2)}
          </Badge>
        </div>
      </div>
      {idea.topic_tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {idea.topic_tags.slice(0, 3).map((tag) => (
            <Badge
              key={tag}
              tone="neutral"
              className="px-1.5 py-0 text-[10px] leading-4"
            >
              {tag}
            </Badge>
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
    <div className="flex min-w-[208px] sm:min-w-[232px] max-w-[296px] shrink-0 flex-col">
      <div
        className={`rounded-t-[10px] border-x border-t border-t-2 border-border/60 ${column.borderColor} bg-[color:var(--shell-control-bg)] px-3 py-2`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <span className="text-[12px] font-semibold tracking-tight text-foreground">
              {column.label}
            </span>
            <p className="text-[10.5px] leading-4 text-muted-foreground">
              {column.description}
            </p>
          </div>
          <Badge tone="neutral" className="shrink-0 px-2 py-0.5 text-[10px] leading-4">
            {ideas.length}
          </Badge>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto rounded-b-[10px] border-x border-b border-border/60 bg-background/55 p-2">
        {ideas.length > 0 ? (
          ideas.map((idea) => (
            <BoardCard
              key={idea.idea_id}
              idea={idea}
              routeScope={routeScope}
            />
          ))
        ) : (
          <div className="flex flex-1 flex-col justify-center rounded-[8px] border border-dashed border-border/60 bg-background/45 px-2.5 py-3">
            <div className="text-[11px] font-medium text-foreground/80">
              No ideas yet
            </div>
            <div className="mt-1 text-[10.5px] leading-4 text-muted-foreground">
              {column.description}
            </div>
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
  const hasRouteScope = Boolean(routeScope.projectId || routeScope.intakeSessionId);
  const {
    refreshClient,
    refreshNonce,
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

  const allIdeas = useMemo(() => collectAllIdeas(snapshot), [snapshot]);
  const columnGroups = useMemo(() => groupIdeasByColumn(allIdeas), [allIdeas]);
  const columnCounts = useMemo(
    () => ({
      draft: columnCount(columnGroups, "draft"),
      queued: columnCount(columnGroups, "queued"),
      simulated: columnCount(columnGroups, "simulated"),
      debated: columnCount(columnGroups, "debated"),
      validated: columnCount(columnGroups, "validated"),
      handed_off: columnCount(columnGroups, "handed_off"),
    }),
    [columnGroups]
  );
  const columnDescriptions = useMemo(
    () =>
      Object.fromEntries(
        BOARD_COLUMNS.map((column) => [column.key, column.description])
      ) as Record<string, string>,
    []
  );
  const summaryMetrics = [
    {
      label: "Ideas",
      value: `${allIdeas.length}`,
      detail: hasRouteScope ? "Scoped board" : "Global board",
    },
    {
      label: "Draft",
      value: `${columnCounts.draft}`,
      detail: columnDescriptions.draft,
    },
    {
      label: "Queued",
      value: `${columnCounts.queued}`,
      detail: columnDescriptions.queued,
    },
    {
      label: "Simulated",
      value: `${columnCounts.simulated}`,
      detail: columnDescriptions.simulated,
    },
    {
      label: "Validated",
      value: `${columnCounts.validated}`,
      detail: columnDescriptions.validated,
    },
    {
      label: "Handed off",
      value: `${columnCounts.handed_off}`,
      detail: columnDescriptions.handed_off,
    },
  ] as const;

  return (
    <ShellPage className="max-w-[1400px] gap-3">
      <ShellHero
        title="Discovery board"
        description="Rank, simulate, debate, and hand ideas off without leaving the board."
        meta={
          <>
            <span>{allIdeas.length} ideas</span>
            <span>{BOARD_COLUMNS.length} columns</span>
            <span>{hasRouteScope ? "Scoped view" : "Global view"}</span>
            <span>Updated {formatDate(snapshot.generatedAt)}</span>
          </>
        }
        actions={
          <ShellRefreshButton type="button" onClick={() => refreshClient()} compact />
        }
      />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        {summaryMetrics.map((metric) => (
          <ShellMetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            detail={metric.detail}
          />
        ))}
      </div>

      {snapshot.errors.length > 0 ? (
        <ShellStatusBanner tone="warning">{snapshot.errors.join(" ")}</ShellStatusBanner>
      ) : null}

      <div className="sticky top-11 z-10 -mx-6 border-y border-border/50 bg-background/92 px-6 py-2 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Board views
            </span>
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
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>{snapshot.scoreboard ? "Observability live" : "Observability pending"}</span>
            <span>•</span>
            <span>{formatDate(snapshot.generatedAt)}</span>
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="flex gap-2.5 overflow-x-auto pb-4">
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
