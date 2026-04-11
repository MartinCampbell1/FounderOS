"use client";

import type {
  QuorumIdeaTraceBundle,
  ShellPreferences,
} from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import { useCallback, useMemo, useState } from "react";

import {
  ShellEmptyState,
  ShellHero,
  ShellLoadingState,
  ShellPage,
  ShellMetricCard,
  ShellSearchSectionCard,
  ShellStatusBanner,
} from "@/components/shell/shell-screen-primitives";
import type { ShellDiscoveryTracesSnapshot } from "@/lib/discovery-history";
import { fetchShellDiscoveryTracesSnapshot } from "@/lib/shell-snapshot-client";
import {
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import { useShellSnapshotRefreshNonce } from "@/lib/use-shell-snapshot-refresh-nonce";
import type { ShellRouteScope } from "@/lib/route-scope";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";

type DiscoveryTracesRouteScope = ShellRouteScope;

const EMPTY_DISCOVERY_TRACES_SNAPSHOT: ShellDiscoveryTracesSnapshot = {
  generatedAt: "",
  scoreboard: null,
  scoreboardError: null,
  scoreboardLoadState: "ready",
  traces: null,
  tracesError: null,
  tracesLoadState: "ready",
  ideaTrace: null,
  ideaTraceError: null,
  ideaTraceLoadState: "idle",
  errors: [],
  loadState: "ready",
};

function formatRelative(timestamp: number) {
  const diffSeconds = Math.max(0, Math.floor(Date.now() / 1000 - timestamp));
  if (diffSeconds < 60) return "just now";
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  return `${Math.floor(diffSeconds / 86400)}d ago`;
}

function resolveSourceBadgeTone(stage: string) {
  if (stage === "executed") return "success" as const;
  if (stage === "handed_off") return "info" as const;
  if (stage === "simulated" || stage === "debated") return "warning" as const;
  return "neutral" as const;
}

function resolveSourceLabel(item: QuorumIdeaTraceBundle): string {
  if (item.latest_stage === "executed") return "github";
  if (item.latest_stage === "handed_off") return "web";
  return "manual";
}

function ObservationRow({ item }: { item: QuorumIdeaTraceBundle }) {
  const sourceLabel = resolveSourceLabel(item);
  const tone = resolveSourceBadgeTone(item.latest_stage);
  const preview = item.steps[0]?.detail ?? item.steps[0]?.title ?? item.latest_stage;
  const truncated =
    preview.length > 120 ? `${preview.slice(0, 120)}...` : preview;
  const latestStep = item.steps[item.steps.length - 1];
  const relativeTime = latestStep
    ? formatRelative(new Date(latestStep.created_at).getTime() / 1000)
    : null;

  return (
    <div className="flex items-start gap-3 border-b border-border/50 px-4 py-2.5 transition-colors last:border-b-0 hover:bg-muted/30">
      <div className="mt-0.5 shrink-0">
        <Badge tone={tone}>{sourceLabel}</Badge>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <div className="text-[13px] font-medium leading-5 text-foreground">
            {item.title}
          </div>
          <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            {item.steps.length} steps
          </span>
        </div>
        {truncated ? (
          <div className="truncate text-[12px] leading-5 text-muted-foreground">
            {truncated}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          <span>{item.latest_stage}</span>
          {relativeTime ? (
            <>
              <span>·</span>
              <span>{relativeTime}</span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function DiscoveryTracesWorkspace({
  activeIdeaId,
  initialPreferences,
  initialSnapshot,
  routeScope = { projectId: "", intakeSessionId: "" },
}: {
  activeIdeaId: string | null;
  initialPreferences?: ShellPreferences;
  initialSnapshot?: ShellDiscoveryTracesSnapshot | null;
  routeScope?: DiscoveryTracesRouteScope;
}) {
  const { preferences } = useShellPreferences(initialPreferences);
  const [query, setQuery] = useState("");

  const snapshotRefreshNonce = useShellSnapshotRefreshNonce({
    invalidation: {
      planes: ["discovery"],
      scope: routeScope,
      resource: activeIdeaId ? { discoveryIdeaId: activeIdeaId } : undefined,
    },
    invalidationOptions: {
      since: initialSnapshot?.generatedAt ?? null,
    },
  });
  const pollInterval = getShellPollInterval(
    "discovery_trace",
    preferences.refreshProfile
  );
  const loadSnapshot = useCallback(
    () => fetchShellDiscoveryTracesSnapshot(activeIdeaId),
    [activeIdeaId]
  );
  const selectLoadState = useCallback(
    (nextSnapshot: ShellDiscoveryTracesSnapshot) => nextSnapshot.loadState,
    []
  );
  const { snapshot, loadState } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_DISCOVERY_TRACES_SNAPSHOT,
    initialSnapshot,
    refreshNonce: snapshotRefreshNonce,
    pollIntervalMs: pollInterval,
    loadSnapshot,
    selectLoadState,
  });

  const traceItems = useMemo(() => snapshot.traces?.traces ?? [], [snapshot.traces]);
  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return traceItems;
    return traceItems.filter(
      (item) =>
        item.title.toLowerCase().includes(normalized) ||
        item.latest_stage.toLowerCase().includes(normalized) ||
        item.steps.some(
          (step) =>
            step.title.toLowerCase().includes(normalized) ||
            (step.detail ?? "").toLowerCase().includes(normalized)
        )
    );
  }, [query, traceItems]);
  const traceStats = useMemo(
    () => ({
      totalCount: traceItems.length,
      executedCount: traceItems.filter((item) => item.latest_stage === "executed").length,
      handoffCount: traceItems.filter((item) => item.latest_stage === "handed_off").length,
      simulatedCount: traceItems.filter(
        (item) => item.latest_stage === "simulated" || item.latest_stage === "debated"
      ).length,
    }),
    [traceItems]
  );

  return (
    <ShellPage>
      <ShellHero
        title="Discovery traces"
        description="Search the latest observation bundle, then inspect the trace surface for the current idea."
        meta={
          <>
            <span>{traceStats.totalCount} observations</span>
            <span>{traceStats.executedCount} executed</span>
            <span>{traceStats.handoffCount} handed off</span>
            <span>{traceStats.simulatedCount} simulated or debated</span>
          </>
        }
      />

      {snapshot.errors.length > 0 ? (
        <ShellStatusBanner tone="danger">{snapshot.errors.join(" ")}</ShellStatusBanner>
      ) : null}

      <section className="grid gap-3 md:grid-cols-4">
        <ShellMetricCard
          label="Observations"
          value={String(traceStats.totalCount)}
          detail="Trace bundles visible in the current discovery slice."
        />
        <ShellMetricCard
          label="Executed"
          value={String(traceStats.executedCount)}
          detail="Signals that already crossed into execution."
        />
        <ShellMetricCard
          label="Handed off"
          value={String(traceStats.handoffCount)}
          detail="Observations that left discovery review."
        />
        <ShellMetricCard
          label="Simulated"
          value={String(traceStats.simulatedCount)}
          detail="Debated or simulated trace bundles."
        />
      </section>

      <ShellSearchSectionCard
        title="Trace observations"
        description="Search the latest observation bundle and review the source trail."
        actions={<Badge tone="info">{filteredItems.length}</Badge>}
        searchValue={query}
        onSearchChange={(e) => setQuery(e.target.value)}
        searchPlaceholder="Search observations..."
        className="rounded-[8px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)]/72"
        contentClassName="space-y-0"
      >
        {loadState === "loading" && traceItems.length === 0 ? (
          <div className="px-1 py-3">
            <ShellLoadingState description="Loading research observations..." />
          </div>
        ) : filteredItems.length > 0 ? (
          filteredItems.map((item) => <ObservationRow key={item.idea_id} item={item} />)
        ) : (
          <div className="px-1 py-3">
            <ShellEmptyState description="No observations yet. Run a research scan to discover insights." />
          </div>
        )}
      </ShellSearchSectionCard>
    </ShellPage>
  );
}
