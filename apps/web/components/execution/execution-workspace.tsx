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
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import {
  ShellInlineStatus,
  ShellActionStateLabel,
  ShellActionLink,
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
}: {
  projects: AutopilotProjectSummary[];
  activeProjectId: string | null;
  loadState: LoadState;
  error: string | null;
  reviewHref: string;
  routeScope: ExecutionRouteScope;
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

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[14px] font-semibold tracking-tight text-foreground">
          Projects
          <span className="ml-2 text-muted-foreground">{projects.length}</span>
        </h3>
      </div>
      <div className="mb-3">
        <div className="flex h-8 items-center gap-2 rounded-md border border-border px-2.5 focus-within:ring-2 focus-within:ring-primary/20">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter projects..."
            className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loadState === "loading" && projects.length === 0 ? (
          <SkeletonList rows={6} className="px-3" />
        ) : null}
        {/* Errors handled silently — connection status dots indicate backend availability */}
        <div className="divide-y divide-border">
          {filteredProjects.map((project) => {
            const isActive = project.id === activeProjectId;
            const progress = project.stories_total > 0
              ? Math.round((project.stories_done / project.stories_total) * 100)
              : 0;
            const projectHref = buildExecutionProjectScopeHref(
              project.id,
              routeScopeFromExecutionProject(project, routeScope)
            );
            return (
              <Link
                key={project.id}
                href={projectHref}
                className={cn(
                  "block px-2 py-3 transition-colors duration-100 hover:bg-[color:var(--shell-control-hover)]",
                  isActive && "bg-[color:var(--shell-nav-active)]"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-foreground">
                      {project.name}
                    </div>
                    <div className="mt-1 text-[12px] text-muted-foreground">
                      {project.current_story_title || "No active story"} · {progress}%
                    </div>
                  </div>
                  <Badge tone={projectStatusTone(project.status)}>{project.status}</Badge>
                </div>
              </Link>
            );
          })}
        </div>
        {loadState !== "loading" && filteredProjects.length === 0 ? (
          <ShellEmptyState
            centered
            className="py-12"
            icon={<FolderKanban className="h-5 w-5" />}
            title={projects.length === 0 ? "No projects yet" : "No results"}
            description={
              projects.length === 0
                ? "Projects are created when ideas move into execution. Launch an execution run to get started."
                : "No projects match the current filter."
            }
          />
        ) : null}
      </div>
    </div>
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
    <div>
      <h3 className="text-[14px] font-semibold tracking-tight text-foreground">Controls</h3>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {launchPresets.length > 0 ? (
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
        ) : null}

        {isPaused ? (
          <ShellPillButton
            type="button"
            tone="primary"
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

      {statusMessage ? (
        <ShellStatusBanner tone="success" className="mt-3">{statusMessage}</ShellStatusBanner>
      ) : null}

      {errorMessage ? (
        <ShellStatusBanner tone="danger" className="mt-3">{errorMessage}</ShellStatusBanner>
      ) : null}

      {isPending ? (
        <ShellInlineStatus
          busy
          label="Refreshing..."
          className="mt-2 text-xs"
        />
      ) : null}
    </div>
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
    <div>
      <h3 className="text-[14px] font-semibold tracking-tight text-foreground">
        Stories
        <span className="ml-2 text-[13px] font-normal text-muted-foreground">
          {storiesDone}/{storiesTotal}
        </span>
      </h3>
      <div className="mt-2 border-t border-border">
        {stories.length === 0 ? (
          <div className="py-6 text-center text-[13px] text-muted-foreground">
            No stories yet.
          </div>
        ) : (
          stories.map((story) => (
            <div
              key={story.id}
              className="flex items-center gap-3 border-b border-border px-1 py-2"
            >
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  storyStatusDotColor(story.status)
                )}
              />
              <span className="w-[100px] shrink-0 text-[12px] text-muted-foreground">
                {story.status}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                {story.title}
              </span>
              <span className="shrink-0 text-[12px] text-muted-foreground">
                {typeof story.iteration === "number"
                  ? `iter ${story.iteration}`
                  : "\u2014"}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ProjectTimelinePanel({
  timeline,
}: {
  timeline: AutopilotTimelineEvent[];
}) {
  return (
    <div>
      <h3 className="text-[14px] font-semibold tracking-tight text-foreground">Timeline</h3>
      <div className="mt-2 border-t border-border">
        {timeline.length === 0 ? (
          <div className="py-6 text-center text-[13px] text-muted-foreground">
            No timeline events yet.
          </div>
        ) : (
          timeline.slice(0, 12).map((event, index) => (
            <div
              key={`${event.event}-${event.timestamp}-${index}`}
              className="flex items-center gap-3 border-b border-border px-1 py-2"
            >
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  timelineEventDotColor(event.status)
                )}
              />
              <span className="w-[100px] shrink-0 text-[12px] text-muted-foreground">
                {event.event}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                {event.message || event.event}
              </span>
              <span className="shrink-0 text-[12px] text-muted-foreground">
                {event.timestamp ? formatDate(event.timestamp) : "\u2014"}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
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
}: {
  project: AutopilotProjectDetail | null;
  loadState: LoadState;
  error: string | null;
  launchPresets: AutopilotLaunchPreset[];
  isPending: boolean;
  onDidMutate: (effect: ExecutionMutationEffect) => void;
  reviewHref: string;
  routeScope: ExecutionRouteScope;
}) {
  if (loadState === "loading" && !project) {
    return (
      <ShellSectionCard
        title="Execution project"
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
    <div className="space-y-6">
      {/* Project header */}
      <div>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-[18px] font-medium text-foreground">
            {project.name}
          </h2>
          <Badge tone={projectStatusTone(project.status)}>{project.status}</Badge>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
          <span>
            {project.stories_done}/{project.stories_total} stories
          </span>
          <span className="text-border">&middot;</span>
          <span>Last activity: {formatDate(project.last_activity_at)}</span>
          <span className="text-border">&middot;</span>
          <span>{presetLabel} preset</span>
        </div>
      </div>

      {/* Stories */}
      <ProjectStoriesPanel
        stories={project.stories}
        storiesDone={project.stories_done}
        storiesTotal={project.stories_total}
      />

      {/* Timeline */}
      <ProjectTimelinePanel timeline={project.timeline} />

      {/* Controls */}
      <ExecutionLifecyclePanel
        isPending={isPending}
        project={project}
        launchPresets={launchPresets}
        onDidMutate={onDidMutate}
        routeScope={scopedProjectContext}
      />

      {/* Profile */}
      <div>
        <h3 className="text-[14px] font-semibold tracking-tight text-foreground">
          Execution profile
        </h3>
        <div className="mt-2 space-y-1.5 text-[13px] text-muted-foreground">
          <div>
            <span className="text-foreground/60">Workspace</span>{" "}
            <span className="break-all text-foreground">{project.path}</span>
          </div>
          {project.launch_profile ? (
            <div>
              <span className="text-foreground/60">Launch</span>{" "}
              <span className="text-foreground">
                {project.launch_profile.preset} &middot;{" "}
                {project.launch_profile.story_execution_mode} &middot;{" "}
                {project.launch_profile.project_concurrency_mode}
              </span>
            </div>
          ) : null}
          {project.task_source ? (
            <div>
              <span className="text-foreground/60">Task source</span>{" "}
              <span className="text-foreground">
                {project.task_source.source_kind}
                {project.task_source.external_id
                  ? ` \u00b7 ${project.task_source.external_id}`
                  : ""}
              </span>
              {project.task_source.repo ? (
                <span className="ml-1 break-all text-foreground/60">
                  ({project.task_source.repo})
                </span>
              ) : null}
            </div>
          ) : null}
          {project.active_worker ? (
            <div>
              <span className="text-foreground/60">Worker</span>{" "}
              <span className="text-foreground">{project.active_worker}</span>
            </div>
          ) : null}
          {project.active_critic ? (
            <div>
              <span className="text-foreground/60">Critic</span>{" "}
              <span className="text-foreground">{project.active_critic}</span>
            </div>
          ) : null}
        </div>
        {project.last_error ? (
          <ShellStatusBanner tone="danger" className="mt-3">
            {project.last_error}
          </ShellStatusBanner>
        ) : null}
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
    <ShellPage className="max-w-[1600px]">
      <section className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:min-h-[calc(100vh-160px)]">
      <aside className="hidden min-h-0 lg:block">
        <ExecutionProjectsList
          projects={projects}
          activeProjectId={activeProjectId}
          loadState={projectsState}
          error={projectsError}
          reviewHref={reviewHref}
          routeScope={routeScope}
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
        />
      </div>
      </section>
    </ShellPage>
  );
}
