"use client";

import type { ShellPreferences } from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import { Briefcase, Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  ShellActionLink,
  ShellEmptyState,
  ShellHero,
  ShellPage,
  ShellRefreshButton,
  ShellSectionCard,
  ShellSummaryCard,
} from "@/components/shell/shell-screen-primitives";
import {
  ShellRecordActionBar,
  ShellRecordBody,
  ShellRecordCard,
  ShellRecordHeader,
  ShellRecordMeta,
} from "@/components/shell/shell-record-primitives";
import { SkeletonList } from "@/components/shell/shell-skeleton";
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
import { safeFormatShortDate } from "@/lib/format-utils";

type PortfolioRouteScope = ShellRouteScope;

function formatShortDate(value?: string | null): string | null {
  const result = safeFormatShortDate(value ?? null, "");
  return result === "" ? null : result;
}

function formatCost(usd: number) {
  if (usd === 0) return null;
  return `$${usd.toFixed(2)}`;
}

function toneForProjectStatus(status?: string | null) {
  if (status === "running") return "success" as const;
  if (status === "paused" || status === "pause_requested") return "warning" as const;
  if (status === "failed" || status === "cancel_requested" || status === "cancelled") {
    return "danger" as const;
  }
  if (status === "completed") return "info" as const;
  return "neutral" as const;
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
    <ShellRecordCard className="border-border/70 bg-[color:var(--shell-control-bg)] shadow-none">
      <ShellRecordHeader
        badges={
          <>
            <Badge tone="neutral">{executionSourceLabel(record.project?.task_source?.source_kind ?? "idea")}</Badge>
            {record.project ? (
              <Badge tone={toneForProjectStatus(record.project.status)}>{record.project.status}</Badge>
            ) : (
              <Badge tone="neutral">linked</Badge>
            )}
          </>
        }
        title={record.idea.title}
        description={
          metaParts.length > 0 ? metaParts.join(" · ") : "Linked idea record"
        }
        accessory={
          dateText ? (
            <span className="text-[11px] leading-5 text-muted-foreground">{dateText}</span>
          ) : null
        }
      />
      <ShellRecordBody className="space-y-2 p-3 pt-2">
        <LinkedLifecycleBar
          hasBrief={record.brief !== null}
          hasProject={record.project !== null}
          hasOutcome={record.outcome !== null}
        />
        <ShellRecordMeta className="gap-x-2.5 gap-y-0.5 text-[11px] leading-4">
          <span>{record.idea.latest_stage}</span>
          {record.project ? <span>{record.project.status}</span> : null}
          {storiesText ? <span>{storiesText}</span> : null}
          {costText ? <span>{costText}</span> : null}
        </ShellRecordMeta>
        <ShellRecordActionBar className="gap-1.5">
          <ShellActionLink href={ideaHref} label="Idea" />
          {projectHref ? (
            <ShellActionLink href={projectHref} label="Project" />
          ) : null}
          <ShellActionLink
            href={buildShellEntrySettingsHref(
              scopedRecordRoute,
              shellSettingsParityTargetsFromChainRecord(record)
            )}
            label="Settings"
          />
        </ShellRecordActionBar>
      </ShellRecordBody>
    </ShellRecordCard>
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
    <ShellRecordCard className="border-border/70 bg-[color:var(--shell-control-bg)] shadow-none">
      <ShellRecordHeader
        badges={<Badge tone="warning">orphan project</Badge>}
        title={record.project.name}
        description={
          metaParts.length > 0 ? metaParts.join(" · ") : "Project without a linked idea"
        }
        accessory={
          dateText ? (
            <span className="text-[11px] leading-5 text-muted-foreground">{dateText}</span>
          ) : null
        }
      />
      <ShellRecordBody className="space-y-2 p-3 pt-2">
        <OrphanLifecycleBar />
        <ShellRecordMeta className="gap-x-2.5 gap-y-0.5 text-[11px] leading-4">
          <span>{record.project.status}</span>
          {storiesText ? <span>{storiesText}</span> : null}
        </ShellRecordMeta>
        <ShellRecordActionBar className="gap-1.5">
          <ShellActionLink href={projectHref} label="Project" />
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
        </ShellRecordActionBar>
      </ShellRecordBody>
    </ShellRecordCard>
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
    <ShellRecordCard className="border-border/70 bg-[color:var(--shell-control-bg)] shadow-none">
      <ShellRecordHeader
        badges={<Badge tone="neutral">intake-linked</Badge>}
        title={record.intakeSession?.title ?? `Intake ${record.intakeSessionId}`}
        description={
          metaParts.length > 0 ? metaParts.join(" · ") : "Intake record"
        }
        accessory={
          dateText ? (
            <span className="text-[11px] leading-5 text-muted-foreground">{dateText}</span>
          ) : null
        }
      />
      <ShellRecordBody className="space-y-2 p-3 pt-2">
        <IntakeLifecycleBar hasProject={record.project !== null} />
        <ShellRecordMeta className="gap-x-2.5 gap-y-0.5 text-[11px] leading-4">
          <span>{executionSourceLabel(sourceKind)}</span>
          <span>{record.project?.status ?? "no project"}</span>
          {storiesText ? <span>{storiesText}</span> : null}
        </ShellRecordMeta>
        <ShellRecordActionBar className="gap-1.5">
          <ShellActionLink href={intakeHref} label="Intake" />
          {projectHref ? (
            <ShellActionLink href={projectHref} label="Project" />
          ) : null}
          <ShellActionLink
            href={buildShellEntrySettingsHref(
              scopedRecordRoute,
              shellSettingsParityTargetsFromChainRecord(record)
            )}
            label="Settings"
          />
        </ShellRecordActionBar>
      </ShellRecordBody>
    </ShellRecordCard>
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

  const routeScopedRecords = useMemo(
    () =>
      records.filter((record) => matchesShellChainRouteScope(record, routeScope)),
    [records, routeScope]
  );
  const linkedRecordCount = useMemo(
    () => routeScopedRecords.filter((record) => record.kind === "linked").length,
    [routeScopedRecords]
  );
  const intakeLinkedRecordCount = useMemo(
    () =>
      routeScopedRecords.filter((record) => record.kind === "intake-linked").length,
    [routeScopedRecords]
  );
  const orphanRecordCount = useMemo(
    () =>
      routeScopedRecords.filter((record) => record.kind === "orphan-project").length,
    [routeScopedRecords]
  );

  const filteredRecords = useMemo(() => {
    if (!query.trim()) {
      return routeScopedRecords;
    }
    return routeScopedRecords.filter((record) => matchShellChainQuery(record, query));
  }, [query, routeScopedRecords]);

  return (
    <ShellPage className="max-w-[1600px] gap-5 py-5">
      <ShellHero
        title="Portfolio"
        description="Linked ideas, intake sessions, and execution projects in one route-scoped view."
        meta={
          <>
            <span>{routeScopedRecords.length} records</span>
            <span>{linkedRecordCount} linked</span>
            <span>{intakeLinkedRecordCount} intake-linked</span>
            <span>{orphanRecordCount} orphan projects</span>
          </>
        }
        actions={
          <>
            <ShellActionLink href="/discovery" label="Discovery" />
            <ShellActionLink href="/execution" label="Execution" />
            <ShellRefreshButton type="button" onClick={refresh} busy={isRefreshing} compact />
          </>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[0.95fr_1.05fr]">
        <ShellSummaryCard
          title="Scope"
          description="Record mix in this slice."
          items={[
            {
              key: "linked",
              label: "Linked",
              detail: "Ideas already tied to projects.",
              count: linkedRecordCount,
            },
            {
              key: "intake-linked",
              label: "Intake-linked",
              detail: "Intake sessions that promoted into projects.",
              count: intakeLinkedRecordCount,
            },
            {
              key: "orphan",
              label: "Orphans",
              detail: "Projects without a linked idea.",
              count: orphanRecordCount,
            },
          ]}
          className="bg-card/60"
        />
        <ShellSectionCard
          title="Filter"
          description="Search titles, statuses, and source kinds."
          className="space-y-3"
          contentClassName="space-y-3 pt-0"
        >
          <div className="flex h-8 max-w-md items-center gap-2 rounded-[8px] border border-border/70 bg-card px-2.5 focus-within:ring-2 focus-within:ring-primary/20">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter portfolio"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 text-[12px] text-muted-foreground">
            <span>{routeScopedRecords.length} total</span>
            <span>·</span>
            <span>{filteredRecords.length} visible</span>
          </div>
        </ShellSectionCard>
      </div>

      {loadState === "loading" && records.length === 0 ? (
        <SkeletonList rows={6} className="py-4" />
      ) : null}

      {loadState !== "loading" && (error || filteredRecords.length === 0) ? (
        <ShellEmptyState
          centered
          title={error ? "Portfolio unavailable" : "No records"}
          description={
            error
              ? "Refresh and try again."
              : "Widen the filter or jump to Discovery to create the next link."
          }
          icon={<Briefcase className="h-5 w-5" />}
          className="py-10"
        />
      ) : null}

      {filteredRecords.length > 0 ? (
        <ShellSectionCard
          title="Records"
          description={`${filteredRecords.length} matches`}
          className="space-y-3"
          contentClassName="overflow-hidden rounded-[10px] border border-border/70 bg-card"
        >
          <div className="divide-y divide-border/70">
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
        </ShellSectionCard>
      ) : null}
    </ShellPage>
  );
}
