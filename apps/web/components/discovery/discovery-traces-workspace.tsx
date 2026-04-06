"use client";

import type {
  QuorumIdeaTraceBundle,
  ShellPreferences,
} from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import { cn } from "@founderos/ui/lib/utils";
import { Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  ShellEmptyState,
  ShellLoadingState,
  ShellPage,
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
    <div className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <div className="mt-0.5 shrink-0">
        <Badge tone={tone}>{sourceLabel}</Badge>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium leading-5 text-foreground">
          {item.title}
        </div>
        {truncated ? (
          <div className="mt-0.5 truncate text-[12px] leading-5 text-muted-foreground">
            {truncated}
          </div>
        ) : null}
      </div>
      {relativeTime ? (
        <div className="shrink-0 text-[12px] text-muted-foreground">
          {relativeTime}
        </div>
      ) : null}
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

  return (
    <ShellPage>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search observations..."
          className={cn(
            "h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
          )}
        />
      </div>

      <div className="rounded-lg border border-border">
        {loadState === "loading" && traceItems.length === 0 ? (
          <div className="px-4 py-6">
            <ShellLoadingState description="Loading research observations..." />
          </div>
        ) : filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <ObservationRow key={item.idea_id} item={item} />
          ))
        ) : (
          <div className="px-4 py-6">
            <ShellEmptyState description="No observations yet. Run a research scan to discover insights." />
          </div>
        )}
      </div>
    </ShellPage>
  );
}
