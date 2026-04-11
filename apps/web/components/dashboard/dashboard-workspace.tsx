"use client";

import {
  type ShellPreferences,
  type GatewayHealthSnapshot,
  type UpstreamHealthRecord,
} from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import { cn } from "@founderos/ui/lib/utils";
import {
  BriefcaseBusiness,
  Orbit,
  PencilLine,
  ShieldAlert,
  Workflow,
} from "lucide-react";
import { useCallback, useMemo } from "react";

import {
  ShellActionLinkCard,
  ShellActionLink,
  ShellDetailLinkCard,
  ShellHero,
  ShellLinkTileGrid,
  ShellPage,
  ShellRefreshButton,
  ShellSectionCard,
  ShellSummaryCard,
} from "@/components/shell/shell-screen-primitives";
import { SkeletonList, SkeletonStats } from "@/components/shell/shell-skeleton";
import {
  buildShellAttentionRecords,
  matchesAttentionRouteScope,
} from "@/lib/attention-records";
import {
  resolveScopedShellChainIntakeSession,
  resolveScopedShellChainIntakeSessionId,
  resolveScopedShellChainProject,
} from "@/lib/chain-graph";
import { emptyShellReviewCenterSnapshot } from "@/lib/review-center";
import { fetchShellDashboardSnapshot } from "@/lib/shell-snapshot-client";
import { useShellSnapshotRefreshNonce } from "@/lib/use-shell-snapshot-refresh-nonce";
import {
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
  routeScopeFromExecutionProject,
  type ShellRouteScope,
} from "@/lib/route-scope";
import { getShellPollInterval, useShellPreferences } from "@/lib/shell-preferences";
import { useShellManualRefresh } from "@/lib/use-shell-manual-refresh";
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

function LoadingState() {
  return (
    <div className="space-y-6">
      <SkeletonStats count={5} />
      <SkeletonList rows={5} />
    </div>
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
    health,
    ideas,
    issues,
    intakeSessions,
    loadState,
    projects,
    runtimes,
    sessions,
  } = useDashboardState(
    snapshotRefreshNonce,
    initialPreferences,
    initialSnapshot
  );
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
  const attentionScope = useMemo(
    () => ({
      projectId: routeScope.projectId,
      intakeSessionId: derivedScopedIntakeSessionId,
    }),
    [derivedScopedIntakeSessionId, routeScope.projectId]
  );
  const activeSessions = useMemo(
    () => sessions.filter((session) => isActiveSession(session.status)),
    [sessions]
  );
  const runningProjects = useMemo(
    () => scopedProjects.filter((project) => project.status === "running"),
    [scopedProjects]
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
  const totalAttention = scopedAttentionRecords.length;
  const quorumService = health?.services.quorum ?? null;
  const autopilotService = health?.services.autopilot ?? null;
  const hasOfflineService =
    health !== null &&
    (quorumService?.status !== "ok" || autopilotService?.status !== "ok");

  return (
    <ShellPage className="max-w-5xl gap-5 py-5">
      <ShellHero
        title="Dashboard"
        description="Live shell health, route-scoped work, and review pressure in one place."
        meta={
          <>
            <span>{activeSessions.length} active sessions</span>
            <span>{runningProjects.length} running projects</span>
            <span>{totalAttention} open attention</span>
          </>
        }
        actions={
          <>
            <ShellActionLink href={buildDiscoveryScopeHref(routeScope)} label="Discovery" />
            <ShellActionLink href={buildExecutionScopeHref(routeScope)} label="Execution" />
            <ShellRefreshButton type="button" onClick={refresh} busy={isRefreshing} compact />
          </>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
        <ShellSummaryCard
          title="Services"
          description="Gateway and upstream health."
          items={[
            {
              key: "quorum",
              icon: (
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    quorumService === null
                      ? "bg-muted-foreground/20"
                      : quorumService.status === "ok"
                        ? "bg-emerald-500"
                        : "bg-red-500"
                  )}
                />
              ),
              label: "Quorum",
              detail:
                quorumService === null
                  ? "Connecting"
                  : `${formatServiceStatus(quorumService.status)}${
                      quorumService.latencyMs ? ` · ${quorumService.latencyMs} ms` : ""
                    }`,
            },
            {
              key: "autopilot",
              icon: (
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    autopilotService === null
                      ? "bg-muted-foreground/20"
                      : autopilotService.status === "ok"
                        ? "bg-emerald-500"
                        : "bg-red-500"
                  )}
                />
              ),
              label: "Autopilot",
              detail:
                autopilotService === null
                  ? "Connecting"
                  : `${formatServiceStatus(autopilotService.status)}${
                      autopilotService.latencyMs ? ` · ${autopilotService.latencyMs} ms` : ""
                    }`,
            },
          ]}
          className={cn(
            "bg-card/60",
            hasOfflineService ? "border-red-200/50 dark:border-red-500/15" : undefined
          )}
          contentClassName="text-sm leading-6 text-muted-foreground"
        />
        <ShellActionLinkCard
          title="Jump"
          description="Shortcuts to the next shell surface."
          items={[
            { href: buildDiscoveryScopeHref(routeScope), label: "Discovery" },
            { href: buildExecutionScopeHref(routeScope), label: "Execution" },
            {
              href: buildExecutionReviewScopeHref(attentionScope),
              label: "Review",
            },
            {
              href: buildInboxScopeHref({
                projectId: routeScope.projectId,
                intakeSessionId: derivedScopedIntakeSessionId,
              }),
              label: "Inbox",
            },
          ]}
          className="bg-card/60"
        />
      </div>

      <ShellSectionCard
        title="Overview"
        description="Route-scoped counts."
        className="space-y-3"
        contentClassName="pt-0"
      >
        <ShellLinkTileGrid
          className="grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5"
          linkClassName="group rounded-[8px] border border-border/70 bg-card px-3 py-3 transition-all duration-150 hover:-translate-y-px hover:border-primary/25 hover:bg-[color:var(--shell-control-hover)]"
          items={[
            {
              key: "sessions",
              href: buildDiscoveryScopeHref(routeScope),
              icon: (
                <Orbit className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
              ),
              label: (
                <div className="space-y-1">
                  <div className="text-[22px] font-medium leading-none tracking-[-0.03em] text-foreground">
                    {activeSessions.length}
                  </div>
                  <div className="text-[12px] leading-4 text-muted-foreground">
                    Sessions
                  </div>
                </div>
              ),
            },
            {
              key: "ideas",
              href: buildDiscoveryIdeasScopeHref(routeScope),
              icon: (
                <PencilLine className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
              ),
              label: (
                <div className="space-y-1">
                  <div className="text-[22px] font-medium leading-none tracking-[-0.03em] text-foreground">
                    {ideas.length}
                  </div>
                  <div className="text-[12px] leading-4 text-muted-foreground">Ideas</div>
                </div>
              ),
            },
            {
              key: "projects",
              href: buildExecutionScopeHref(routeScope),
              icon: (
                <Workflow className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
              ),
              label: (
                <div className="space-y-1">
                  <div className="text-[22px] font-medium leading-none tracking-[-0.03em] text-foreground">
                    {runningProjects.length}
                  </div>
                  <div className="text-[12px] leading-4 text-muted-foreground">Running</div>
                </div>
              ),
            },
            {
              key: "intake",
              href: buildExecutionIntakeScopeHref(undefined, routeScope),
              icon: (
                <BriefcaseBusiness className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
              ),
              label: (
                <div className="space-y-1">
                  <div className="text-[22px] font-medium leading-none tracking-[-0.03em] text-foreground">
                    {scopedIntakeSessions.length}
                  </div>
                  <div className="text-[12px] leading-4 text-muted-foreground">Intake</div>
                </div>
              ),
            },
            {
              key: "attention",
              href: buildInboxScopeHref({
                projectId: routeScope.projectId,
                intakeSessionId: derivedScopedIntakeSessionId,
              }),
              icon: (
                <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
              ),
              label: (
                <div className="space-y-1">
                  <div className="text-[22px] font-medium leading-none tracking-[-0.03em] text-foreground">
                    {totalAttention}
                  </div>
                  <div className="text-[12px] leading-4 text-muted-foreground">
                    Attention
                  </div>
                </div>
              ),
            },
          ]}
        />
      </ShellSectionCard>

      {loadState === "loading" && sessions.length === 0 && projects.length === 0 ? (
        <LoadingState />
      ) : null}

      {/* ── Recent sessions ───────────────────────────── */}
      {sessions.length > 0 ? (
        <ShellSectionCard
          title="Sessions"
          description="Most recent discovery runs."
          actions={<ShellActionLink href={buildDiscoveryScopeHref(routeScope)} label="All" />}
          className="space-y-3"
          contentClassName="space-y-2.5"
        >
          {sessions.slice(0, 5).map((session) => (
            <ShellDetailLinkCard
              key={session.id}
              href={buildDiscoverySessionScopeHref(session.id, routeScope)}
              title={truncate(session.task || session.id, 80)}
              actions={<Badge tone={toneForSessionStatus(session.status)}>{session.status}</Badge>}
              bodyClassName="space-y-1.5"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] leading-5 text-muted-foreground">
                <span>{session.mode}</span>
                <span className="text-muted-foreground/30">·</span>
                <span>{formatDate(session.created_at)}</span>
              </div>
            </ShellDetailLinkCard>
          ))}
        </ShellSectionCard>
      ) : null}

      {/* ── Running projects ──────────────────────────── */}
      {scopedProjects.length > 0 ? (
        <ShellSectionCard
          title="Projects"
          description="Running and paused work in this scope."
          actions={<ShellActionLink href={buildExecutionScopeHref(routeScope)} label="All" />}
          className="space-y-3"
          contentClassName="space-y-2.5"
        >
          {scopedProjects.slice(0, 5).map((project) => (
            <ShellDetailLinkCard
              key={project.id}
              href={buildExecutionProjectScopeHref(
                project.id,
                routeScopeFromExecutionProject(project, routeScope)
              )}
              title={project.name}
              actions={<Badge tone={toneForProjectStatus(project.status)}>{project.status}</Badge>}
              bodyClassName="space-y-1.5"
            >
              <div className="text-[11px] leading-5 text-muted-foreground">
                {project.current_story_title || "No story"}
              </div>
            </ShellDetailLinkCard>
          ))}
        </ShellSectionCard>
      ) : null}

      {/* ── Empty state ───────────────────────────────── */}
      {sessions.length === 0 && scopedProjects.length === 0 && loadState !== "loading" ? (
        <ShellSectionCard
          title="No activity yet"
          description="Start discovery or create a project to populate this dashboard."
          className="py-2"
          contentClassName="pt-0"
        >
          <div className="flex flex-wrap items-center gap-2">
            <ShellActionLink href="/discovery" label="Discovery" />
            <ShellActionLink href="/execution/intake" label="New project" />
            <ShellActionLink href={buildInboxScopeHref({ projectId: routeScope.projectId, intakeSessionId: derivedScopedIntakeSessionId })} label="Inbox" />
          </div>
        </ShellSectionCard>
      ) : null}
    </ShellPage>
  );
}
