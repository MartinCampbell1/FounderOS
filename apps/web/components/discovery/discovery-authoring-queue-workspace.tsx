"use client";

import type { ShellPreferences } from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import { cn } from "@founderos/ui/lib/utils";
import Link from "next/link";
import { Orbit } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  ShellHero,
  ShellFilterChipButton,
  ShellFilterChipLink,
  ShellLoadingState,
  ShellMetricCard,
  ShellPage,
  ShellQueueSectionCard,
  ShellRefreshButton,
  ShellRefreshStateCard,
  ShellScopeBadgeRow,
  ShellSelectionEmptyState,
  ShellToolbarSurface,
  ShellStatusBanner,
} from "@/components/shell/shell-screen-primitives";
import {
  matchesShellChainRouteScope,
  shellChainRouteScope,
} from "@/lib/chain-graph";
import type {
  ShellDiscoveryAuthoringQueueRecord,
  ShellDiscoveryAuthoringQueueSnapshot,
} from "@/lib/discovery-authoring-queue";
import { discoveryAuthoringGapLabel } from "@/lib/discovery-authoring";
import {
  buildRememberedDiscoveryReviewScopeHref,
  resolveReviewMemoryBucket,
} from "@/lib/review-memory";
import { fetchShellDiscoveryAuthoringQueueSnapshot } from "@/lib/shell-snapshot-client";
import { useShellManualRefresh } from "@/lib/use-shell-manual-refresh";
import {
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import { useShellSnapshotRefreshNonce } from "@/lib/use-shell-snapshot-refresh-nonce";
import {
  buildDiscoveryBoardScopeHref,
  buildDiscoveryIdeaAuthoringScopeHref,
  buildDiscoveryIdeasScopeHref,
  hasShellRouteScope,
  type ShellRouteScope,
} from "@/lib/route-scope";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";

type DiscoveryAuthoringQueueRouteScope = ShellRouteScope;
type AuthoringFilter =
  | "needs_work"
  | "all"
  | "ready"
  | "linked"
  | "attention"
  | "evidence"
  | "validation"
  | "decision"
  | "timeline";

const EMPTY_DISCOVERY_AUTHORING_QUEUE_SNAPSHOT: ShellDiscoveryAuthoringQueueSnapshot = {
  generatedAt: "",
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
  error: null,
  loadState: "ready",
};

function formatRelativeTime(value?: string | null) {
  if (!value) return "";
  const ms = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function matchesFilter(
  record: ShellDiscoveryAuthoringQueueRecord,
  filter: AuthoringFilter
) {
  if (filter === "all") {
    return true;
  }
  if (filter === "needs_work") {
    return record.authoring.gapCount > 0;
  }
  if (filter === "ready") {
    return record.authoring.gapCount === 0;
  }
  if (filter === "linked") {
    return Boolean(record.chain);
  }
  if (filter === "attention") {
    return (record.chain?.attention?.total ?? 0) > 0;
  }
  return record.authoring.gaps.includes(filter);
}

function buildScopedStats(records: ShellDiscoveryAuthoringQueueRecord[]) {
  return {
    totalCount: records.length,
    readyCount: records.filter((record) => record.authoring.gapCount === 0).length,
    needsWorkCount: records.filter((record) => record.authoring.gapCount > 0).length,
    linkedCount: records.filter((record) => Boolean(record.chain)).length,
    attentionLinkedCount: records.filter(
      (record) => (record.chain?.attention?.total ?? 0) > 0
    ).length,
    evidenceGapCount: records.filter((record) =>
      record.authoring.gaps.includes("evidence")
    ).length,
    validationGapCount: records.filter((record) =>
      record.authoring.gaps.includes("validation")
    ).length,
    decisionGapCount: records.filter((record) =>
      record.authoring.gaps.includes("decision")
    ).length,
    timelineGapCount: records.filter((record) =>
      record.authoring.gaps.includes("timeline")
    ).length,
  };
}

function statusDotClass(status: string) {
  if (status === "ready") return "bg-emerald-500";
  if (status === "partial") return "bg-amber-500";
  return "bg-red-500";
}

function AuthoringQueueRow({
  record,
  routeScope,
}: {
  record: ShellDiscoveryAuthoringQueueRecord;
  routeScope: DiscoveryAuthoringQueueRouteScope;
}) {
  const scopedRoute = record.chain
    ? shellChainRouteScope(record.chain, routeScope)
    : routeScope;
  const authoringHref = buildDiscoveryIdeaAuthoringScopeHref(
    record.dossier.idea.idea_id,
    scopedRoute
  );
  const time = formatRelativeTime(record.authoring.lastUpdatedAt);
  const attentionCount = record.chain?.attention?.total ?? 0;

  return (
    <div className="grid grid-cols-[12px_minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-b border-border/50 px-4 py-2 transition-colors last:border-b-0 hover:bg-muted/30">
      <div className="mt-1.5 flex-none">
        <span
          className={cn(
            "block h-2 w-2 rounded-full ring-2 ring-background",
            statusDotClass(record.authoring.status)
          )}
          title={record.authoring.status}
        />
      </div>

      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={authoringHref}
            className="text-[13px] font-medium leading-5 text-foreground hover:underline"
          >
            {record.dossier.idea.title}
          </Link>
          {record.authoring.gaps.length > 0 ? (
            <span className="shrink-0 text-[11px] text-muted-foreground/80">
              missing {record.authoring.gaps.map(discoveryAuthoringGapLabel).join(", ")}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
          <span className="font-mono text-[10px] text-foreground/70">
            idea_{record.dossier.idea.idea_id}
          </span>
          <span>·</span>
          <Badge tone={record.authoring.gapCount > 0 ? "warning" : "success"} className="h-5 px-1.5 text-[10px] uppercase tracking-[0.08em]">
            {record.authoring.status}
          </Badge>
          {record.chain ? (
            <>
              <span>·</span>
              <span>chain-linked</span>
            </>
          ) : null}
          {attentionCount > 0 ? (
            <>
              <span>·</span>
              <span>{attentionCount} attention</span>
            </>
          ) : null}
          {time ? (
            <>
              <span>·</span>
              <span>{time}</span>
            </>
          ) : null}
        </div>
        {record.authoring.gaps.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {record.authoring.gaps.map((gap) => (
              <Badge
                key={gap}
                tone="neutral"
                className="h-5 px-1.5 text-[10px] uppercase tracking-[0.08em]"
              >
                {discoveryAuthoringGapLabel(gap)}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-none flex-col items-end gap-1 pt-0.5 text-right">
        <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/60">
          {record.authoring.gapCount > 0 ? "needs work" : "ready"}
        </div>
        <div>
          <Badge tone={record.authoring.gapCount > 0 ? "warning" : "success"}>
            {record.authoring.gapCount > 0 ? "needs work" : "ready"}
          </Badge>
        </div>
      </div>
    </div>
  );
}

export function DiscoveryAuthoringQueueWorkspace({
  initialPreferences,
  initialSnapshot,
  routeScope,
}: {
  initialPreferences?: ShellPreferences;
  initialSnapshot?: ShellDiscoveryAuthoringQueueSnapshot | null;
  routeScope: DiscoveryAuthoringQueueRouteScope;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AuthoringFilter>("needs_work");
  const { isRefreshing, refresh, refreshNonce } = useShellManualRefresh({
    invalidation: {
      planes: ["discovery"],
      scope: routeScope,
      source: "discovery-authoring-queue",
      reason: "manual-refresh",
    },
  });
  const snapshotRefreshNonce = useShellSnapshotRefreshNonce({
    baseRefreshNonce: refreshNonce,
    invalidation: {
      planes: ["discovery"],
      scope: routeScope,
    },
    invalidationOptions: {
      since: initialSnapshot?.generatedAt ?? null,
    },
  });
  const { preferences } = useShellPreferences(initialPreferences);
  const pollInterval = getShellPollInterval(
    "discovery_authoring_queue",
    preferences.refreshProfile
  );
  const loadSnapshot = useCallback(
    () => fetchShellDiscoveryAuthoringQueueSnapshot(),
    []
  );
  const selectLoadState = useCallback(
    (snapshot: ShellDiscoveryAuthoringQueueSnapshot) => snapshot.loadState,
    []
  );
  const { loadState, snapshot } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_DISCOVERY_AUTHORING_QUEUE_SNAPSHOT,
    initialSnapshot,
    refreshNonce: snapshotRefreshNonce,
    pollIntervalMs: pollInterval,
    loadSnapshot,
    selectLoadState,
  });
  const scopeActive = hasShellRouteScope(routeScope);
  const routeScopedRecords = useMemo(
    () =>
      scopeActive
        ? snapshot.records.filter(
            (record) =>
              Boolean(record.chain) &&
              matchesShellChainRouteScope(record.chain!, routeScope)
          )
        : snapshot.records,
    [routeScope, scopeActive, snapshot.records]
  );
  const filteredRecords = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return routeScopedRecords.filter((record) => {
      if (!matchesFilter(record, filter)) {
        return false;
      }
      if (!normalized) {
        return true;
      }
      return record.searchText.includes(normalized);
    });
  }, [filter, query, routeScopedRecords]);
  const scopedStats = useMemo(
    () => buildScopedStats(routeScopedRecords),
    [routeScopedRecords]
  );

  const filterOptions: Array<{ key: AuthoringFilter; label: string; count: number }> = [
    { key: "needs_work", label: "Needs work", count: scopedStats.needsWorkCount },
    { key: "all", label: "All", count: scopedStats.totalCount },
    { key: "ready", label: "Ready", count: scopedStats.readyCount },
    { key: "linked", label: "Chain-linked", count: scopedStats.linkedCount },
    {
      key: "attention",
      label: "Attention",
      count: scopedStats.attentionLinkedCount,
    },
    {
      key: "evidence",
      label: "Evidence",
      count: scopedStats.evidenceGapCount,
    },
    {
      key: "validation",
      label: "Validation",
      count: scopedStats.validationGapCount,
    },
    {
      key: "decision",
      label: "Decision",
      count: scopedStats.decisionGapCount,
    },
    {
      key: "timeline",
      label: "Timeline",
      count: scopedStats.timelineGapCount,
    },
  ];

  return (
    <ShellPage>
      <ShellHero
        title="Discovery authoring queue"
        description="Finish dossiers before they move into review. Keep the queue narrow by closing evidence, validation, decision, and timeline gaps."
        meta={
          <>
            <span>{scopedStats.totalCount} total</span>
            <span>{scopedStats.needsWorkCount} need work</span>
            <span>{scopedStats.readyCount} ready</span>
            <span>{scopedStats.attentionLinkedCount} attention-linked</span>
          </>
        }
        actions={<ShellRefreshButton type="button" onClick={refresh} busy={isRefreshing} />}
      />

      <ShellToolbarSurface>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ShellScopeBadgeRow
            projectId={routeScope.projectId}
            intakeSessionId={routeScope.intakeSessionId}
            description={
              scopeActive ? "Scoped authoring lane" : "All discovery dossiers in the queue"
            }
          />
          <div className="flex flex-wrap items-center gap-2">
            <ShellFilterChipLink href={buildDiscoveryIdeasScopeHref(routeScope)} label="Ideas" />
            <ShellFilterChipLink href={buildDiscoveryBoardScopeHref(routeScope)} label="Board" />
            <ShellFilterChipLink
              href={buildRememberedDiscoveryReviewScopeHref({
                scope: routeScope,
                preferences,
                bucket: resolveReviewMemoryBucket({ scope: routeScope }),
              })}
              label="Review"
            />
          </div>
        </div>
      </ShellToolbarSurface>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ShellMetricCard
          label="Need work"
          value={String(scopedStats.needsWorkCount)}
          detail="Records still missing required dossier coverage."
        />
        <ShellMetricCard
          label="Ready"
          value={String(scopedStats.readyCount)}
          detail="Dossiers with complete authoring coverage."
        />
        <ShellMetricCard
          label="Chain-linked"
          value={String(scopedStats.linkedCount)}
          detail="Authoring records tied back to execution context."
        />
        <ShellMetricCard
          label="Attention linked"
          value={String(scopedStats.attentionLinkedCount)}
          detail="Linked chains with active attention pressure."
        />
      </section>

      {snapshot.error ? (
        <ShellStatusBanner tone="danger">{snapshot.error}</ShellStatusBanner>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <ShellQueueSectionCard
            title="Find the next dossier to complete"
            actions={<Badge tone="info">{filteredRecords.length} visible</Badge>}
            searchValue={query}
            onSearchChange={(event) => setQuery(event.target.value)}
            searchPlaceholder="Filter by idea, stage, gap, project, intake, or brief"
            hint={scopeActive ? "scope" : "queue"}
            summary={`${filteredRecords.length} visible after filter`}
            chips={filterOptions.map(({ key, label, count }) => (
              <ShellFilterChipButton
                key={key}
                onClick={() => setFilter(key)}
                label={label}
                count={count}
                active={filter === key}
              />
            ))}
          >
              {loadState === "loading" && routeScopedRecords.length === 0 ? (
                <ShellLoadingState description="Loading discovery authoring queue..." />
              ) : null}

              {filteredRecords.map((record) => (
                <AuthoringQueueRow
                  key={record.key}
                  record={record}
                  routeScope={routeScope}
                />
              ))}

              {loadState !== "loading" && filteredRecords.length === 0 ? (
                <ShellSelectionEmptyState
                  title="Queue clear"
                  description="All dossiers have complete coverage. No authoring work needed."
                  icon={<Orbit className="h-5 w-5" />}
                  className="py-6"
                  minHeightClassName="min-h-[220px]"
                />
              ) : null}
          </ShellQueueSectionCard>
        </div>

        <div className="space-y-4">

          <ShellRefreshStateCard
            description="The authoring queue polls through the shell-owned same-origin seam."
            busy={loadState === "loading"}
            busyLabel="Queue refresh in progress..."
            idleLabel="Queue idle."
            icon={<Orbit className="h-4 w-4 text-accent" />}
            intervalSeconds={Math.round(pollInterval / 1000)}
            guidance="Use authoring route links whenever the next step is writing evidence, validation, decisions, or timeline updates."
          />
        </div>
      </section>
    </ShellPage>
  );
}
