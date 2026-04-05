"use client";

import type { ShellPreferences } from "@founderos/api-clients";
import {
  Search,
  ShieldAlert,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  ShellActionLink,
  ShellEmptyState,
  ShellHero,
  ShellLoadingState,
  ShellPage,
  ShellRefreshButton,
  ShellStatusBanner,
} from "@/components/shell/shell-screen-primitives";
import {
  executionSourceLabel,
} from "@/lib/attention-records";
import {
  matchShellChainQuery,
  matchesShellChainRouteScope,
  shellChainRouteScope,
} from "@/lib/chain-graph";
import { emptyShellReviewCenterSnapshot } from "@/lib/review-center";
import { buildShellEntrySettingsHref } from "@/lib/shell-entry-hrefs";
import { fetchShellPortfolioSnapshot } from "@/lib/shell-snapshot-client";
import {
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import { useShellManualRefresh } from "@/lib/use-shell-manual-refresh";
import { useShellSnapshotRefreshNonce } from "@/lib/use-shell-snapshot-refresh-nonce";
import {
  buildDashboardScopeHref,
  buildDiscoveryIdeaScopeHref,
  buildExecutionIntakeScopeHref,
  buildExecutionProjectScopeHref,
  hasShellRouteScope,
  type ShellRouteScope,
} from "@/lib/route-scope";
import {
  shellSettingsParityTargetsFromChainRecord,
} from "@/lib/settings-parity-targets";
import {
  type IntakePortfolioRecord,
  type LinkedPortfolioRecord,
  type OrphanProjectRecord,
  type ShellPortfolioSnapshot,
} from "@/lib/portfolio";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";

type PortfolioRouteScope = ShellRouteScope;

function formatShortDate(value?: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatCost(usd: number) {
  if (usd === 0) return null;
  return `$${usd.toFixed(2)}`;
}

// Lifecycle dot component: filled = completed stage, empty = pending
function LifecycleDot({ filled }: { filled: boolean }) {
  return (
    <span
      className={
        filled
          ? "inline-block h-2 w-2 rounded-full bg-foreground"
          : "inline-block h-2 w-2 rounded-full border border-muted-foreground/40 bg-transparent"
      }
    />
  );
}

// Connector line between dots
function LifecycleLine({ filled }: { filled: boolean }) {
  return (
    <span
      className={
        filled
          ? "inline-block h-px w-4 bg-foreground/40"
          : "inline-block h-px w-4 bg-muted-foreground/20"
      }
    />
  );
}

// Full lifecycle bar: idea → brief → project → outcome
function LinkedLifecycleBar({
  hasBrief,
  hasProject,
  hasOutcome,
}: {
  hasBrief: boolean;
  hasProject: boolean;
  hasOutcome: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <LifecycleDot filled />
      <LifecycleLine filled={hasBrief} />
      <LifecycleDot filled={hasBrief} />
      <LifecycleLine filled={hasProject} />
      <LifecycleDot filled={hasProject} />
      <LifecycleLine filled={hasOutcome} />
      <LifecycleDot filled={hasOutcome} />
      <span className="ml-2 text-[11px] text-muted-foreground/60">
        idea · brief · project · outcome
      </span>
    </div>
  );
}

// Intake lifecycle bar: intake → project
function IntakeLifecycleBar({ hasProject }: { hasProject: boolean }) {
  return (
    <div className="flex items-center gap-0.5">
      <LifecycleDot filled />
      <LifecycleLine filled={hasProject} />
      <LifecycleDot filled={hasProject} />
      <span className="ml-2 text-[11px] text-muted-foreground/60">
        intake · project
      </span>
    </div>
  );
}

// Orphan lifecycle bar: project only
function OrphanLifecycleBar() {
  return (
    <div className="flex items-center gap-0.5">
      <LifecycleDot filled />
      <span className="ml-2 text-[11px] text-muted-foreground/60">
        project
      </span>
    </div>
  );
}

function LinkedPortfolioRow({
  record,
  routeScope,
}: {
  record: LinkedPortfolioRecord;
  routeScope?: PortfolioRouteScope;
}) {
  const scopedRecordRoute = shellChainRouteScope(record, routeScope);
  const ideaHref = buildDiscoveryIdeaScopeHref(record.idea.idea_id, scopedRecordRoute);
  const projectHref = record.project
    ? buildExecutionProjectScopeHref(record.project.id, scopedRecordRoute)
    : null;

  const storiesText =
    record.project && record.project.stories_total > 0
      ? `${record.project.stories_done}/${record.project.stories_total} stories`
      : null;

  const costText = record.outcome
    ? formatCost(record.outcome.total_cost_usd)
    : null;

  const dateText =
    formatShortDate(record.project?.last_activity_at) ??
    formatShortDate(record.idea.updated_at);

  const metaParts = [
    record.idea.latest_stage,
    record.project?.status,
    storiesText,
    costText,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-1.5 border-b border-border py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <span className="text-[14px] font-medium text-foreground leading-snug">
          {record.idea.title}
        </span>
        {dateText ? (
          <span className="shrink-0 text-[12px] text-muted-foreground">{dateText}</span>
        ) : null}
      </div>

      <LinkedLifecycleBar
        hasBrief={record.brief !== null}
        hasProject={record.project !== null}
        hasOutcome={record.outcome !== null}
      />

      {metaParts.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted-foreground">
          {metaParts.map((part, i) => (
            <span key={i}>
              {i > 0 ? <span className="mr-2 text-muted-foreground/30">·</span> : null}
              {part}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
        <ShellActionLink href={ideaHref} label="Open idea" />
        {projectHref ? (
          <ShellActionLink href={projectHref} label="Open project" />
        ) : null}
        <ShellActionLink
          href={buildShellEntrySettingsHref(
            scopedRecordRoute,
            shellSettingsParityTargetsFromChainRecord(record)
          )}
          label="Settings"
        />
      </div>
    </div>
  );
}

function OrphanProjectRow({
  record,
  routeScope,
}: {
  record: OrphanProjectRecord;
  routeScope?: PortfolioRouteScope;
}) {
  const scopedRecordRoute = shellChainRouteScope(record, routeScope);
  const projectHref = buildExecutionProjectScopeHref(
    record.project.id,
    scopedRecordRoute
  );

  const storiesText =
    record.project.stories_total > 0
      ? `${record.project.stories_done}/${record.project.stories_total} stories`
      : null;

  const dateText = formatShortDate(record.project.last_activity_at);

  const metaParts = [record.project.status, storiesText].filter(Boolean);

  return (
    <div className="flex flex-col gap-1.5 border-b border-border py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span className="text-[14px] font-medium text-foreground leading-snug">
            {record.project.name}
          </span>
        </div>
        {dateText ? (
          <span className="shrink-0 text-[12px] text-muted-foreground">{dateText}</span>
        ) : null}
      </div>

      <OrphanLifecycleBar />

      {metaParts.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted-foreground">
          {metaParts.map((part, i) => (
            <span key={i}>
              {i > 0 ? <span className="mr-2 text-muted-foreground/30">·</span> : null}
              {part}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
        <ShellActionLink href={projectHref} label="Open project" />
        <ShellActionLink
          href={buildDashboardScopeHref(scopedRecordRoute)}
          label="Dashboard"
        />
        <ShellActionLink
          href={buildShellEntrySettingsHref(
            scopedRecordRoute,
            shellSettingsParityTargetsFromChainRecord(record)
          )}
          label="Settings"
        />
      </div>
    </div>
  );
}

function IntakePortfolioRow({
  record,
  routeScope,
}: {
  record: IntakePortfolioRecord;
  routeScope?: PortfolioRouteScope;
}) {
  const scopedRecordRoute = shellChainRouteScope(record, routeScope);
  const intakeHref = buildExecutionIntakeScopeHref(
    record.intakeSessionId,
    scopedRecordRoute
  );
  const projectHref = record.project
    ? buildExecutionProjectScopeHref(record.project.id, scopedRecordRoute)
    : null;

  const sourceKind = record.project?.task_source?.source_kind ?? "intake_session";
  const storiesText =
    record.project && record.project.stories_total > 0
      ? `${record.project.stories_done}/${record.project.stories_total} stories`
      : null;

  const dateText =
    formatShortDate(record.project?.last_activity_at) ??
    formatShortDate(record.intakeSession?.updated_at);

  const metaParts = [
    executionSourceLabel(sourceKind),
    record.project?.status ?? "no project",
    storiesText,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-1.5 border-b border-border py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <span className="text-[14px] font-medium text-foreground leading-snug">
          {record.intakeSession?.title ?? `Intake ${record.intakeSessionId}`}
        </span>
        {dateText ? (
          <span className="shrink-0 text-[12px] text-muted-foreground">{dateText}</span>
        ) : null}
      </div>

      <IntakeLifecycleBar hasProject={record.project !== null} />

      {metaParts.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted-foreground">
          {metaParts.map((part, i) => (
            <span key={i}>
              {i > 0 ? <span className="mr-2 text-muted-foreground/30">·</span> : null}
              {part}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
        <ShellActionLink href={intakeHref} label="Open intake" />
        {projectHref ? (
          <ShellActionLink href={projectHref} label="Open project" />
        ) : null}
        <ShellActionLink
          href={buildShellEntrySettingsHref(
            scopedRecordRoute,
            shellSettingsParityTargetsFromChainRecord(record)
          )}
          label="Settings"
        />
      </div>
    </div>
  );
}

const EMPTY_PORTFOLIO_SNAPSHOT: ShellPortfolioSnapshot = {
  generatedAt: "",
  records: [],
  reviewCenter: emptyShellReviewCenterSnapshot(),
  error: null,
  loadState: "ready",
};

function usePortfolioState(
  refreshNonce: number,
  initialPreferences?: ShellPreferences,
  initialSnapshot?: ShellPortfolioSnapshot | null
) {
  const { preferences } = useShellPreferences(initialPreferences);
  const pollInterval = getShellPollInterval("portfolio", preferences.refreshProfile);
  const loadSnapshot = useCallback(() => fetchShellPortfolioSnapshot(), []);
  const selectLoadState = useCallback(
    (snapshot: ShellPortfolioSnapshot) => snapshot.loadState,
    []
  );
  const { loadState, snapshot } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_PORTFOLIO_SNAPSHOT,
    initialSnapshot,
    refreshNonce,
    pollIntervalMs: pollInterval,
    loadSnapshot,
    selectLoadState,
  });

  return {
    error: snapshot.error,
    loadState,
    pollInterval,
    records: snapshot.records,
    reviewCenter: snapshot.reviewCenter,
  };
}

export function PortfolioWorkspace({
  initialSnapshot,
  initialPreferences,
  routeScope = { projectId: "", intakeSessionId: "" },
}: {
  initialSnapshot?: ShellPortfolioSnapshot | null;
  initialPreferences?: ShellPreferences;
  routeScope?: PortfolioRouteScope;
}) {
  const [query, setQuery] = useState("");
  const { isRefreshing, refresh, refreshNonce: manualRefreshNonce } = useShellManualRefresh();
  const snapshotRefreshNonce = useShellSnapshotRefreshNonce({
    additionalRefreshNonce: manualRefreshNonce,
    invalidation: {
      planes: ["discovery", "execution"],
      scope: routeScope,
    },
    invalidationOptions: {
      since: initialSnapshot?.generatedAt ?? null,
    },
  });
  const { error, loadState, records } = usePortfolioState(
    snapshotRefreshNonce,
    initialPreferences,
    initialSnapshot
  );
  const scopeActive = hasShellRouteScope(routeScope);

  const routeScopedRecords = useMemo(
    () =>
      records.filter((record) => matchesShellChainRouteScope(record, routeScope)),
    [records, routeScope]
  );

  const filteredRecords = useMemo(() => {
    if (!query.trim()) {
      return routeScopedRecords;
    }
    return routeScopedRecords.filter((record) => matchShellChainQuery(record, query));
  }, [query, routeScopedRecords]);

  return (
    <ShellPage className="max-w-[1600px]">
      <ShellHero
        title="Portfolio"
        actions={<ShellRefreshButton type="button" onClick={refresh} busy={isRefreshing} />}
      />

      <div className="flex h-8 max-w-md items-center gap-2 rounded-md border border-border px-2.5">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter portfolio..."
          className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground outline-none"
        />
      </div>

      {loadState === "loading" && records.length === 0 ? (
        <ShellLoadingState description="Loading cross-plane portfolio..." className="py-10" />
      ) : null}

      {error ? (
        <ShellStatusBanner tone="danger">{error}</ShellStatusBanner>
      ) : null}

      {loadState !== "loading" && filteredRecords.length === 0 ? (
        <ShellEmptyState
          centered
          className="py-10"
          description={
            scopeActive
              ? "No portfolio records match the current execution-chain scope and filter."
              : "No portfolio items yet. Connect Discovery ideas to Execution projects."
          }
        />
      ) : null}

      {filteredRecords.length > 0 ? (
        <div className="rounded-md border border-border px-4">
          {filteredRecords.map((record) =>
            record.kind === "linked" ? (
              <LinkedPortfolioRow
                key={record.key}
                record={record}
                routeScope={routeScope}
              />
            ) : record.kind === "intake-linked" ? (
              <IntakePortfolioRow
                key={record.key}
                record={record}
                routeScope={routeScope}
              />
            ) : (
              <OrphanProjectRow
                key={record.key}
                record={record}
                routeScope={routeScope}
              />
            )
          )}
        </div>
      ) : null}
    </ShellPage>
  );
}
