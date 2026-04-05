"use client";

import type { ShellPreferences } from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import { cn } from "@founderos/ui/lib/utils";
import Link from "next/link";
import { Orbit } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  ShellEmptyState,
  ShellFilterChipButton,
  ShellFilterChipLink,
  ShellHero,
  ShellLoadingState,
  ShellPage,
  ShellQueueSectionCard,
  ShellRefreshButton,
  ShellRefreshStateCard,
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

function formatDate(value?: string | null) {
  if (!value) return "n/a";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

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

  return (
    <div className="flex items-start gap-3 border-b border-border/50 px-4 py-2.5 transition-colors hover:bg-muted/40">
      {/* Status dot */}
      <div className="mt-1.5 flex-none">
        <span
          className={cn(
            "block h-2 w-2 rounded-full",
            statusDotClass(record.authoring.status)
          )}
          title={record.authoring.status}
        />
      </div>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <Link
            href={authoringHref}
            className="text-[13px] font-medium leading-5 text-foreground hover:underline"
          >
            {record.dossier.idea.title}
          </Link>
          {record.authoring.gaps.length > 0 ? (
            <span className="shrink-0 text-[11px] text-muted-foreground">
              missing:{" "}
              {record.authoring.gaps
                .map(discoveryAuthoringGapLabel)
                .join(", ")}
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-[12px] text-muted-foreground">
            idea_{record.dossier.idea.idea_id}
          </span>
          {record.authoring.gaps.map((gap) => (
            <span
              key={gap}
              className="rounded border border-border/60 px-1.5 py-px text-[10px] text-muted-foreground"
            >
              {discoveryAuthoringGapLabel(gap)}
            </span>
          ))}
        </div>
      </div>

      {/* Time */}
      {time ? (
        <div className="flex-none pt-0.5 text-[12px] text-muted-foreground">
          {time}
        </div>
      ) : null}
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
  return (
    <ShellPage>
      <ShellHero
        eyebrow={<Badge tone="info">Discovery authoring queue</Badge>}
        title="Authoring"
        meta={
          <>
            <span>{routeScopedRecords.length} dossiers in the current scope.</span>
            <span>{scopedStats.needsWorkCount} still need coverage.</span>
            <span>Snapshot {formatDate(snapshot.generatedAt)}</span>
          </>
        }
        actions={
          <>
            <ShellRefreshButton type="button" onClick={refresh} busy={isRefreshing} />
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
          </>
        }
        aside={
          scopeActive
            ? "Queue state is pinned to the current execution chain, so coverage work, inbox returns, and execution links stay inside the same project and intake context."
            : "Authoring readiness now lives as an explicit operator lane instead of being buried across dossier detail, portfolio, and dashboard summaries."
        }
      />


      {snapshot.error ? (
        <ShellStatusBanner tone="warning">{snapshot.error}</ShellStatusBanner>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <ShellQueueSectionCard
            title="Find the next dossier to complete"
            eyebrow={<div className="text-sm leading-6 text-muted-foreground">Authoring backlog</div>}
            actions={<Badge tone="info">{filteredRecords.length} visible</Badge>}
            searchValue={query}
            onSearchChange={(event) => setQuery(event.target.value)}
            searchPlaceholder="Filter by idea, stage, gap, project, intake, or brief"
            hint={scopeActive ? "scope" : "queue"}
            summary={`${filteredRecords.length} visible after filter`}
            chips={[
              ["needs_work", "Needs work"],
              ["all", "All"],
              ["ready", "Ready"],
              ["linked", "Chain-linked"],
              ["attention", "Attention"],
              ["evidence", "Evidence"],
              ["validation", "Validation"],
              ["decision", "Decision"],
              ["timeline", "Timeline"],
            ].map(([key, label]) => (
              <ShellFilterChipButton
                key={key}
                onClick={() => setFilter(key as AuthoringFilter)}
                label={String(label ?? key ?? "")}
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
                <ShellEmptyState
                  centered
                  description="All dossiers have complete coverage. No authoring work needed."
                  className="py-10"
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
