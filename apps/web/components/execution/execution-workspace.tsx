"use client";

import {
  type AutopilotLaunchPreset,
  type AutopilotProjectDetail,
  type AutopilotProjectSummary,
  type AutopilotStory,
  type AutopilotTimelineEvent,
  type ShellPreferences,
} from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import {
  FolderKanban,
  PauseCircle,
  PlayCircle,
  Rocket,
  Search,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  ShellInlineStatus,
  ShellActionStateLabel,
  ShellActionLink,
  ShellDetailCard,
  ShellDetailLinkCard,
  ShellEmptyState,
  ShellHero,
  ShellPage,
  ShellPillButton,
  ShellRefreshButton,
  ShellSectionCard,
  ShellSelectField,
  ShellStatusBanner,
} from "@/components/shell/shell-screen-primitives";
import { SkeletonList } from "@/components/shell/shell-skeleton";
import { cn } from "@founderos/ui/lib/utils";
import {
  launchExecutionProject,
  pauseExecutionProject,
  resumeExecutionProject,
  type ExecutionMutationEffect,
} from "@/lib/execution-mutations";
import {
  buildRememberedExecutionReviewScopeHref,
  resolveReviewMemoryBucket,
} from "@/lib/review-memory";
import { fetchShellExecutionWorkspaceSnapshot } from "@/lib/shell-snapshot-client";
import { useShellMutationRunner } from "@/lib/use-shell-mutation-runner";
import {
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import { useShellManualRefresh } from "@/lib/use-shell-manual-refresh";
import { useShellRouteMutationRunner } from "@/lib/use-shell-route-mutation-runner";
import { useShellSnapshotRefreshNonce } from "@/lib/use-shell-snapshot-refresh-nonce";
import {
  buildExecutionIntakeScopeHref,
  buildExecutionProjectScopeHref,
  hasShellRouteScope,
  intakeSessionIdFromExecutionProject,
  matchesProjectRouteScope,
  routeScopeFromExecutionProject,
  type ShellRouteScope,
} from "@/lib/route-scope";
import type { ShellExecutionWorkspaceSnapshot } from "@/lib/execution";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";

type LoadState = "idle" | "loading" | "ready" | "error";
type ExecutionRouteScope = ShellRouteScope;

const EMPTY_EXECUTION_WORKSPACE_SNAPSHOT: ShellExecutionWorkspaceSnapshot = {
  generatedAt: "",
  projects: [],
  projectsError: null,
  projectsLoadState: "ready",
  launchPresets: [],
  launchPresetsError: null,
  launchPresetsLoadState: "ready",
  project: null,
  projectError: null,
  projectLoadState: "idle",
};

function formatDate(value?: string | null) {
  if (!value) return "No activity yet";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function projectStatusTone(status: string) {
  if (status === "running") return "success" as const;
  if (status === "paused") return "warning" as const;
  if (status === "completed") return "info" as const;
  if (status === "failed") return "danger" as const;
  return "neutral" as const;
}


function useAutopilotProjectsState(
  refreshNonce: number,
  activeProjectId: string | null,
  initialSnapshot?: ShellExecutionWorkspaceSnapshot | null,
  initialPreferences?: ShellPreferences
) {
  const { preferences } = useShellPreferences(initialPreferences);
  const pollInterval = getShellPollInterval(
    "execution_projects",
    preferences.refreshProfile
  );
  const loadSnapshot = useCallback(
    () => fetchShellExecutionWorkspaceSnapshot(activeProjectId),
    [activeProjectId]
  );
  const selectLoadState = useCallback(
    (snapshot: ShellExecutionWorkspaceSnapshot) =>
      activeProjectId
        ? snapshot.projectLoadState === "ready"
          ? "ready"
          : "error"
        : snapshot.projectsLoadState,
    [activeProjectId]
  );
  const { snapshot } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_EXECUTION_WORKSPACE_SNAPSHOT,
    initialSnapshot,
    refreshNonce,
    pollIntervalMs: pollInterval,
    loadSnapshot,
    selectLoadState,
  });

  return snapshot;
}

function ExecutionProjectsList({
  projects,
  activeProjectId,
  loadState,
  error,
  reviewHref,
  routeScope,
  onRefresh,
  isRefreshing,
}: {
  projects: AutopilotProjectSummary[];
  activeProjectId: string | null;
  loadState: LoadState;
  error: string | null;
  reviewHref: string;
  routeScope: ExecutionRouteScope;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  const [query, setQuery] = useState("");
  const scopeActive = hasShellRouteScope(routeScope);

  const visibleProjects = useMemo(
    () =>
      scopeActive
        ? projects.filter((project) => matchesProjectRouteScope(project, routeScope))
        : projects,
    [projects, routeScope, scopeActive]
  );

  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return visibleProjects;
    return visibleProjects.filter((project) => {
      const sourceKind = project.task_source?.source_kind || "";
      const sourceExternalId = project.task_source?.external_id || "";
      return (
        project.name.toLowerCase().includes(normalized) ||
        project.status.toLowerCase().includes(normalized) ||
        (project.current_story_title ?? "").toLowerCase().includes(normalized) ||
        sourceKind.toLowerCase().includes(normalized) ||
        sourceExternalId.toLowerCase().includes(normalized)
      );
    });
  }, [query, visibleProjects]);

  const displayProjects = useMemo(() => {
    if (!activeProjectId) return filteredProjects;
    const activeProject = projects.find((project) => project.id === activeProjectId);
    if (!activeProject) return filteredProjects;
    if (filteredProjects.some((project) => project.id === activeProject.id)) {
      return filteredProjects;
    }
    return [activeProject, ...filteredProjects];
  }, [activeProjectId, filteredProjects, projects]);

  return (
    <ShellSectionCard
      title="Projects"
      description="Browse execution projects by name, status, story, or source."
      actions={
        <div className="flex items-center gap-2">
          <Badge tone="neutral">{displayProjects.length}</Badge>
          <ShellActionLink href={reviewHref} label="Review" />
          <ShellRefreshButton type="button" onClick={onRefresh} busy={isRefreshing} compact />
        </div>
      }
      className="flex h-full min-h-0 flex-col"
      headerClassName="gap-2 pb-2.5"
      contentClassName="min-h-0 flex-1 space-y-3 overflow-y-auto"
    >
      <div className="flex h-9 items-center gap-2 rounded-[8px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-2.5 focus-within:border-primary/25 focus-within:ring-1 focus-within:ring-primary/15">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter by project, status, story, or source"
          className="min-w-0 flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground outline-none"
        />
      </div>

      {error ? (
        <ShellStatusBanner tone="warning">{error}</ShellStatusBanner>
      ) : null}

      {loadState === "loading" && projects.length === 0 ? (
        <SkeletonList rows={6} className="px-1" />
      ) : null}

      <div className="space-y-1.5">
        {displayProjects.map((project) => {
          const isActive = project.id === activeProjectId;
          const progress =
            project.stories_total > 0
              ? Math.round((project.stories_done / project.stories_total) * 100)
              : 0;
          const sourceKind = project.task_source?.source_kind || "manual";
          const sourceExternalId = project.task_source?.external_id || "";
          const projectHref = buildExecutionProjectScopeHref(
            project.id,
            routeScopeFromExecutionProject(project, routeScope)
          );
          return (
            <ShellDetailLinkCard
              key={project.id}
              href={projectHref}
              className={cn(
                "p-3",
                isActive && "border-primary/20 bg-[color:var(--shell-nav-active)]"
              )}
              eyebrow={
                <>
                  <Badge tone={projectStatusTone(project.status)}>{project.status}</Badge>
                  <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    {sourceKind}
                  </span>
                  {sourceExternalId ? (
                    <span className="truncate text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                      {sourceExternalId}
                    </span>
                  ) : null}
                </>
              }
              title={project.name}
              actions={
                <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  {progress}% complete
                </span>
              }
              bodyClassName="space-y-1.5"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-4 text-muted-foreground">
                <span className="truncate">{project.current_story_title || "No active story"}</span>
              </div>
            </ShellDetailLinkCard>
          );
        })}
      </div>

      {loadState !== "loading" && displayProjects.length === 0 ? (
        <ShellEmptyState
          centered
          className="py-10"
          icon={<FolderKanban className="h-5 w-5" />}
          title={projects.length === 0 ? "No projects yet" : "No results"}
          description={
            projects.length === 0
              ? "Projects appear once work moves into execution."
              : "No projects match the current filter."
          }
        />
      ) : null}
    </ShellSectionCard>
  );
}

function ExecutionLifecyclePanel({
  isPending,
  project,
  launchPresets,
  onDidMutate,
  routeScope,
}: {
  isPending: boolean;
  project: AutopilotProjectDetail;
  launchPresets: AutopilotLaunchPreset[];
  onDidMutate: (effect: ExecutionMutationEffect) => void;
  routeScope: ExecutionRouteScope;
}) {
  const [selectedLaunchPresetId, setSelectedLaunchPresetId] = useState(
    project.launch_profile?.preset || "fast"
  );
  const {
    busyActionKey: busyAction,
    errorMessage,
    runMutation: runAction,
    statusMessage,
  } = useShellMutationRunner<ExecutionMutationEffect>({
    applyEffect: onDidMutate,
  });

  const effectiveSelectedLaunchPresetId = useMemo(() => {
    const fallback = launchPresets[0]?.id ?? "fast";
    const preferred = launchPresets.some(
      (preset) => preset.id === (project.launch_profile?.preset || "fast")
    )
      ? project.launch_profile?.preset || "fast"
      : fallback;
    return launchPresets.some((preset) => preset.id === selectedLaunchPresetId)
      ? selectedLaunchPresetId
      : preferred;
  }, [launchPresets, project.launch_profile?.preset, selectedLaunchPresetId]);

  const selectedLaunchPreset = useMemo(
    () =>
      launchPresets.find((preset) => preset.id === effectiveSelectedLaunchPresetId) ??
      null,
    [effectiveSelectedLaunchPresetId, launchPresets]
  );

  async function handleLaunch() {
    await runAction("launch", () =>
      launchExecutionProject({
        projectId: project.id,
        intakeSessionId: intakeSessionIdFromExecutionProject(project),
        routeScope: routeScopeFromExecutionProject(project, routeScope),
        launchProfile:
          selectedLaunchPreset?.launch_profile ?? {
            preset: effectiveSelectedLaunchPresetId,
          },
      })
    );
  }

  async function handlePause() {
    await runAction("pause", () =>
      pauseExecutionProject({
        projectId: project.id,
        intakeSessionId: intakeSessionIdFromExecutionProject(project),
        routeScope: routeScopeFromExecutionProject(project, routeScope),
      })
    );
  }

  async function handleResume() {
    await runAction("resume", () =>
      resumeExecutionProject({
        projectId: project.id,
        intakeSessionId: intakeSessionIdFromExecutionProject(project),
        routeScope: routeScopeFromExecutionProject(project, routeScope),
      })
    );
  }

  const isRunning = project.status === "running" && !project.paused;
  const isPaused = project.status === "paused" || project.paused;

  return (
    <ShellSectionCard
      title="Controls"
      description="Choose a launch preset, then launch, pause, or resume the project."
      contentClassName="space-y-3"
    >
      <div className="flex flex-wrap items-end gap-3">
        {launchPresets.length > 0 ? (
          <label className="min-w-[220px] flex-1 space-y-1.5">
            <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Launch preset
            </span>
            <ShellSelectField
              value={effectiveSelectedLaunchPresetId}
              onChange={(event) => setSelectedLaunchPresetId(event.target.value)}
            >
              {launchPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </ShellSelectField>
          </label>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {isPaused ? (
            <ShellPillButton
              type="button"
              tone="primary"
              compact
              onClick={handleResume}
              disabled={busyAction.length > 0}
            >
              <ShellActionStateLabel
                busy={busyAction === "resume"}
                idleLabel="Resume"
                busyLabel="Resume"
                icon={<PlayCircle className="h-4 w-4" />}
              />
            </ShellPillButton>
          ) : null}

          {isRunning ? (
            <ShellPillButton
              type="button"
              tone="outline"
              compact
              onClick={handlePause}
              disabled={busyAction.length > 0}
            >
              <ShellActionStateLabel
                busy={busyAction === "pause"}
                idleLabel="Pause"
                busyLabel="Pause"
                icon={<PauseCircle className="h-4 w-4" />}
              />
            </ShellPillButton>
          ) : (
            <ShellPillButton
              type="button"
              tone="primary"
              compact
              onClick={handleLaunch}
              disabled={busyAction.length > 0}
            >
              <ShellActionStateLabel
                busy={busyAction === "launch"}
                idleLabel="Launch"
                busyLabel="Launch"
                icon={<Rocket className="h-4 w-4" />}
              />
            </ShellPillButton>
          )}
        </div>
      </div>

      {statusMessage ? (
        <ShellStatusBanner tone="success">{statusMessage}</ShellStatusBanner>
      ) : null}

      {errorMessage ? (
        <ShellStatusBanner tone="danger">{errorMessage}</ShellStatusBanner>
      ) : null}

      {isPending ? (
        <ShellInlineStatus busy label="Refreshing..." className="text-xs" />
      ) : null}
    </ShellSectionCard>
  );
}


function storyStatusDotColor(status: string) {
  if (status === "done") return "bg-emerald-500";
  if (status === "in_progress") return "bg-blue-500";
  if (status === "stuck" || status === "merge_blocked") return "bg-red-500";
  if (status === "skipped") return "bg-amber-500";
  return "bg-muted-foreground/40";
}

function timelineEventDotColor(status: string | null | undefined) {
  if (!status) return "bg-muted-foreground/40";
  if (status === "running") return "bg-emerald-500";
  if (status === "paused") return "bg-amber-500";
  if (status === "completed") return "bg-blue-500";
  if (status === "failed") return "bg-red-500";
  return "bg-muted-foreground/40";
}

function ProjectStoriesPanel({
  stories,
  storiesDone,
  storiesTotal,
}: {
  stories: AutopilotStory[];
  storiesDone: number;
  storiesTotal: number;
}) {
  return (
    <ShellSectionCard
      title="Stories"
      description={`${storiesDone}/${storiesTotal} complete`}
      contentClassName="space-y-2"
    >
      {stories.length === 0 ? (
        <div className="rounded-[8px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3 py-3 text-[13px] text-muted-foreground">
          No stories yet.
        </div>
      ) : (
        stories.map((story) => (
          <ShellDetailCard
            key={story.id}
            className="p-3"
            bodyClassName="space-y-1.5"
            eyebrow={
              <>
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    storyStatusDotColor(story.status)
                  )}
                />
                <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {story.status}
                </span>
              </>
            }
            title={story.title}
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-4 text-muted-foreground">
              <span>{story.agent || `Story ${story.id}`}</span>
              <span className="text-border">&middot;</span>
              <span>
                {typeof story.iteration === "number"
                  ? `iter ${story.iteration}`
                  : "no iteration"}
              </span>
            </div>
          </ShellDetailCard>
        ))
      )}
    </ShellSectionCard>
  );
}

function ProjectTimelinePanel({
  timeline,
}: {
  timeline: AutopilotTimelineEvent[];
}) {
  return (
    <ShellSectionCard
      title="Timeline"
      description="Recent project events and execution state changes."
      contentClassName="space-y-2"
    >
      {timeline.length === 0 ? (
        <div className="rounded-[8px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3 py-3 text-[13px] text-muted-foreground">
          No timeline events yet.
        </div>
      ) : (
        timeline.slice(0, 12).map((event, index) => (
          <ShellDetailCard
            key={`${event.event}-${event.timestamp}-${index}`}
            className="p-3"
            bodyClassName="space-y-1.5"
            eyebrow={
              <>
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    timelineEventDotColor(event.status)
                  )}
                />
                <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {event.status || "unknown"}
                </span>
              </>
            }
            title={event.event}
            actions={
              <div className="shrink-0 text-[11px] leading-4 text-muted-foreground">
                {event.timestamp ? formatDate(event.timestamp) : "\u2014"}
              </div>
            }
          >
            <div className="truncate text-[11px] leading-4 text-muted-foreground">
              {event.message || event.event}
            </div>
          </ShellDetailCard>
        ))
      )}
    </ShellSectionCard>
  );
}

function ExecutionProjectMonitor({
  project,
  loadState,
  error,
  launchPresets,
  isPending,
  onDidMutate,
  reviewHref,
  routeScope,
  onRefresh,
  isRefreshing,
}: {
  project: AutopilotProjectDetail | null;
  loadState: LoadState;
  error: string | null;
  launchPresets: AutopilotLaunchPreset[];
  isPending: boolean;
  onDidMutate: (effect: ExecutionMutationEffect) => void;
  reviewHref: string;
  routeScope: ExecutionRouteScope;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  if (loadState === "loading" && !project) {
    return (
      <ShellSectionCard
        title="Execution project"
        description="Select a project to inspect stories, timeline, and launch controls."
        contentClassName="py-10"
      >
        <SkeletonList rows={6} />
      </ShellSectionCard>
    );
  }

  if (error) {
    return (
      <ShellStatusBanner tone="danger" className="space-y-4 py-10">
        <p>{error}</p>
        <div className="flex flex-wrap gap-3">
          <ShellActionLink
            href={buildExecutionIntakeScopeHref(undefined, routeScope)}
            label="Open intake"
          />
          <ShellActionLink
            href={reviewHref}
            label="Open execution review"
          />
        </div>
      </ShellStatusBanner>
    );
  }

  if (!project) {
    return (
      <ShellEmptyState
        centered
        className="min-h-[400px]"
        icon={<FolderKanban className="h-5 w-5" />}
        title="Project workspace"
        description="Select a project from the list to view stories, progress, and execution details."
      />
    );
  }

  const scopedProjectContext = routeScopeFromExecutionProject(project, routeScope);
  const presetLabel = project.launch_profile?.preset ?? "default";

  return (
    <div className="space-y-4">
      <ShellHero
        title={project.name}
        description="Project detail, execution rhythm, and launch controls."
        meta={
          <>
            <span>
              {project.stories_done}/{project.stories_total} stories
            </span>
            <span className="text-border">&middot;</span>
            <span>Last activity {formatDate(project.last_activity_at)}</span>
            <span className="text-border">&middot;</span>
            <span>{presetLabel} preset</span>
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <ShellActionLink href={reviewHref} label="Review" />
            <ShellRefreshButton type="button" onClick={onRefresh} busy={isRefreshing} compact />
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <ProjectStoriesPanel
            stories={project.stories}
            storiesDone={project.stories_done}
            storiesTotal={project.stories_total}
          />
          <ProjectTimelinePanel timeline={project.timeline} />
        </div>
        <div className="space-y-4">
          <ExecutionLifecyclePanel
            isPending={isPending}
            project={project}
            launchPresets={launchPresets}
            onDidMutate={onDidMutate}
            routeScope={scopedProjectContext}
          />

          <ShellSectionCard
            title="Execution profile"
            description="Workspace, launch profile, and active worker context."
            contentClassName="space-y-2.5"
          >
            <div className="space-y-2 rounded-[8px] border border-border/60 bg-[color:var(--shell-control-bg)] px-3 py-2.5 text-[13px] leading-5">
              <div className="flex flex-wrap gap-x-2 gap-y-1">
                <span className="text-muted-foreground">Workspace</span>
                <span className="break-all text-foreground">{project.path}</span>
              </div>
              {project.launch_profile ? (
                <div className="flex flex-wrap gap-x-2 gap-y-1">
                  <span className="text-muted-foreground">Launch</span>
                  <span className="text-foreground">
                    {project.launch_profile.preset} &middot;{" "}
                    {project.launch_profile.story_execution_mode} &middot;{" "}
                    {project.launch_profile.project_concurrency_mode}
                  </span>
                </div>
              ) : null}
              {project.task_source ? (
                <div className="flex flex-wrap gap-x-2 gap-y-1">
                  <span className="text-muted-foreground">Task source</span>
                  <span className="text-foreground">
                    {project.task_source.source_kind}
                    {project.task_source.external_id
                      ? ` \u00b7 ${project.task_source.external_id}`
                      : ""}
                  </span>
                  {project.task_source.repo ? (
                    <span className="break-all text-muted-foreground/70">
                      ({project.task_source.repo})
                    </span>
                  ) : null}
                </div>
              ) : null}
              {project.active_worker ? (
                <div className="flex flex-wrap gap-x-2 gap-y-1">
                  <span className="text-muted-foreground">Worker</span>
                  <span className="text-foreground">{project.active_worker}</span>
                </div>
              ) : null}
              {project.active_critic ? (
                <div className="flex flex-wrap gap-x-2 gap-y-1">
                  <span className="text-muted-foreground">Critic</span>
                  <span className="text-foreground">{project.active_critic}</span>
                </div>
              ) : null}
            </div>
            {project.last_error ? (
              <ShellStatusBanner tone="danger">{project.last_error}</ShellStatusBanner>
            ) : null}
          </ShellSectionCard>
        </div>
      </div>
    </div>
  );
}

export function ExecutionWorkspace({
  activeProjectId,
  initialPreferences,
  initialSnapshot,
  routeScope = { projectId: "", intakeSessionId: "" },
}: {
  activeProjectId: string | null;
  initialPreferences?: ShellPreferences;
  initialSnapshot?: ShellExecutionWorkspaceSnapshot | null;
  routeScope?: ExecutionRouteScope;
}) {
  const { preferences } = useShellPreferences(initialPreferences);
  const reviewHref = useMemo(
    () =>
      buildRememberedExecutionReviewScopeHref({
        scope: routeScope,
        preferences,
        bucket: resolveReviewMemoryBucket({ scope: routeScope }),
      }),
    [preferences, routeScope]
  );
  const { isRefreshing, refresh, refreshNonce: manualRefreshNonce } = useShellManualRefresh();
  const { applyEffect, isPending, refreshNonce } =
    useShellRouteMutationRunner<ExecutionMutationEffect>({
    planes: ["execution"],
    scope: routeScope,
    source: "execution-workspace",
    reason: "project-mutation",
  });
  const routeRefreshNonce = useShellSnapshotRefreshNonce({
    baseRefreshNonce: refreshNonce,
    additionalRefreshNonce: manualRefreshNonce,
    invalidation: {
      planes: ["discovery", "execution"],
      scope: routeScope,
    },
    invalidationOptions: {
      ignoreSources: ["execution-workspace"],
      since: initialSnapshot?.generatedAt ?? null,
    },
  });
  const snapshot = useAutopilotProjectsState(
    routeRefreshNonce,
    activeProjectId,
    initialSnapshot,
    initialPreferences
  );
  const projects = snapshot.projects;
  const projectsState: LoadState =
    snapshot.projectsLoadState === "ready" ? "ready" : "error";
  const projectsError = snapshot.projectsError;
  const project =
    snapshot.project?.id === activeProjectId ? snapshot.project : null;
  const projectState: LoadState = activeProjectId
    ? snapshot.projectLoadState
    : "idle";
  const projectError = activeProjectId ? snapshot.projectError : null;

  return (
    <ShellPage className="max-w-[1560px]">
      <section className="grid min-h-0 flex-1 gap-4 lg:min-h-[calc(100vh-156px)] lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="hidden min-h-0 lg:block">
          <ExecutionProjectsList
            projects={projects}
            activeProjectId={activeProjectId}
            loadState={projectsState}
            error={projectsError}
            reviewHref={reviewHref}
            routeScope={routeScope}
            onRefresh={refresh}
            isRefreshing={isRefreshing}
          />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto">
          <div className="lg:hidden">
            <ExecutionProjectsList
              projects={projects}
              activeProjectId={activeProjectId}
              loadState={projectsState}
              error={projectsError}
              reviewHref={reviewHref}
              routeScope={routeScope}
              onRefresh={refresh}
              isRefreshing={isRefreshing}
            />
          </div>

          <ExecutionProjectMonitor
            project={project}
            loadState={projectState}
            error={projectError}
            launchPresets={snapshot.launchPresets}
            isPending={isPending}
            onDidMutate={applyEffect}
            reviewHref={reviewHref}
            routeScope={routeScope}
            onRefresh={refresh}
            isRefreshing={isRefreshing}
          />
        </div>
      </section>
    </ShellPage>
  );
}
