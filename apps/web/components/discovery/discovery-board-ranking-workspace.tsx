"use client";

import {
  compareDiscoveryRankingPair,
  type DiscoveryMutationEffect,
} from "@/lib/discovery-mutations";
import type {
  QuorumRankedIdeaRecord,
  ShellPreferences,
} from "@founderos/api-clients";
import Link from "next/link";
import { useCallback, useMemo } from "react";

import {
  ShellActionStateLabel,
  ShellEmptyState,
  ShellFilterChipLink,
  ShellPage,
  ShellPillButton,
  ShellRefreshButton,
  ShellSectionCard,
  ShellStatusBanner,
} from "@/components/shell/shell-screen-primitives";
import type { ShellDiscoveryRankingSnapshot } from "@/lib/discovery-board-detail";
import {
  buildRememberedDiscoveryReviewScopeHref,
  resolveReviewMemoryBucket,
} from "@/lib/review-memory";
import { fetchShellDiscoveryRankingSnapshot } from "@/lib/shell-snapshot-client";
import {
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import {
  buildDiscoveryBoardArchiveScopeHref,
  buildDiscoveryBoardFinalsScopeHref,
  buildDiscoveryBoardRankingScopeHref,
  buildDiscoveryBoardSimulationsScopeHref,
  buildDiscoveryBoardScopeHref,
  buildDiscoveryIdeaScopeHref,
  type ShellRouteScope,
} from "@/lib/route-scope";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";
import { useShellRouteMutationRunner } from "@/lib/use-shell-route-mutation-runner";
import { useShellSnapshotRefreshNonce } from "@/lib/use-shell-snapshot-refresh-nonce";

type DiscoveryBoardRankingRouteScope = ShellRouteScope;

const EMPTY_DISCOVERY_RANKING_SNAPSHOT: ShellDiscoveryRankingSnapshot = {
  generatedAt: "",
  leaderboard: null,
  leaderboardError: null,
  leaderboardLoadState: "ready",
  nextPair: null,
  nextPairError: null,
  nextPairLoadState: "ready",
  archive: null,
  archiveError: null,
  archiveLoadState: "ready",
  errors: [],
  loadState: "ready",
};

function formatMetricValue(value?: number | null, digits = 0) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "n/a";
  }

  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function MetricTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-[13px] font-medium text-foreground">{value}</div>
      <div className="mt-1 text-[12px] leading-5 text-muted-foreground">
        {detail}
      </div>
    </div>
  );
}

function LeaderboardTable({
  items,
  routeScope,
}: {
  items: QuorumRankedIdeaRecord[];
  routeScope: DiscoveryBoardRankingRouteScope;
}) {
  if (!items.length) {
    return (
      <ShellEmptyState description="No rankings yet. Start comparing ideas to build the leaderboard." />
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-border/70">
            <th className="w-10 pb-2.5 pr-4 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              #
            </th>
            <th className="pb-2.5 pr-4 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Idea
            </th>
            <th className="w-24 pb-2.5 pr-4 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Score
            </th>
            <th className="w-16 pb-2.5 pr-4 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Wins
            </th>
            <th className="w-20 pb-2.5 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Matches
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <LeaderboardRow
              key={item.idea.idea_id}
              item={item}
              routeScope={routeScope}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeaderboardRow({
  item,
  routeScope,
}: {
  item: QuorumRankedIdeaRecord;
  routeScope: DiscoveryBoardRankingRouteScope;
}) {
  const href = buildDiscoveryIdeaScopeHref(item.idea.idea_id, routeScope);

  return (
    <tr className="group border-b border-border/70 last:border-0 hover:bg-muted/30">
      <td className="py-2 pr-4 align-middle">
        <span className="font-medium tabular-nums text-muted-foreground">
          {item.rank_position}
        </span>
      </td>
      <td className="py-2 pr-4 align-middle">
        <Link
          href={href}
          className="block max-w-[480px] truncate font-medium text-foreground hover:text-foreground/80"
        >
          {item.idea.title}
        </Link>
        {item.idea.summary || item.idea.thesis ? (
          <p className="mt-0.5 max-w-[480px] truncate text-[12px] leading-5 text-muted-foreground">
            {item.idea.summary ?? item.idea.thesis}
          </p>
        ) : null}
      </td>
      <td className="py-2 pr-4 text-right align-middle tabular-nums text-foreground">
        {Math.round(item.rating).toLocaleString()}
      </td>
      <td className="py-2 pr-4 text-right align-middle tabular-nums text-foreground">
        {item.wins}
      </td>
      <td className="py-2 text-right align-middle tabular-nums text-muted-foreground">
        {item.matches_played}
      </td>
    </tr>
  );
}

function NextPairPanel({
  nextPair,
  busyActionKey,
  onCompare,
}: {
  nextPair: ShellDiscoveryRankingSnapshot["nextPair"];
  busyActionKey: string;
  onCompare: (verdict: "left" | "right" | "tie") => void;
}) {
  if (!nextPair) {
    return null;
  }

  return (
    <ShellSectionCard
      title="Compare next pair"
      description={nextPair.reason}
      contentClassName="space-y-4 pt-0"
      actions={
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["left", "Left wins"],
              ["tie", "Tie"],
              ["right", "Right wins"],
            ] as const
          ).map(([verdict, label]) => (
            <ShellPillButton
              key={verdict}
              type="button"
              tone="primary"
              disabled={Boolean(busyActionKey)}
              onClick={() => onCompare(verdict)}
            >
              <ShellActionStateLabel
                busy={busyActionKey === `compare:${verdict}`}
                idleLabel={label}
                busyLabel={label}
                spinnerClassName="h-3.5 w-3.5 animate-spin"
              />
            </ShellPillButton>
          ))}
        </div>
      }
    >
      <div className="flex flex-wrap gap-2 text-[12px] text-muted-foreground">
        <span>Utility {nextPair.utility_score.toFixed(2)}</span>
        <span>·</span>
        <span>{nextPair.direct_comparisons} direct comparisons</span>
        <span>·</span>
        <span>Pool {nextPair.candidate_pool_size}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {[nextPair.left, nextPair.right].map((item, index) => (
          <div
            key={`${item.idea.idea_id}:${index}`}
            className="rounded-[10px] border border-border/70 bg-muted/20 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {index === 0 ? "Left" : "Right"}
                </div>
                <p className="truncate text-[13px] font-medium text-foreground">
                  {item.idea.title}
                </p>
                {item.idea.summary || item.idea.thesis ? (
                  <p className="mt-0.5 line-clamp-2 text-[12px] leading-5 text-muted-foreground">
                    {item.idea.summary ?? item.idea.thesis}
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 text-[12px] font-medium tabular-nums text-muted-foreground">
                #{item.rank_position}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[12px] text-muted-foreground">
              <span>{Math.round(item.rating).toLocaleString()} pts</span>
              <span>·</span>
              <span>
                {item.wins}W–{item.losses}L
              </span>
            </div>
          </div>
        ))}
      </div>
    </ShellSectionCard>
  );
}

export function DiscoveryBoardRankingWorkspace({
  initialPreferences,
  initialSnapshot,
  routeScope = { projectId: "", intakeSessionId: "" },
}: {
  initialPreferences?: ShellPreferences;
  initialSnapshot?: ShellDiscoveryRankingSnapshot | null;
  routeScope?: DiscoveryBoardRankingRouteScope;
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
  const {
    busyActionKey,
    errorMessage,
    refreshClient,
    refreshNonce,
    runMutation,
    statusMessage,
  } = useShellRouteMutationRunner<DiscoveryMutationEffect>(
    {
      planes: ["discovery"],
      scope: routeScope,
      source: "discovery-board-ranking",
      reason: "discovery-board-ranking-mutation",
    },
    {
      fallbackErrorMessage: "Ranking action failed.",
    }
  );
  const snapshotRefreshNonce = useShellSnapshotRefreshNonce({
    baseRefreshNonce: refreshNonce,
    invalidation: {
      planes: ["discovery"],
      scope: routeScope,
    },
    invalidationOptions: {
      ignoreSources: ["discovery-board-ranking"],
      since: initialSnapshot?.generatedAt ?? null,
    },
  });
  const pollInterval = getShellPollInterval(
    "discovery_board",
    preferences.refreshProfile
  );
  const loadSnapshot = useCallback(
    () => fetchShellDiscoveryRankingSnapshot(),
    []
  );
  const selectLoadState = useCallback(
    (nextSnapshot: ShellDiscoveryRankingSnapshot) => nextSnapshot.loadState,
    []
  );
  const { snapshot } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_DISCOVERY_RANKING_SNAPSHOT,
    initialSnapshot,
    refreshNonce: snapshotRefreshNonce,
    pollIntervalMs: pollInterval,
    loadSnapshot,
    selectLoadState,
  });

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
          source: "discovery-board-ranking",
        })
      );
    },
    [routeScope, runMutation, snapshot.nextPair]
  );

  const metrics = snapshot.leaderboard?.metrics;
  const errors = [...snapshot.errors, errorMessage ?? ""].filter(Boolean);
  const leaderboardItems = snapshot.leaderboard?.items ?? [];
  const leaderboardMetricTiles = [
    {
      label: "Comparisons",
      value: formatMetricValue(metrics?.comparisons_count),
      detail: "Total pairwise votes.",
    },
    {
      label: "Unique pairs",
      value: formatMetricValue(metrics?.unique_pairs),
      detail: "Distinct pairs covered.",
    },
    {
      label: "Reliability",
      value: formatMetricValue(metrics?.reliability_weighted, 2),
      detail: "Weighted confidence.",
    },
    {
      label: "Stability",
      value: formatMetricValue(metrics?.rank_stability, 2),
      detail: "Order consistency.",
    },
  ];

  return (
    <ShellPage className="max-w-[1600px]">
      <div className="flex items-center justify-end gap-2">
        <ShellRefreshButton type="button" onClick={() => refreshClient()} />
        {[
          [buildDiscoveryBoardScopeHref(routeScope), "Board", false],
          [buildDiscoveryBoardRankingScopeHref(routeScope), "Ranking", true],
          [buildDiscoveryBoardArchiveScopeHref(routeScope), "Archive", false],
          [buildDiscoveryBoardFinalsScopeHref(routeScope), "Finals", false],
          [buildDiscoveryBoardSimulationsScopeHref(routeScope), "Simulations", false],
          [reviewHref, "Review", false],
        ].map(([href, label, active]) => (
          <ShellFilterChipLink
            key={String(href)}
            href={String(href)}
            label={String(label)}
            active={Boolean(active)}
          />
        ))}
      </div>

      {statusMessage ? (
        <ShellStatusBanner tone="success">{statusMessage}</ShellStatusBanner>
      ) : null}

      {errors.length > 0 ? (
        <ShellStatusBanner tone="warning">{errors.join(" ")}</ShellStatusBanner>
      ) : null}

      <NextPairPanel
        nextPair={snapshot.nextPair}
        busyActionKey={busyActionKey}
        onCompare={handleCompare}
      />

      <ShellSectionCard
        title="Leaderboard"
        description={`${leaderboardItems.length} ideas · ${formatMetricValue(metrics?.comparisons_count)} comparisons`}
        contentClassName="space-y-3 pt-0"
      >
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {leaderboardMetricTiles.map((tile) => (
            <MetricTile
              key={tile.label}
              label={tile.label}
              value={tile.value}
              detail={tile.detail}
            />
          ))}
        </div>

        <div className="overflow-hidden rounded-[10px] border border-border/70 bg-card">
          <LeaderboardTable items={leaderboardItems} routeScope={routeScope} />
        </div>
      </ShellSectionCard>

    </ShellPage>
  );
}
