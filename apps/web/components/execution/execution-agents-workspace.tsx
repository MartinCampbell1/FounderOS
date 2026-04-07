"use client";

import type {
  AutopilotExecutionAgentActionRunSummaryRecord,
  AutopilotExecutionShadowAuditRecord,
  AutopilotExecutionRuntimeAgentRecord,
  AutopilotProjectSummary,
  ShellPreferences,
} from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import { cn } from "@founderos/ui/lib/utils";
import {
  AlertTriangle,
  Bot,
  CirclePause,
  Clock3,
  Link2,
  PlayCircle,
  Signal,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  ShellActionLink,
  ShellEmptyState,
  ShellHero,
  ShellHeroSearchField,
  ShellListLink,
  ShellMetricCard,
  ShellPage,
  ShellPillButton,
  ShellRefreshButton,
  ShellSectionCard,
  ShellStatusBanner,
} from "@/components/shell/shell-screen-primitives";
import type { ShellExecutionAgentsSnapshot } from "@/lib/execution-agents";
import { emptyShellExecutionAgentsSnapshot } from "@/lib/execution-agents";
import {
  buildExecutionAgentScopeHref,
  buildExecutionAuditScopeHref,
  buildExecutionAuditsScopeHref,
  buildExecutionEventsScopeHref,
  buildExecutionProjectScopeHref,
  routeScopeFromExecutionProject,
  routeScopeFromProjectRef,
  type ShellRouteScope,
} from "@/lib/route-scope";
import {
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import { fetchShellExecutionAgentsSnapshot } from "@/lib/shell-snapshot-client";
import { useShellManualRefresh } from "@/lib/use-shell-manual-refresh";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";

const EMPTY_AGENTS_SNAPSHOT = emptyShellExecutionAgentsSnapshot();

type AgentFilter = "all" | "running" | "attention" | "standby" | "completed";

const OPERATOR_ATTENTION_STATES = new Set([
  "blocked",
  "needs_approval",
  "budget_risk",
  "budget_exhausted",
]);

function statusBadgeTone(
  status: string
): "neutral" | "success" | "warning" | "danger" | "info" {
  if (status === "running" || status === "active" || status === "ok") return "success";
  if (status === "paused" || status === "partial" || status === "pending_async") {
    return "warning";
  }
  if (status === "failed" || status === "error" || status === "quarantined") {
    return "danger";
  }
  if (status === "completed") return "info";
  return "neutral";
}

function attentionBadgeTone(
  state: string | null | undefined
): "neutral" | "success" | "warning" | "danger" | "info" {
  if (state === "blocked" || state === "budget_exhausted") return "danger";
  if (state === "needs_approval" || state === "budget_risk") return "warning";
  if (state === "waiting_async") return "info";
  if (state === "healthy" || state === "clear") return "success";
  return "neutral";
}

function relativeTime(value?: string | null, fallback = "No timestamp yet") {
  if (!value) return fallback;

  const diffMs = Math.max(0, Date.now() - new Date(value).getTime());
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return `${Math.floor(diffHours / 24)}d ago`;
}

function relativeActivity(value?: string | null) {
  const label = relativeTime(value, "No activity yet");
  return label === "No activity yet" ? label : `active ${label}`;
}

function runtimeHealth(project: AutopilotProjectSummary): AgentFilter {
  if (project.archived || project.status === "completed") return "completed";
  if (project.status === "running") return "running";
  if (project.status === "failed" || project.status === "paused") return "attention";
  return "standby";
}

function sanitizeRuntimeError(error: string | null) {
  if (!error) return null;

  const normalized = error.toLowerCase();
  if (
    normalized.includes("fetch failed") ||
    normalized.includes("timed out") ||
    normalized.includes("network")
  ) {
    return "Autopilot execution-plane is unavailable right now. Check the upstream connection in Settings, then refresh this runtime view.";
  }

  return error;
}

function matchesValues(
  values: Array<string | number | boolean | null | undefined>,
  query: string
) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return values.some((value) =>
    String(value ?? "")
      .toLowerCase()
      .includes(normalized)
  );
}

function matchesProjectQuery(project: AutopilotProjectSummary, query: string) {
  return matchesValues(
    [
      project.name,
      project.status,
      project.current_story_title,
      project.runtime_session_id,
      project.last_message,
      project.task_source?.source_kind,
      project.task_source?.external_id,
      project.provider_config?.family,
      project.runtime_profile?.id,
      project.delivery_status?.headline,
    ],
    query
  );
}

function matchesRuntimeAgentQuery(
  agent: AutopilotExecutionRuntimeAgentRecord,
  query: string
) {
  const reasons = agent.attention?.reasons?.join(" ") ?? "";
  const suggestedCommands = (agent.suggested_commands ?? [])
    .map((suggestion) =>
      [suggestion.command, suggestion.label, suggestion.description]
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .join(" ")
    )
    .join(" ");

  return matchesValues(
    [
      agent.agent_id,
      agent.project_name,
      agent.project_id,
      agent.label,
      agent.role,
      agent.status,
      agent.story_title,
      agent.story_status,
      agent.provider,
      agent.profile_name,
      agent.pipeline_stage,
      agent.pipeline_status,
      agent.attention?.state,
      agent.attention?.recommended_action,
      reasons,
      suggestedCommands,
    ],
    query
  );
}

function matchesActionRunQuery(
  run: AutopilotExecutionAgentActionRunSummaryRecord,
  query: string
) {
  return matchesValues(
    [
      run.id,
      run.run_kind,
      run.orchestrator_session_id,
      run.actor,
      run.mode,
      run.reason,
      run.policy_profile,
      run.status,
      run.completion_state,
      run.completion_message,
      run.project_ids.join(" "),
      run.runtime_agent_ids.join(" "),
      run.orchestrators.join(" "),
    ],
    query
  );
}

function formatProgress(project: AutopilotProjectSummary) {
  if (project.stories_total <= 0) {
    return "No story plan yet";
  }
  return `${project.stories_done}/${project.stories_total} stories complete`;
}

function formatRunSummary(run: AutopilotExecutionAgentActionRunSummaryRecord) {
  const parts: string[] = [];

  if (typeof run.summary.selected_count === "number" && run.summary.selected_count > 0) {
    parts.push(`${run.summary.selected_count} selected`);
  }
  if (typeof run.summary.processed_count === "number" && run.summary.processed_count > 0) {
    parts.push(`${run.summary.processed_count} processed`);
  }
  if (run.runtime_agent_ids.length > 0) {
    parts.push(`${run.runtime_agent_ids.length} agents`);
  }
  if (run.project_ids.length > 0) {
    parts.push(`${run.project_ids.length} projects`);
  }

  return parts.length > 0 ? parts.join(" · ") : "No selection summary yet";
}

type OpenAuditPreview = AutopilotExecutionShadowAuditRecord & {
  sourceRunId: string;
};

function sortOpenAuditPreviews(items: OpenAuditPreview[]) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.updated_at ?? left.created_at ?? "") || 0;
    const rightTime = Date.parse(right.updated_at ?? right.created_at ?? "") || 0;
    return rightTime - leftTime;
  });
}

function firstSuggestedCommand(agent: AutopilotExecutionRuntimeAgentRecord) {
  const suggestion = agent.suggested_commands?.[0];
  if (!suggestion) {
    return null;
  }

  if (typeof suggestion.command === "string" && suggestion.command.trim()) {
    return suggestion.command.trim();
  }
  if (typeof suggestion.label === "string" && suggestion.label.trim()) {
    return suggestion.label.trim();
  }
  if (typeof suggestion.description === "string" && suggestion.description.trim()) {
    return suggestion.description.trim();
  }
  return null;
}

function isOperatorAttentionAgent(agent: AutopilotExecutionRuntimeAgentRecord) {
  return OPERATOR_ATTENTION_STATES.has(String(agent.attention?.state ?? ""));
}

function AgentProjectCard({
  project,
  routeScope,
}: {
  project: AutopilotProjectSummary;
  routeScope: ShellRouteScope;
}) {
  const href = buildExecutionProjectScopeHref(
    project.id,
    routeScopeFromExecutionProject(project, routeScope)
  );
  const deliveryHeadline =
    project.delivery_status?.headline ||
    project.current_story_title ||
    project.last_message ||
    "No active runtime headline yet.";

  return (
    <ShellListLink href={href} className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="truncate text-[14px] font-medium text-foreground">
            {project.name}
          </div>
          <div className="text-[12px] leading-5 text-muted-foreground">
            {deliveryHeadline}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusBadgeTone(project.status)}>{project.status}</Badge>
          {project.priority === "high" ? (
            <Badge tone="warning">high priority</Badge>
          ) : null}
          {project.runtime_control_available ? (
            <Badge tone="success">interactive</Badge>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {project.runtime_session_id ? (
          <Badge tone="info">{project.runtime_session_id}</Badge>
        ) : null}
        {project.launch_profile?.preset ? (
          <Badge tone="neutral">preset {project.launch_profile.preset}</Badge>
        ) : null}
        {project.provider_config?.family ? (
          <Badge tone="neutral">
            {project.provider_config.family}
            {project.provider_config.mode ? ` · ${project.provider_config.mode}` : ""}
          </Badge>
        ) : null}
        {project.runtime_profile?.id ? (
          <Badge tone="neutral">{project.runtime_profile.id}</Badge>
        ) : null}
      </div>

      <div className="grid gap-2 text-[12px] text-muted-foreground md:grid-cols-2">
        <span>{formatProgress(project)}</span>
        <span>{relativeActivity(project.last_activity_at)}</span>
        {project.current_story_title ? (
          <span className="md:col-span-2">
            Story {project.current_story_id ?? "?"}: {project.current_story_title}
          </span>
        ) : null}
        {project.last_message ? (
          <span className="md:col-span-2 line-clamp-2">{project.last_message}</span>
        ) : null}
      </div>
    </ShellListLink>
  );
}

function RuntimeAgentCard({
  agent,
  routeScope,
}: {
  agent: AutopilotExecutionRuntimeAgentRecord;
  routeScope: ShellRouteScope;
}) {
  const projectId = agent.project_id ?? "";
  const scopedRouteScope = routeScopeFromProjectRef(projectId, null, routeScope);
  const href = buildExecutionAgentScopeHref(agent.agent_id, scopedRouteScope);
  const suggestedCommand = firstSuggestedCommand(agent);
  const reasons = agent.attention?.reasons?.filter(Boolean) ?? [];
  const content = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="truncate text-[14px] font-medium text-foreground">
            {agent.project_name || projectId || "Unknown project"}
          </div>
          <div className="text-[12px] leading-5 text-muted-foreground">
            {agent.label}
            {agent.story_title ? ` · ${agent.story_title}` : ""}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusBadgeTone(agent.status)}>{agent.status}</Badge>
          <Badge tone={attentionBadgeTone(agent.attention?.state)}>
            {agent.attention?.state || "unknown"}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge tone="neutral">{agent.role}</Badge>
        {agent.provider ? <Badge tone="neutral">{agent.provider}</Badge> : null}
        {agent.profile_name ? (
          <Badge tone="neutral">{agent.profile_name}</Badge>
        ) : null}
        {agent.pipeline_stage ? (
          <Badge tone="info">{agent.pipeline_stage}</Badge>
        ) : null}
      </div>

      <div className="grid gap-2 text-[12px] text-muted-foreground md:grid-cols-2">
        <span>{agent.open_issue_count} open issues</span>
        <span>{agent.pending_approval_count} pending approvals</span>
        <span>{agent.pending_tool_permission_runtime_count ?? 0} pending tool prompts</span>
        <span>{agent.active_async_task_count ?? 0} active async tasks</span>
        {agent.budget?.usage_label ? (
          <span className="md:col-span-2">{agent.budget.usage_label}</span>
        ) : null}
        {agent.attention?.recommended_action ? (
          <span className="md:col-span-2">
            Next step: {agent.attention.recommended_action}
          </span>
        ) : null}
        {suggestedCommand ? (
          <span className="md:col-span-2 break-all">
            Suggested command: <code>{suggestedCommand}</code>
          </span>
        ) : null}
        {reasons.length > 0 ? (
          <span className="md:col-span-2 line-clamp-2">{reasons.join(" · ")}</span>
        ) : null}
      </div>
    </>
  );

  return <ShellListLink href={href} className="space-y-3">{content}</ShellListLink>;
}

function ActionRunCard({
  run,
  routeScope,
}: {
  run: AutopilotExecutionAgentActionRunSummaryRecord;
  routeScope: ShellRouteScope;
}) {
  const primaryProjectId = run.project_ids[0] ?? "";
  const scopedRouteScope = routeScopeFromProjectRef(
    primaryProjectId,
    null,
    routeScope
  );
  const href = buildExecutionEventsScopeHref(scopedRouteScope, {
    orchestratorSessionId: run.orchestrator_session_id || null,
  });
  const content = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="truncate text-[14px] font-medium text-foreground">
            {run.dry_run ? "Dry run" : "Apply run"} · {run.run_kind}
          </div>
          <div className="text-[12px] leading-5 text-muted-foreground">
            {run.completion_message || formatRunSummary(run)}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusBadgeTone(run.status)}>{run.status}</Badge>
          <Badge tone={statusBadgeTone(run.completion_state)}>
            {run.completion_state}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge tone="neutral">{run.actor}</Badge>
        <Badge tone="neutral">{run.policy_profile || "custom"}</Badge>
        {run.approval_required ? <Badge tone="warning">approval required</Badge> : null}
        {run.handoff_blocked ? <Badge tone="danger">handoff blocked</Badge> : null}
        {run.open_shadow_audit_count ? (
          <Badge tone="danger">{run.open_shadow_audit_count} open audits</Badge>
        ) : null}
      </div>

      <div className="grid gap-2 text-[12px] text-muted-foreground md:grid-cols-2">
        <span>{formatRunSummary(run)}</span>
        <span>created {relativeTime(run.created_at)}</span>
        <span>{run.project_ids.length} linked projects</span>
        <span>{run.runtime_agent_ids.length} linked agents</span>
        {run.orchestrator_session_id ? (
          <span className="md:col-span-2 break-all">
            Session {run.orchestrator_session_id}
          </span>
        ) : null}
      </div>
    </>
  );

  return <ShellListLink href={href} className="space-y-3">{content}</ShellListLink>;
}

function AgentBucketSection({
  title,
  description,
  projects,
  routeScope,
  className,
}: {
  title: string;
  description: string;
  projects: AutopilotProjectSummary[];
  routeScope: ShellRouteScope;
  className?: string;
}) {
  if (projects.length === 0) {
    return null;
  }

  return (
    <ShellSectionCard
      title={`${title} (${projects.length})`}
      description={description}
      contentClassName="grid gap-3"
      className={className}
    >
      {projects.map((project) => (
        <AgentProjectCard
          key={project.id}
          project={project}
          routeScope={routeScope}
        />
      ))}
    </ShellSectionCard>
  );
}

export function ExecutionAgentsWorkspace({
  initialPreferences,
  initialSnapshot,
  routeScope = { projectId: "", intakeSessionId: "" },
}: {
  initialPreferences?: ShellPreferences;
  initialSnapshot?: ShellExecutionAgentsSnapshot | null;
  routeScope?: ShellRouteScope;
}) {
  const { preferences } = useShellPreferences(initialPreferences);
  const pollIntervalMs = getShellPollInterval(
    "execution_projects",
    preferences.refreshProfile
  );
  const { isRefreshing, refresh, refreshNonce } = useShellManualRefresh();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AgentFilter>("all");

  const loadSnapshot = useCallback(() => fetchShellExecutionAgentsSnapshot(), []);
  const selectLoadState = useCallback(
    (snapshot: ShellExecutionAgentsSnapshot) => snapshot.projectsLoadState,
    []
  );

  const { loadState, snapshot } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_AGENTS_SNAPSHOT,
    initialSnapshot,
    refreshNonce,
    pollIntervalMs,
    loadSnapshot,
    selectLoadState,
  });

  const errorMessages = useMemo(
    () =>
      Array.from(
        new Set(
          [
            snapshot.projectsError,
            snapshot.agentsError,
            snapshot.agentsSummaryError,
            snapshot.actionRunsError,
            snapshot.actionRunsSummaryError,
          ]
            .map(sanitizeRuntimeError)
            .filter((value): value is string => Boolean(value))
        )
      ),
    [
      snapshot.actionRunsError,
      snapshot.actionRunsSummaryError,
      snapshot.agentsError,
      snapshot.agentsSummaryError,
      snapshot.projectsError,
    ]
  );

  const visibleProjects = useMemo(
    () =>
      snapshot.projects.filter((project) => {
        if (!matchesProjectQuery(project, query)) {
          return false;
        }
        if (filter === "all") {
          return true;
        }
        return runtimeHealth(project) === filter;
      }),
    [filter, query, snapshot.projects]
  );

  const visibleAgents = useMemo(
    () => snapshot.agents.filter((agent) => matchesRuntimeAgentQuery(agent, query)).slice(0, 8),
    [query, snapshot.agents]
  );

  const visibleActionRuns = useMemo(
    () =>
      snapshot.actionRuns
        .filter((run) => matchesActionRunQuery(run, query))
        .slice(0, 8),
    [query, snapshot.actionRuns]
  );

  const runningProjects = useMemo(
    () => visibleProjects.filter((project) => runtimeHealth(project) === "running"),
    [visibleProjects]
  );
  const attentionProjects = useMemo(
    () => visibleProjects.filter((project) => runtimeHealth(project) === "attention"),
    [visibleProjects]
  );
  const standbyProjects = useMemo(
    () => visibleProjects.filter((project) => runtimeHealth(project) === "standby"),
    [visibleProjects]
  );
  const completedProjects = useMemo(
    () => visibleProjects.filter((project) => runtimeHealth(project) === "completed"),
    [visibleProjects]
  );

  const connectedCount = useMemo(
    () =>
      snapshot.projects.filter(
        (project) => project.runtime_control_available || Boolean(project.runtime_session_id)
      ).length,
    [snapshot.projects]
  );

  const activeAgentCount =
    snapshot.agentsSummary?.totals.active ??
    snapshot.agents.filter((agent) => agent.status === "active").length;
  const attentionAgentCount = snapshot.agentsSummary
    ? snapshot.agentsSummary.totals.blocked +
      snapshot.agentsSummary.totals.needs_approval +
      snapshot.agentsSummary.totals.budget_risk +
      snapshot.agentsSummary.totals.budget_exhausted
    : snapshot.agents.filter((agent) => isOperatorAttentionAgent(agent)).length;
  const waitingAsyncCount =
    snapshot.agentsSummary?.totals.waiting_async ??
    snapshot.agents.filter((agent) => agent.attention?.state === "waiting_async").length;
  const actionRunCount =
    snapshot.actionRunsSummary?.totals.runs ?? snapshot.actionRuns.length;
  const dryRunCount = snapshot.actionRunsSummary?.totals.dry_runs ?? 0;
  const executionRunCount = snapshot.actionRunsSummary?.totals.executions ?? 0;
  const openAuditPreviews = useMemo(() => {
    const auditMap = new Map<string, OpenAuditPreview>();
    for (const run of snapshot.actionRuns) {
      for (const audit of run.shadow_audits ?? []) {
        if (!audit.open) {
          continue;
        }
        const existing = auditMap.get(audit.id);
        if (!existing) {
          auditMap.set(audit.id, { ...audit, sourceRunId: run.id });
          continue;
        }
        const existingTime =
          Date.parse(existing.updated_at ?? existing.created_at ?? "") || 0;
        const candidateTime =
          Date.parse(audit.updated_at ?? audit.created_at ?? "") || 0;
        if (candidateTime > existingTime) {
          auditMap.set(audit.id, { ...audit, sourceRunId: run.id });
        }
      }
    }
    return sortOpenAuditPreviews(Array.from(auditMap.values())).slice(0, 4);
  }, [snapshot.actionRuns]);
  const auditsHref = buildExecutionAuditsScopeHref(routeScope);

  return (
    <ShellPage>
      <ShellHero
        title="Agents"
        description="Runtime visibility across execution projects, live runtime agents, and recent action runs from the execution plane."
        meta={
          <>
            <span>{snapshot.projects.length} tracked projects</span>
            <span>{snapshot.agentsSummary?.totals.agents ?? snapshot.agents.length} runtime agents</span>
            <span>{actionRunCount} recorded action runs</span>
          </>
        }
        actions={
          <div className="flex items-center gap-4">
            <ShellActionLink
              href={buildExecutionEventsScopeHref(routeScope)}
              label="Open events"
            />
            <ShellRefreshButton
              busy={isRefreshing || loadState === "loading"}
              onClick={refresh}
              compact
            />
          </div>
        }
      />

      {errorMessages.map((message) => (
        <ShellStatusBanner key={message} tone="danger">
          {message}
        </ShellStatusBanner>
      ))}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4">
          <ShellMetricCard
            label="Active agents"
            value={String(activeAgentCount)}
            detail="Runtime agents currently executing or holding an active role."
          />
        </div>
        <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4">
          <ShellMetricCard
            label="Needs operator action"
            value={String(attentionAgentCount)}
            detail="Blocked, approval-gated, or budget-risk agents floated out of the runtime fleet."
          />
        </div>
        <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4">
          <ShellMetricCard
            label="Waiting async"
            value={String(waitingAsyncCount)}
            detail="Agents stalled on async follow-through instead of immediate local execution."
          />
        </div>
        <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4">
          <ShellMetricCard
            label="Action runs"
            value={String(actionRunCount)}
            detail={`${dryRunCount} dry runs and ${executionRunCount} apply runs recorded by execution-plane.`}
          />
        </div>
      </div>

      <ShellSectionCard
        title="Runtime board"
        description="Search by project, runtime agent, session, run id, provider, or execution context, then drill into the affected agent or its scoped event feed."
        contentClassName="space-y-4"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <ShellHeroSearchField
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by project, agent, action run, session id, provider, or source..."
          />
          <div className="flex flex-wrap gap-2">
            {([
              { key: "all", label: "All", icon: <Bot className="h-3.5 w-3.5" /> },
              {
                key: "running",
                label: "Running",
                icon: <PlayCircle className="h-3.5 w-3.5" />,
              },
              {
                key: "attention",
                label: "Attention",
                icon: <AlertTriangle className="h-3.5 w-3.5" />,
              },
              {
                key: "standby",
                label: "Standby",
                icon: <CirclePause className="h-3.5 w-3.5" />,
              },
              {
                key: "completed",
                label: "Completed",
                icon: <Signal className="h-3.5 w-3.5" />,
              },
            ] as const).map((option) => (
              <ShellPillButton
                key={option.key}
                type="button"
                tone="outline"
                compact
                active={filter === option.key}
                onClick={() => setFilter(option.key)}
              >
                <span className="flex items-center gap-1.5">
                  {option.icon}
                  {option.label}
                </span>
              </ShellPillButton>
            ))}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <ShellSectionCard
            title={`Runtime agents (${visibleAgents.length})`}
            description="Execution-plane ordered runtime agents. Blocked, approval-gated, and budget-risk operators naturally float first."
            contentClassName="grid gap-3"
          >
            {visibleAgents.length > 0 ? (
              visibleAgents.map((agent) => (
                <RuntimeAgentCard
                  key={agent.agent_id}
                  agent={agent}
                  routeScope={routeScope}
                />
              ))
            ) : (
              <ShellEmptyState
                centered
                icon={<Bot className="h-5 w-5" />}
                title="No runtime agents in view"
                description={
                  snapshot.agents.length > 0
                    ? "No runtime agents match the current search."
                    : "Runtime agents will appear here once execution-plane agents are materialized."
                }
                className="py-10"
              />
            )}
          </ShellSectionCard>

          <ShellSectionCard
            title={`Recent action runs (${visibleActionRuns.length})`}
            description="Latest execution-plane action batches and single-agent runs, including dry-run/apply state and async follow-through."
            contentClassName="grid gap-3"
          >
            {visibleActionRuns.length > 0 ? (
              visibleActionRuns.map((run) => (
                <ActionRunCard
                  key={run.id}
                  run={run}
                  routeScope={routeScope}
                />
              ))
            ) : (
              <ShellEmptyState
                centered
                icon={<Clock3 className="h-5 w-5" />}
                title="No action runs in view"
                description={
                  snapshot.actionRuns.length > 0
                    ? "No action runs match the current search."
                    : "Execution-plane runs appear here after runtime actions or control passes execute."
                }
                className="py-10"
              />
            )}
          </ShellSectionCard>
        </div>

        <div
          className={cn(
            "grid gap-4",
            visibleProjects.length > 0 ? "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : undefined
          )}
        >
          <div className="space-y-4">
            <AgentBucketSection
              title="Running now"
              description="Projects with active runtime execution in progress."
              projects={runningProjects}
              routeScope={routeScope}
            />
            <AgentBucketSection
              title="Needs attention"
              description="Paused or failed projects that likely need intervention."
              projects={attentionProjects}
              routeScope={routeScope}
            />
          </div>
          <div className="space-y-4">
            <AgentBucketSection
              title="Standby"
              description="Projects that are staged, idle, or waiting for the next launch."
              projects={standbyProjects}
              routeScope={routeScope}
            />
            <AgentBucketSection
              title="Completed or archived"
              description="Projects that finished their current run or moved out of the active fleet."
              projects={completedProjects}
              routeScope={routeScope}
            />
          </div>
        </div>

        {visibleProjects.length === 0 && loadState !== "loading" ? (
          <ShellEmptyState
            centered
            icon={<Bot className="h-5 w-5" />}
            title={snapshot.projects.length > 0 ? "No matching runtimes" : "No agent runtimes yet"}
            description={
              snapshot.projects.length > 0
                ? "No projects match the current search and board filter."
                : errorMessages.length > 0
                  ? "Execution-plane data will reappear once Autopilot reconnects."
                  : "Execution runtimes appear here after a project is launched."
            }
            action={
              snapshot.projects.length > 0
                ? {
                    label: "Clear filters",
                    onClick: () => {
                      setFilter("all");
                      setQuery("");
                    },
                  }
                : undefined
            }
            className="py-12"
          />
        ) : null}
      </ShellSectionCard>

      <ShellSectionCard
        title="How to read this"
        description="This route now covers project health, live runtime-agent pressure, and recent execution-plane runs before you drop into project detail or review."
        contentClassName="grid gap-3 md:grid-cols-3"
      >
        <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-4">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-foreground">
            <PlayCircle className="h-4 w-4 text-emerald-400" />
            Project status
          </div>
          <p className="text-[12px] leading-6 text-muted-foreground">
            The project buckets still tell you which execution runs are active, paused, idle, or already complete.
          </p>
        </div>
        <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-4">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-foreground">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Runtime pressure
          </div>
          <p className="text-[12px] leading-6 text-muted-foreground">
            Runtime-agent cards are decorated by execution-plane attention, approvals, async follow-through, and budget pressure.
          </p>
        </div>
        <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-4">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-foreground">
            <Link2 className="h-4 w-4 text-sky-400" />
            Recent runs
          </div>
          <p className="text-[12px] leading-6 text-muted-foreground">
            Action-run cards tell you what was recently executed, whether it was dry-run or apply, and whether audits or async steps are still open.
          </p>
        </div>
      </ShellSectionCard>

      <ShellSectionCard
        title="Audit pressure"
        description="Open shadow audits pulled out of recent action runs so operators can jump straight into quarantined artifact review."
        actions={<ShellActionLink href={auditsHref} label="Open audits queue" />}
        contentClassName="grid gap-3"
      >
        {openAuditPreviews.length > 0 ? (
          openAuditPreviews.map((audit) => (
            <ShellListLink
              key={audit.id}
              href={buildExecutionAuditScopeHref(audit.id, routeScope)}
              className="space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="truncate text-[14px] font-medium text-foreground">
                    {audit.summary || audit.source_name || audit.id}
                  </div>
                  <div className="text-[12px] leading-5 text-muted-foreground">
                    {audit.source_kind}
                    {audit.source_name ? ` · ${audit.source_name}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="danger">open</Badge>
                  <Badge
                    tone={
                      audit.action === "quarantine" || audit.action === "escalate"
                        ? "danger"
                        : audit.action === "retry"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {audit.action}
                  </Badge>
                </div>
              </div>
              <div className="grid gap-2 text-[12px] text-muted-foreground md:grid-cols-2">
                <span>{audit.findings.length} findings</span>
                <span>{audit.runtime_agent_ids.length} runtime agents</span>
                <span>updated {relativeTime(audit.updated_at)}</span>
                <span>from run {audit.sourceRunId}</span>
              </div>
            </ShellListLink>
          ))
        ) : (
          <ShellEmptyState
            centered
            icon={<ShieldCheck className="h-5 w-5" />}
            title="No open audit pressure"
            description="Recent execution-plane runs are not currently carrying open shadow audits."
            className="py-10"
          />
        )}
      </ShellSectionCard>

      <ShellSectionCard
        title="Connectivity"
        description="Project-level context still matters when you pivot from runtime-agent pressure into the full execution workspace."
        contentClassName="grid gap-3 md:grid-cols-3"
      >
        <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-4">
          <div className="text-[13px] font-medium text-foreground">Tracked projects</div>
          <p className="mt-2 text-[12px] leading-6 text-muted-foreground">
            {snapshot.projects.length} projects are present in the shell-owned execution fleet snapshot.
          </p>
        </div>
        <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-4">
          <div className="text-[13px] font-medium text-foreground">Connected runtimes</div>
          <p className="mt-2 text-[12px] leading-6 text-muted-foreground">
            {connectedCount} projects currently expose live runtime control or a runtime session id.
          </p>
        </div>
        <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-4">
          <div className="text-[13px] font-medium text-foreground">Latest run activity</div>
          <p className="mt-2 text-[12px] leading-6 text-muted-foreground">
            {snapshot.actionRunsSummary?.latest_run_at
              ? `Latest action run landed ${relativeTime(snapshot.actionRunsSummary.latest_run_at)}.`
              : "No execution-plane action run has been recorded yet."}
          </p>
        </div>
      </ShellSectionCard>
    </ShellPage>
  );
}
