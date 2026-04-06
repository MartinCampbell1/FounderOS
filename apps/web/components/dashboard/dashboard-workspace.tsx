"use client";

import {
  type ShellPreferences,
  type GatewayHealthSnapshot,
  type UpstreamHealthRecord,
} from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import { cn } from "@founderos/ui/lib/utils";
import {
  Activity,
  BriefcaseBusiness,
  Inbox,
  Orbit,
  PencilLine,
  Plus,
  ShieldAlert,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, type ReactNode } from "react";

import {
  ShellRecordActionBar,
  ShellRecordSection,
} from "@/components/shell/shell-record-primitives";
import {
  ShellActionLink,
  ShellEmptyState,
  ShellHero,
  ShellPage,
  ShellRefreshButton,
  ShellSectionCard,
} from "@/components/shell/shell-screen-primitives";
import { SkeletonList, SkeletonStats } from "@/components/shell/shell-skeleton";
import {
  buildShellAttentionRecords,
  executionSourceLabel,
  executionSourceTone,
  isShellExecutionAttentionRecord,
  matchesAttentionRouteScope,
} from "@/lib/attention-records";
import {
  buildShellChainGraphStats,
  matchesShellChainRouteScope,
  resolveScopedShellChainIntakeSession,
  resolveScopedShellChainIntakeSessionId,
  resolveScopedShellChainProject,
  shellChainRouteScope,
} from "@/lib/chain-graph";
import {
  discoveryAuthoringGapLabel,
  discoveryAuthoringStatusTone,
} from "@/lib/discovery-authoring";
import {
  buildExecutionReviewRollupFromAttentionRecords,
  describeExecutionReviewRollup,
} from "@/lib/execution-review-model";
import {
  resolveReviewMemoryBucket,
} from "@/lib/review-memory";
import { buildShellReviewPressureSummary } from "@/lib/review-pressure";
import { emptyShellReviewCenterSnapshot } from "@/lib/review-center";
import {
  buildRememberedShellReviewEntryHrefs,
} from "@/lib/shell-entry-hrefs";
import { fetchShellDashboardSnapshot } from "@/lib/shell-snapshot-client";
import { useShellSnapshotRefreshNonce } from "@/lib/use-shell-snapshot-refresh-nonce";
import {
  buildDiscoveryIdeaAuthoringScopeHref,
  buildDiscoveryAuthoringScopeHref,
  buildDiscoveryIdeaScopeHref,
  buildDiscoveryIdeasScopeHref,
  buildDiscoveryScopeHref,
  buildDiscoverySessionScopeHref,
  buildExecutionIntakeScopeHref,
  buildExecutionProjectScopeHref,
  buildExecutionReviewScopeHref,
  buildExecutionScopeHref,
  buildInboxScopeHref,
  hasShellRouteScope as hasRouteScope,
  resolveScopedIntakeSessionId,
  routeScopeFromExecutionIntakeSession,
  routeScopeFromExecutionProject,
  type ShellRouteScope,
} from "@/lib/route-scope";
import { getShellPollInterval, useShellPreferences } from "@/lib/shell-preferences";
import { useShellManualRefresh } from "@/lib/use-shell-manual-refresh";
import { useReviewPressureActions } from "@/lib/use-review-pressure-actions";
import type { ShellDashboardSnapshot } from "@/lib/dashboard";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";
import { truncate } from "@/lib/format-utils";

type DashboardRouteScope = ShellRouteScope;

function formatDate(value?: string | number | null) {
  if (!value) return "n/a";
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "n/a";
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatServiceStatus(value: GatewayHealthSnapshot["status"] | UpstreamHealthRecord["status"]) {
  return value === "ok" ? "online" : value;
}

function toneForServiceStatus(value: GatewayHealthSnapshot["status"] | UpstreamHealthRecord["status"]) {
  if (value === "ok") return "success" as const;
  if (value === "degraded") return "warning" as const;
  return "danger" as const;
}

function toneForProjectStatus(status: string) {
  if (status === "running") return "success" as const;
  if (status === "paused") return "warning" as const;
  if (status === "failed") return "danger" as const;
  if (status === "completed") return "info" as const;
  return "neutral" as const;
}

function toneForSessionStatus(status: string) {
  if (status === "running") return "success" as const;
  if (status === "paused" || status === "pause_requested") return "warning" as const;
  if (status === "failed" || status === "cancel_requested" || status === "cancelled") {
    return "danger" as const;
  }
  return "neutral" as const;
}

function toneForIdeaStage(stage: string) {
  if (stage === "executed") return "success" as const;
  if (stage === "handed_off") return "info" as const;
  if (stage === "debated" || stage === "simulated") return "warning" as const;
  return "neutral" as const;
}

function isActiveSession(status: string) {
  return !["completed", "failed", "cancelled"].includes(status);
}

const EMPTY_DASHBOARD_SNAPSHOT: ShellDashboardSnapshot = {
  generatedAt: "",
  health: null,
  sessions: [],
  ideas: [],
  discoveryFeed: {
    items: [],
    summary: {
      open_count: 0,
      resolved_count: 0,
      stale_count: 0,
      action_required_count: 0,
      kinds: {},
      subject_kinds: {},
    },
  },
  projects: [],
  intakeSessions: [],
  issues: [],
  approvals: [],
  runtimes: [],
  chains: [],
  reviewCenter: emptyShellReviewCenterSnapshot(),
  errors: [],
  loadState: "ready",
};

function useDashboardState(
  refreshNonce: number,
  initialPreferences?: ShellPreferences,
  initialSnapshot?: ShellDashboardSnapshot | null
) {
  const { preferences } = useShellPreferences(initialPreferences);
  const pollInterval = getShellPollInterval("dashboard", preferences.refreshProfile);
  const loadSnapshot = useCallback(() => fetchShellDashboardSnapshot(), []);
  const selectLoadState = useCallback(
    (snapshot: ShellDashboardSnapshot) => snapshot.loadState,
    []
  );
  const { loadState, snapshot } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_DASHBOARD_SNAPSHOT,
    initialSnapshot,
    refreshNonce,
    pollIntervalMs: pollInterval,
    loadSnapshot,
    selectLoadState,
  });

  return {
    approvals: snapshot.approvals,
    discoveryFeed: snapshot.discoveryFeed,
    errors: snapshot.errors,
    health: snapshot.health,
    ideas: snapshot.ideas,
    issues: snapshot.issues,
    loadState,
    projects: snapshot.projects,
    reviewCenter: snapshot.reviewCenter,
    intakeSessions: snapshot.intakeSessions,
    runtimes: snapshot.runtimes,
    sessions: snapshot.sessions,
    chains: snapshot.chains,
  };
}

function AvailabilityCard({
  label,
  service,
}: {
  label: string;
  service: UpstreamHealthRecord | null;
}) {
  return (
    <ShellSectionCard
      title={label}
      titleClassName="text-lg"
      actions={
        <Badge tone={service ? toneForServiceStatus(service.status) : "danger"}>
          {service ? formatServiceStatus(service.status) : "offline"}
        </Badge>
      }
      description={service?.baseUrl || "No response from gateway health route."}
      headerClassName="gap-3 pb-3"
      contentClassName="space-y-2 text-sm leading-6 text-muted-foreground"
    >
        <div>
          {service?.details
            ? truncate(service.details, 140)
            : "The shell can still render partial data when this upstream is unavailable."}
        </div>
        {typeof service?.latencyMs === "number" ? <div>Latency {service.latencyMs} ms</div> : null}
    </ShellSectionCard>
  );
}

function EmptyState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return <ShellEmptyState title={title} description={detail} />;
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <SkeletonStats count={5} />
      <SkeletonList rows={5} />
    </div>
  );
}

function DashboardSummaryPanel({
  icon,
  title,
  value,
  detail,
  actions,
  children,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  value?: ReactNode;
  detail?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <ShellRecordSection className={className}>
      <div className="flex items-center gap-2 text-[13px] font-medium leading-5 text-foreground">
        {icon ? <span className="shrink-0">{icon}</span> : null}
        <span>{title}</span>
      </div>
      {value !== undefined && value !== null ? (
        <div className="mt-3 text-[28px] font-medium leading-none tracking-[-0.03em] text-foreground">
          {value}
        </div>
      ) : null}
      {detail ? (
        <div className="mt-2 text-[13px] leading-6 text-muted-foreground">{detail}</div>
      ) : null}
      {children ? <div className="mt-3">{children}</div> : null}
      {actions ? <ShellRecordActionBar className="mt-3">{actions}</ShellRecordActionBar> : null}
    </ShellRecordSection>
  );
}

export function DashboardWorkspace({
  initialSnapshot,
  initialPreferences,
  routeScope = { projectId: "", intakeSessionId: "" },
}: {
  initialSnapshot?: ShellDashboardSnapshot | null;
  initialPreferences?: ShellPreferences;
  routeScope?: DashboardRouteScope;
}) {
  const { isRefreshing, refresh, refreshNonce } = useShellManualRefresh();
  const snapshotRefreshNonce = useShellSnapshotRefreshNonce({
    baseRefreshNonce: refreshNonce,
    invalidation: {
      planes: ["discovery", "execution"],
      scope: routeScope,
    },
    invalidationOptions: {
      since: initialSnapshot?.generatedAt ?? null,
    },
  });
  const {
    approvals,
    chains,
    discoveryFeed,
    errors,
    health,
    ideas,
    issues,
    intakeSessions,
    loadState,
    projects,
    reviewCenter,
    runtimes,
    sessions,
  } = useDashboardState(
    snapshotRefreshNonce,
    initialPreferences,
    initialSnapshot
  );
  const { preferences } = useShellPreferences(initialPreferences);
  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  );
  const intakeSessionsById = useMemo(
    () => new Map(intakeSessions.map((session) => [session.id, session])),
    [intakeSessions]
  );
  const intakeSessionsByProjectId = useMemo(
    () =>
      new Map(
        intakeSessions
          .filter((session) => Boolean(session.linked_project_id))
          .map((session) => [session.linked_project_id, session])
      ),
    [intakeSessions]
  );
  const scopedChainProject = useMemo(
    () => resolveScopedShellChainProject(chains, routeScope),
    [chains, routeScope]
  );
  const scopedProject = routeScope.projectId
    ? projectsById.get(routeScope.projectId) ?? scopedChainProject
    : scopedChainProject;
  const scopedChainIntakeSession = useMemo(
    () => resolveScopedShellChainIntakeSession(chains, routeScope),
    [chains, routeScope]
  );
  const derivedScopedChainIntakeSessionId = useMemo(
    () => resolveScopedShellChainIntakeSessionId(chains, routeScope),
    [chains, routeScope]
  );
  const derivedScopedIntakeSessionId = resolveScopedIntakeSessionId(routeScope, {
    project: scopedProject,
    linkedIntakeSessionId: routeScope.projectId
      ? intakeSessionsByProjectId.get(routeScope.projectId)?.id ||
        derivedScopedChainIntakeSessionId
      : "",
    projectId: routeScope.projectId,
  });
  const scopedIntakeSession = derivedScopedIntakeSessionId
    ? intakeSessionsById.get(derivedScopedIntakeSessionId) ?? scopedChainIntakeSession
    : scopedChainIntakeSession;
  const scopedProjects = useMemo(() => {
    if (!hasRouteScope(routeScope)) {
      return projects;
    }
    if (routeScope.projectId) {
      return scopedProject ? [scopedProject] : [];
    }
    return projects.filter(
      (project) =>
        project.task_source?.source_kind === "intake_session" &&
        project.task_source.external_id === derivedScopedIntakeSessionId
    );
  }, [
    derivedScopedIntakeSessionId,
    projects,
    routeScope,
    scopedProject,
  ]);
  const scopedProjectIds = useMemo(
    () => new Set(scopedProjects.map((project) => project.id)),
    [scopedProjects]
  );
  const scopedIntakeSessions = useMemo(() => {
    if (!hasRouteScope(routeScope)) {
      return intakeSessions;
    }
    if (derivedScopedIntakeSessionId) {
      return scopedIntakeSession ? [scopedIntakeSession] : [];
    }
    if (routeScope.projectId) {
      return intakeSessions.filter(
        (session) => session.linked_project_id === routeScope.projectId
      );
    }
    return [];
  }, [
    derivedScopedIntakeSessionId,
    intakeSessions,
    routeScope,
    scopedIntakeSession,
  ]);
  const scopedApprovals = useMemo(
    () =>
      hasRouteScope(routeScope)
        ? approvals.filter((approval) => scopedProjectIds.has(approval.project_id))
        : approvals,
    [approvals, routeScope, scopedProjectIds]
  );
  const scopedRuntimes = useMemo(
    () =>
      hasRouteScope(routeScope)
        ? runtimes.filter((runtime) => scopedProjectIds.has(runtime.project_id))
        : runtimes,
    [runtimes, routeScope, scopedProjectIds]
  );
  const attentionScope = useMemo(
    () => ({
      projectId: routeScope.projectId,
      intakeSessionId: derivedScopedIntakeSessionId,
    }),
    [derivedScopedIntakeSessionId, routeScope.projectId]
  );
  const routeScopedChains = useMemo(
    () => chains.filter((record) => matchesShellChainRouteScope(record, attentionScope)),
    [attentionScope, chains]
  );
  const linkedChainsByIdeaId = useMemo(
    () =>
      new Map(
        routeScopedChains
          .filter((record) => record.kind === "linked")
          .map((record) => [record.idea.idea_id, record])
      ),
    [routeScopedChains]
  );
  const linkedDiscoveryChains = useMemo(
    () => routeScopedChains.filter((record) => record.kind === "linked"),
    [routeScopedChains]
  );
  const chainStats = useMemo(
    () => buildShellChainGraphStats(routeScopedChains),
    [routeScopedChains]
  );
  const linkedChainCount = chainStats.linkedCount + chainStats.intakeLinkedCount;
  const authoringGapChains = useMemo(
    () =>
      linkedDiscoveryChains
        .filter((record) => record.authoring.gapCount > 0)
        .slice(0, 4),
    [linkedDiscoveryChains]
  );

  const activeSessions = useMemo(
    () => sessions.filter((session) => isActiveSession(session.status)),
    [sessions]
  );
  const handedOffIdeas = useMemo(
    () =>
      ideas.filter((idea) => ["handed_off", "executed"].includes(idea.latest_stage)).length,
    [ideas]
  );
  const runningProjects = useMemo(
    () => scopedProjects.filter((project) => project.status === "running"),
    [scopedProjects]
  );
  const intakeOriginProjects = useMemo(
    () =>
      scopedProjects.filter(
        (project) => project.task_source?.source_kind === "intake_session"
      ),
    [scopedProjects]
  );
  const executionBriefProjects = useMemo(
    () =>
      scopedProjects.filter(
        (project) => project.task_source?.source_kind === "execution_brief"
      ),
    [scopedProjects]
  );
  const localBriefProjects = useMemo(
    () =>
      scopedProjects.filter((project) => {
        const sourceKind = project.task_source?.source_kind || "local_brief";
        return sourceKind === "local_brief";
      }),
    [scopedProjects]
  );
  const pausedProjects = useMemo(
    () => scopedProjects.filter((project) => project.status === "paused"),
    [scopedProjects]
  );
  const linkedIntakeSessions = useMemo(
    () => scopedIntakeSessions.filter((session) => Boolean(session.linked_project_id)),
    [scopedIntakeSessions]
  );
  const prdReadyIntakeSessions = useMemo(
    () => scopedIntakeSessions.filter((session) => session.prd_ready),
    [scopedIntakeSessions]
  );
  const activeIntakeDrafts = useMemo(
    () =>
      scopedIntakeSessions.filter(
        (session) => !session.linked_project_id && !session.prd_ready
      ),
    [scopedIntakeSessions]
  );
  const scopedAttentionRecords = useMemo(
    () =>
      buildShellAttentionRecords({
        discoveryFeed,
        projects,
        intakeSessions,
        approvals,
        issues,
        runtimes,
        chains,
        routeScope,
      }).filter((record) => matchesAttentionRouteScope(record, attentionScope)),
    [
      approvals,
      attentionScope,
      chains,
      discoveryFeed,
      intakeSessions,
      issues,
      projects,
      routeScope,
      runtimes,
    ]
  );
  const attentionRecords = useMemo(
    () => scopedAttentionRecords.slice(0, 8),
    [scopedAttentionRecords]
  );
  const executionReviewRecords = useMemo(
    () => scopedAttentionRecords.filter(isShellExecutionAttentionRecord),
    [scopedAttentionRecords]
  );
  const executionReviewRollup = useMemo(
    () => buildExecutionReviewRollupFromAttentionRecords(executionReviewRecords),
    [executionReviewRecords]
  );
  const scopedDiscoveryReviewRecords = useMemo(() => {
    if (!hasRouteScope(attentionScope)) {
      return reviewCenter.discovery.records;
    }

    return reviewCenter.discovery.records.filter(
      (record) => {
        if (!record.chain) {
          return false;
        }
        return matchesShellChainRouteScope(record.chain, attentionScope);
      }
    );
  }, [attentionScope, reviewCenter.discovery.records]);
  const scopedExecutionReviewRecords = useMemo(
    () =>
      reviewCenter.execution.records.filter((record) =>
        matchesAttentionRouteScope(record, attentionScope)
      ),
    [attentionScope, reviewCenter.execution.records]
  );
  const reviewPressure = useMemo(
    () =>
      buildShellReviewPressureSummary({
        discoveryRecords: scopedDiscoveryReviewRecords,
        executionRecords: scopedExecutionReviewRecords,
        chains: routeScopedChains,
      }),
    [routeScopedChains, scopedDiscoveryReviewRecords, scopedExecutionReviewRecords]
  );
  const {
    busyActionKey: reviewPressureBusyActionKey,
    errorMessage: reviewPressureErrorMessage,
    runHotspotAction,
    runLaneAction,
    statusMessage: reviewPressureStatusMessage,
  } = useReviewPressureActions({
    discoveryRecords: scopedDiscoveryReviewRecords,
    executionRecords: scopedExecutionReviewRecords,
    routeScope: attentionScope,
    source: "dashboard-review-pressure",
  });
  const scopedDiscoveryMemoryChainRecords = useMemo(
    () =>
      scopedDiscoveryReviewRecords.flatMap((record) =>
        record.chain
          ? [
              {
                kind: record.chain.kind,
                intakeSessionId: record.chain.intakeSessionId,
                projectId: record.chain.project?.id || "",
                project: null,
              },
            ]
          : []
      ),
    [scopedDiscoveryReviewRecords]
  );
  const reviewMemoryBucket = useMemo(
    () =>
      resolveReviewMemoryBucket({
        scope: attentionScope,
        chainRecords: [...scopedDiscoveryMemoryChainRecords, ...routeScopedChains],
        executionChainKinds: scopedExecutionReviewRecords.map(
          (record) => record.source.chainKind
        ),
      }),
    [
      attentionScope,
      routeScopedChains,
      scopedDiscoveryMemoryChainRecords,
      scopedExecutionReviewRecords,
    ]
  );
  const dashboardReviewEntryHrefs = useMemo(
    () =>
      buildRememberedShellReviewEntryHrefs({
        scope: attentionScope,
        preferences,
        bucket: reviewMemoryBucket,
      }),
    [attentionScope, preferences, reviewMemoryBucket]
  );
  const scopedDiscoveryCount = useMemo(
    () =>
      scopedAttentionRecords.filter((record) => record.type === "discovery").length,
    [scopedAttentionRecords]
  );
  const scopedIssueCount = useMemo(
    () => scopedAttentionRecords.filter((record) => record.type === "issue").length,
    [scopedAttentionRecords]
  );
  const scopedApprovalCount = useMemo(
    () =>
      scopedAttentionRecords.filter((record) => record.type === "approval").length,
    [scopedAttentionRecords]
  );
  const scopedRuntimeCount = useMemo(
    () =>
      scopedAttentionRecords.filter((record) => record.type === "runtime").length,
    [scopedAttentionRecords]
  );
  const chainLinkedDiscoveryAttentionCount = useMemo(
    () =>
      scopedAttentionRecords.filter(
        (record) => record.type === "discovery" && Boolean(record.chain)
      ).length,
    [scopedAttentionRecords]
  );
  const chainLinkedDiscoveryAttentionRecords = useMemo(
    () =>
      scopedAttentionRecords
        .filter(
          (
            record
          ): record is Extract<
            typeof scopedAttentionRecords[number],
            { type: "discovery" }
          > => record.type === "discovery" && Boolean(record.chain)
        )
        .slice(0, 2),
    [scopedAttentionRecords]
  );

  const totalAttention = scopedAttentionRecords.length;

  return (
    <ShellPage className="max-w-5xl gap-6 py-5">
      {/* ── Connection status ─────────────────────────── */}
      {(() => {
        const qOk = health?.services.quorum.status === "ok";
        const aOk = health?.services.autopilot.status === "ok";
        const anyOffline = health !== null && (!qOk || !aOk);
        return (
          <div className={cn(
            "flex items-center justify-between rounded-lg px-3.5 py-2.5 text-[13px]",
            anyOffline
              ? "border border-red-200/60 bg-red-50/30 dark:border-red-500/15 dark:bg-red-950/20"
              : "border border-border/40 bg-muted/20"
          )}>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${health === null ? "bg-muted-foreground/20" : qOk ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]" : "bg-red-400 dark:bg-red-500"}`} />
                <span className={qOk ? "text-muted-foreground" : "text-red-600 dark:text-red-400"}>Quorum {health === null ? "connecting\u2026" : qOk ? "connected" : "offline"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${health === null ? "bg-muted-foreground/20" : aOk ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]" : "bg-red-400 dark:bg-red-500"}`} />
                <span className={aOk ? "text-muted-foreground" : "text-red-600 dark:text-red-400"}>Autopilot {health === null ? "connecting\u2026" : aOk ? "connected" : "offline"}</span>
              </div>
            </div>
            <ShellRefreshButton type="button" onClick={refresh} busy={isRefreshing} compact />
          </div>
        );
      })()}

      {loadState === "loading" && sessions.length === 0 && projects.length === 0 ? (
        <LoadingState />
      ) : null}

      {/* ── Stats row ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Link href={buildDiscoveryScopeHref(routeScope)} className="group rounded-lg border border-border/80 bg-card px-4 py-3.5 transition-all duration-150 hover:border-primary/30 hover:shadow-sm">
          <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-md bg-violet-500/10 text-violet-600 dark:bg-violet-400/10 dark:text-violet-400">
            <Orbit className="h-3.5 w-3.5" />
          </div>
          <div className="shell-stat-value">{activeSessions.length}</div>
          <div className="mt-0.5 text-[12px] font-medium text-muted-foreground">Active sessions</div>
        </Link>
        <Link href={buildDiscoveryIdeasScopeHref(routeScope)} className="group rounded-lg border border-border/80 bg-card px-4 py-3.5 transition-all duration-150 hover:border-primary/30 hover:shadow-sm">
          <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-md bg-violet-500/8 text-violet-500 dark:bg-violet-400/10 dark:text-violet-400">
            <PencilLine className="h-3.5 w-3.5" />
          </div>
          <div className="shell-stat-value">{ideas.length}</div>
          <div className="mt-0.5 text-[12px] font-medium text-muted-foreground">Ideas</div>
        </Link>
        <Link href={buildExecutionScopeHref(routeScope)} className="group rounded-lg border border-border/80 bg-card px-4 py-3.5 transition-all duration-150 hover:border-primary/30 hover:shadow-sm">
          <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-md bg-indigo-500/8 text-indigo-500 dark:bg-indigo-400/10 dark:text-indigo-400">
            <Workflow className="h-3.5 w-3.5" />
          </div>
          <div className="shell-stat-value">{runningProjects.length}</div>
          <div className="mt-0.5 text-[12px] font-medium text-muted-foreground">Running projects</div>
        </Link>
        <Link href={buildExecutionIntakeScopeHref(undefined, routeScope)} className="group rounded-lg border border-border/80 bg-card px-4 py-3.5 transition-all duration-150 hover:border-primary/30 hover:shadow-sm">
          <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-md bg-slate-500/8 text-slate-500 dark:bg-slate-400/10 dark:text-slate-400">
            <BriefcaseBusiness className="h-3.5 w-3.5" />
          </div>
          <div className="shell-stat-value">{scopedIntakeSessions.length}</div>
          <div className="mt-0.5 text-[12px] font-medium text-muted-foreground">Intake sessions</div>
        </Link>
        <Link href={buildInboxScopeHref({ projectId: routeScope.projectId, intakeSessionId: derivedScopedIntakeSessionId })} className="group rounded-lg border border-border/80 bg-card px-4 py-3.5 transition-all duration-150 hover:border-primary/30 hover:shadow-sm">
          <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-md bg-red-500/8 text-red-500 dark:bg-red-400/10 dark:text-red-400">
            <ShieldAlert className="h-3.5 w-3.5" />
          </div>
          <div className="shell-stat-value">{totalAttention}</div>
          <div className="mt-0.5 text-[12px] font-medium text-muted-foreground">Open attention</div>
        </Link>
      </div>

      {/* Connection status dots above are sufficient — no banner needed */}

      {/* ── Recent sessions ───────────────────────────── */}
      {sessions.length > 0 ? (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Recent sessions</h3>
            <ShellActionLink href={buildDiscoveryScopeHref(routeScope)} label="View all" />
          </div>
          <div className="divide-y divide-border rounded-lg border border-border">
            {sessions.slice(0, 5).map((session) => (
              <Link
                key={session.id}
                href={buildDiscoverySessionScopeHref(session.id, routeScope)}
                className="flex items-center justify-between gap-4 px-3.5 py-2.5 transition-colors duration-100 hover:bg-accent/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium text-foreground">
                    {truncate(session.task || session.id, 80)}
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    {session.mode} · {formatDate(session.created_at)}
                  </div>
                </div>
                <Badge tone={toneForSessionStatus(session.status)}>{session.status}</Badge>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Running projects ──────────────────────────── */}
      {scopedProjects.length > 0 ? (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Projects</h3>
            <ShellActionLink href={buildExecutionScopeHref(routeScope)} label="View all" />
          </div>
          <div className="divide-y divide-border rounded-lg border border-border">
            {scopedProjects.slice(0, 5).map((project) => (
              <Link
                key={project.id}
                href={buildExecutionProjectScopeHref(
                  project.id,
                  routeScopeFromExecutionProject(project, routeScope)
                )}
                className="flex items-center justify-between gap-4 px-3.5 py-2.5 transition-colors duration-100 hover:bg-accent/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium text-foreground">
                    {project.name}
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    {project.current_story_title || "No active story"}
                  </div>
                </div>
                <Badge tone={toneForProjectStatus(project.status)}>{project.status}</Badge>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Empty state ───────────────────────────────── */}
      {sessions.length === 0 && scopedProjects.length === 0 && loadState !== "loading" ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Activity className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="text-[14px] font-medium tracking-tight text-foreground">No activity yet</div>
            <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">Start a discovery session or create an execution project to see activity here.</p>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Link href="/discovery" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-[13px] font-medium text-foreground shadow-sm transition-colors hover:bg-accent">
              <Orbit className="h-3.5 w-3.5" />
              Start discovery
            </Link>
            <Link href="/execution/intake" className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90">
              <Plus className="h-3.5 w-3.5" />
              New project
            </Link>
          </div>
        </div>
      ) : null}
    </ShellPage>
  );
}

