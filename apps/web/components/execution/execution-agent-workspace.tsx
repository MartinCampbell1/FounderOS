"use client";

import type {
  AutopilotExecutionApprovalRecord,
  AutopilotExecutionEventRecord,
  AutopilotExecutionIssueRecord,
  AutopilotExecutionRuntimeAgentDetail,
  AutopilotExecutionRuntimeAgentTaskRecord,
  AutopilotToolPermissionRuntimeRecord,
  ShellPreferences,
} from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import {
  Activity,
  Bot,
  CheckSquare,
  Clock3,
  PlayCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo } from "react";

import {
  ShellActionLink,
  ShellEmptyState,
  ShellHero,
  ShellMetricCard,
  ShellPage,
  ShellRefreshButton,
  ShellSectionCard,
  ShellStatusBanner,
} from "@/components/shell/shell-screen-primitives";
import {
  emptyShellExecutionAgentSnapshot,
  type ShellExecutionAgentSnapshot,
} from "@/lib/execution-agent-model";
import {
  buildExecutionEventsScopeHref,
  buildExecutionProjectScopeHref,
  buildExecutionReviewScopeHref,
  routeScopeFromProjectRef,
  type ShellRouteScope,
  withShellRouteScope,
} from "@/lib/route-scope";
import {
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import { fetchShellExecutionAgentSnapshot } from "@/lib/shell-snapshot-client";
import { useShellManualRefresh } from "@/lib/use-shell-manual-refresh";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";

const EMPTY_AGENT_SNAPSHOT = emptyShellExecutionAgentSnapshot();

function normalizeValue(value?: string | null) {
  return (value || "").trim();
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

function sanitizeAgentError(error: string | null) {
  if (!error) {
    return null;
  }

  const normalized = error.toLowerCase();
  if (
    normalized.includes("fetch failed") ||
    normalized.includes("timed out") ||
    normalized.includes("network")
  ) {
    return "Autopilot runtime-agent detail is unavailable right now. Check the upstream connection in Settings, then refresh this route.";
  }

  return error;
}

function humanizeToken(value?: string | null) {
  const normalized = normalizeValue(value);
  if (!normalized) {
    return "unknown";
  }
  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function statusTone(
  status?: string | null
): "neutral" | "success" | "warning" | "danger" | "info" {
  const normalized = normalizeValue(status).toLowerCase();
  if (normalized === "active" || normalized === "running" || normalized === "ok") {
    return "success";
  }
  if (normalized === "waiting_async" || normalized === "pending") {
    return "info";
  }
  if (
    normalized === "needs_approval" ||
    normalized === "budget_risk" ||
    normalized === "paused" ||
    normalized === "warning"
  ) {
    return "warning";
  }
  if (
    normalized === "blocked" ||
    normalized === "failed" ||
    normalized === "error" ||
    normalized === "budget_exhausted"
  ) {
    return "danger";
  }
  return "neutral";
}

function plainCard(children: React.ReactNode) {
  return (
    <div className="space-y-2 rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-4">
      {children}
    </div>
  );
}

function detailLabel(record: object, keys: string[]) {
  const source = record as Record<string, unknown>;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function formatRecommendation(record: Record<string, unknown>) {
  return (
    detailLabel(record, ["title", "label", "command", "kind"]) ||
    "Untitled recommendation"
  );
}

function formatRecommendationDetail(record: Record<string, unknown>) {
  return (
    detailLabel(record, ["description", "message", "reason", "detail"]) ||
    "No additional rationale was provided."
  );
}

function IssueCard({ issue }: { issue: AutopilotExecutionIssueRecord }) {
  return plainCard(
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="truncate text-[14px] font-medium text-foreground">
            {issue.title || issue.id}
          </div>
          <div className="text-[12px] leading-5 text-muted-foreground">
            {issue.description || issue.root_cause || "No issue summary provided."}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(issue.status)}>{issue.status}</Badge>
          <Badge tone={statusTone(issue.severity)}>{issue.severity}</Badge>
        </div>
      </div>
      <div className="grid gap-2 text-[12px] text-muted-foreground md:grid-cols-2">
        <span>{issue.category}</span>
        <span>{relativeTime(issue.updated_at)}</span>
        {issue.source_event ? <span>Source event {issue.source_event}</span> : null}
        {issue.related_command ? <span>Command {issue.related_command}</span> : null}
      </div>
    </>
  );
}

function ApprovalCard({ approval }: { approval: AutopilotExecutionApprovalRecord }) {
  return plainCard(
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="truncate text-[14px] font-medium text-foreground">
            {approval.action || approval.id}
          </div>
          <div className="text-[12px] leading-5 text-muted-foreground">
            {approval.reason || "No approval rationale was attached."}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(approval.status)}>{approval.status}</Badge>
          <Badge tone="neutral">{approval.requested_by}</Badge>
        </div>
      </div>
      <div className="grid gap-2 text-[12px] text-muted-foreground md:grid-cols-2">
        <span>{approval.runtime_agent_ids.length} linked runtime agents</span>
        <span>{relativeTime(approval.updated_at)}</span>
        {approval.policy_reasons.length > 0 ? (
          <span className="md:col-span-2 line-clamp-2">
            {approval.policy_reasons.join(" · ")}
          </span>
        ) : null}
      </div>
    </>
  );
}

function ToolPermissionCard({
  runtime,
}: {
  runtime: AutopilotToolPermissionRuntimeRecord;
}) {
  return plainCard(
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="truncate text-[14px] font-medium text-foreground">
            {runtime.tool_name || runtime.key || runtime.id}
          </div>
          <div className="text-[12px] leading-5 text-muted-foreground">
            {runtime.message || "No tool-permission note was attached."}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(runtime.status)}>{runtime.status}</Badge>
          <Badge tone="neutral">{runtime.pending_stage || "pending"}</Badge>
        </div>
      </div>
      <div className="grid gap-2 text-[12px] text-muted-foreground md:grid-cols-2">
        <span>{runtime.runtime_agent_ids.length} linked runtime agents</span>
        <span>{relativeTime(runtime.updated_at)}</span>
        {runtime.resolved_behavior ? <span>{runtime.resolved_behavior}</span> : null}
        {runtime.resolved_source ? <span>{runtime.resolved_source}</span> : null}
      </div>
    </>
  );
}

function AsyncTaskCard({ task }: { task: AutopilotExecutionRuntimeAgentTaskRecord }) {
  const taskLabel =
    detailLabel(task, ["title", "command", "id"]) || "Background task";
  const taskSummary =
    detailLabel(task, ["result_summary", "reason", "placeholder_result", "message"]) ||
    "No background-task summary was attached.";
  const status = detailLabel(task, ["status"]) || "unknown";
  const createdAt = detailLabel(task, ["created_at"]);
  const completedAt = detailLabel(task, ["completed_at"]);
  const command = detailLabel(task, ["command"]);
  const settlementReason = detailLabel(task, ["settlement_reason"]);
  const settlementStatus = detailLabel(task, ["settlement_state_status"]);
  const auditCount = Number(task.open_shadow_audit_count ?? 0) || 0;

  return plainCard(
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="truncate text-[14px] font-medium text-foreground">
            {taskLabel}
          </div>
          <div className="text-[12px] leading-5 text-muted-foreground">
            {taskSummary}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(status)}>{status}</Badge>
          {auditCount > 0 ? <Badge tone="danger">{auditCount} open audits</Badge> : null}
        </div>
      </div>
      <div className="grid gap-2 text-[12px] text-muted-foreground md:grid-cols-2">
        {command ? <span>Command {command}</span> : null}
        <span>{completedAt ? `settled ${relativeTime(completedAt)}` : relativeTime(createdAt)}</span>
        {settlementReason ? <span>{settlementReason}</span> : null}
        {settlementStatus ? <span>{settlementStatus}</span> : null}
      </div>
    </>
  );
}

function EventCard({ event }: { event: AutopilotExecutionEventRecord }) {
  const runtimeAgentIds = [
    normalizeValue(event.runtime_agent_id),
    ...(event.runtime_agent_ids ?? []).map((value) => normalizeValue(value)),
  ].filter(Boolean);

  return plainCard(
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="truncate text-[14px] font-medium text-foreground">
            {humanizeToken(event.event)}
          </div>
          <div className="text-[12px] leading-5 text-muted-foreground">
            {event.message || "No event message was attached."}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(event.status)}>{event.status || "unknown"}</Badge>
          {event.agent_action_run_id ? <Badge tone="info">action run</Badge> : null}
          {event.issue_id ? <Badge tone="danger">issue</Badge> : null}
          {event.approval_id ? <Badge tone="warning">approval</Badge> : null}
        </div>
      </div>
      <div className="grid gap-2 text-[12px] text-muted-foreground md:grid-cols-2">
        <span>{relativeTime(event.timestamp)}</span>
        {event.actor ? <span>Actor {event.actor}</span> : null}
        {event.agent_action_run_id ? <span>Run {event.agent_action_run_id}</span> : null}
        {event.orchestrator_session_id ? (
          <span className="break-all">Session {event.orchestrator_session_id}</span>
        ) : null}
        {runtimeAgentIds.length > 0 ? (
          <span className="md:col-span-2 break-all">
            Runtime agents: {runtimeAgentIds.join(", ")}
          </span>
        ) : null}
      </div>
    </>
  );
}

function recommendationsSection(detail: AutopilotExecutionRuntimeAgentDetail) {
  const recommendations = detail.recommendations ?? [];
  const suggestedCommands = detail.suggested_commands ?? [];
  if (recommendations.length === 0 && suggestedCommands.length === 0) {
    return null;
  }

  return (
    <ShellSectionCard
      title="Recommended next moves"
      description="Execution-plane recommendations and suggested commands attached to this runtime agent."
      contentClassName="grid gap-3 md:grid-cols-2"
    >
      {recommendations.map((recommendation, index) =>
        plainCard(
          <div key={`recommendation:${index}`} className="space-y-2">
            <div className="text-[14px] font-medium text-foreground">
              {formatRecommendation(recommendation)}
            </div>
            <div className="text-[12px] leading-5 text-muted-foreground">
              {formatRecommendationDetail(recommendation)}
            </div>
          </div>
        )
      )}
      {suggestedCommands.map((command, index) =>
        plainCard(
          <div key={`command:${index}`} className="space-y-2">
            <div className="text-[14px] font-medium text-foreground">
              {formatRecommendation(command)}
            </div>
            <div className="text-[12px] leading-5 text-muted-foreground">
              {formatRecommendationDetail(command)}
            </div>
          </div>
        )
      )}
    </ShellSectionCard>
  );
}

export function ExecutionAgentWorkspace({
  runtimeAgentId,
  initialPreferences,
  initialSnapshot,
  routeScope = { projectId: "", intakeSessionId: "" },
}: {
  runtimeAgentId: string;
  initialPreferences?: ShellPreferences;
  initialSnapshot?: ShellExecutionAgentSnapshot | null;
  routeScope?: ShellRouteScope;
}) {
  const { preferences } = useShellPreferences(initialPreferences);
  const pollIntervalMs = getShellPollInterval(
    "execution_projects",
    preferences.refreshProfile
  );
  const { isRefreshing, refresh, refreshNonce } = useShellManualRefresh();

  const loadSnapshot = useCallback(
    () => fetchShellExecutionAgentSnapshot(runtimeAgentId),
    [runtimeAgentId]
  );
  const selectLoadState = useCallback(
    (snapshot: ShellExecutionAgentSnapshot) => snapshot.agentLoadState,
    []
  );

  const { loadState, snapshot } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_AGENT_SNAPSHOT,
    initialSnapshot,
    refreshNonce,
    pollIntervalMs,
    loadSnapshot,
    selectLoadState,
  });

  const error = useMemo(
    () => sanitizeAgentError(snapshot.agentError),
    [snapshot.agentError]
  );
  const detail = snapshot.agent;
  const scopedRouteScope = routeScopeFromProjectRef(
    detail?.project_id || routeScope.projectId,
    null,
    routeScope
  );
  const projectHref =
    detail?.project_id
      ? buildExecutionProjectScopeHref(detail.project_id, scopedRouteScope)
      : "";
  const eventsHref = buildExecutionEventsScopeHref(scopedRouteScope, {
    runtimeAgentId,
  });
  const agentsHref = withShellRouteScope("/execution/agents", scopedRouteScope);
  const latestEventAt = detail?.history.last_event_at ?? detail?.events[0]?.timestamp ?? null;

  if (!detail && error) {
    return (
      <ShellPage>
        <ShellHero
          title="Runtime agent"
          description="Execution-plane runtime-agent detail route."
          actions={
            <ShellRefreshButton
              busy={isRefreshing || loadState === "loading"}
              onClick={refresh}
              compact
            />
          }
        />
        <ShellStatusBanner tone="danger">{error}</ShellStatusBanner>
        <ShellEmptyState
          centered
          icon={<Bot className="h-5 w-5" />}
          title="Runtime agent detail unavailable"
          description="The requested runtime agent could not be loaded from the execution plane."
          className="py-16"
        />
      </ShellPage>
    );
  }

  return (
    <ShellPage>
      <ShellHero
        title={detail?.current?.label || runtimeAgentId}
        description={
          detail
            ? detail.attention?.recommended_action ||
              detail.story_title ||
              "Execution-plane runtime-agent detail with issues, approvals, async follow-through, and recent events."
            : "Loading runtime-agent detail."
        }
        meta={
          detail ? (
            <>
              <span>{detail.project_name}</span>
              <span>{detail.role}</span>
              <span>{detail.status}</span>
              <span>{relativeTime(latestEventAt)}</span>
            </>
          ) : undefined
        }
        actions={
          <>
            <ShellActionLink href={agentsHref} label="Back to agents" />
            <ShellActionLink href={eventsHref} label="Open event feed" />
            <ShellRefreshButton
              busy={isRefreshing || loadState === "loading"}
              onClick={refresh}
              compact
            />
          </>
        }
      />

      {error ? <ShellStatusBanner tone="danger">{error}</ShellStatusBanner> : null}
      {detail && !detail.current ? (
        <ShellStatusBanner tone="info">
          This runtime agent is currently historical. Issues, approvals, tasks, and events still remain available for audit.
        </ShellStatusBanner>
      ) : null}

      {detail ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4">
              <ShellMetricCard
                label="Open issues"
                value={String(detail.history.open_issue_count)}
                detail="Execution-plane issues still attached to this agent."
              />
            </div>
            <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4">
              <ShellMetricCard
                label="Pending approvals"
                value={String(detail.history.pending_approval_count)}
                detail="Approvals still blocking or gating agent progress."
              />
            </div>
            <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4">
              <ShellMetricCard
                label="Active async tasks"
                value={String(detail.history.active_async_task_count)}
                detail="Background follow-through still running for this agent."
              />
            </div>
            <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4">
              <ShellMetricCard
                label="Latest event"
                value={relativeTime(latestEventAt)}
                detail="Most recent execution-plane event attached to this runtime agent."
              />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <ShellSectionCard
              title="Current runtime"
              description="Live or historical runtime identity, story alignment, and operator attention for this agent."
              contentClassName="grid gap-3 md:grid-cols-2"
            >
              {plainCard(
                <>
                  <div className="text-[14px] font-medium text-foreground">
                    Runtime identity
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={statusTone(detail.status)}>{detail.status}</Badge>
                    <Badge tone={statusTone(detail.attention?.state)}>
                      {detail.attention?.state || "unknown"}
                    </Badge>
                    <Badge tone="neutral">{detail.role}</Badge>
                    {detail.current?.provider ? (
                      <Badge tone="neutral">{detail.current.provider}</Badge>
                    ) : null}
                    {detail.current?.profile_name ? (
                      <Badge tone="neutral">{detail.current.profile_name}</Badge>
                    ) : null}
                    {detail.current?.pipeline_stage ? (
                      <Badge tone="info">{detail.current.pipeline_stage}</Badge>
                    ) : null}
                  </div>
                  <div className="space-y-1 text-[12px] leading-5 text-muted-foreground">
                    <div>{detail.current?.label || runtimeAgentId}</div>
                    {detail.attention?.recommended_action ? (
                      <div>Next step: {detail.attention.recommended_action}</div>
                    ) : null}
                    {detail.budget?.usage_label ? <div>{detail.budget.usage_label}</div> : null}
                  </div>
                </>
              )}

              {plainCard(
                <>
                  <div className="text-[14px] font-medium text-foreground">
                    Story alignment
                  </div>
                  <div className="space-y-1 text-[12px] leading-5 text-muted-foreground">
                    <div>
                      Story {detail.story_id ?? detail.story.id ?? "?"}
                      {detail.story_title || detail.story.title
                        ? ` · ${detail.story_title || detail.story.title}`
                        : ""}
                    </div>
                    {detail.story.status ? <div>Status {detail.story.status}</div> : null}
                    {typeof detail.story.iteration === "number" ? (
                      <div>Iteration {detail.story.iteration}</div>
                    ) : null}
                    {detail.story.phase_title ? <div>{detail.story.phase_title}</div> : null}
                  </div>
                </>
              )}

              {plainCard(
                <>
                  <div className="text-[14px] font-medium text-foreground">
                    Project context
                  </div>
                  <div className="space-y-1 text-[12px] leading-5 text-muted-foreground">
                    <div>{detail.project.name}</div>
                    <div>{detail.project.path}</div>
                    <div>
                      {detail.project.status}
                      {detail.project.paused ? " · paused" : ""}
                    </div>
                  </div>
                  {projectHref ? (
                    <div className="pt-1">
                      <Link href={projectHref} className="text-[12px] font-medium text-accent transition-colors hover:text-foreground">
                        Open project
                      </Link>
                    </div>
                  ) : null}
                </>
              )}

              {plainCard(
                <>
                  <div className="text-[14px] font-medium text-foreground">
                    History rollup
                  </div>
                  <div className="grid gap-2 text-[12px] text-muted-foreground md:grid-cols-2">
                    <span>{detail.history.issue_count} issues logged</span>
                    <span>{detail.history.approval_count} approvals logged</span>
                    <span>{detail.history.async_task_count} async tasks</span>
                    <span>{detail.history.event_count} events</span>
                  </div>
                </>
              )}
            </ShellSectionCard>

            {recommendationsSection(detail)}
          </div>

          {detail.issues.length > 0 ? (
            <ShellSectionCard
              title={`Issues (${detail.issues.length})`}
              description="Execution-plane issues linked to this runtime agent."
              actions={
                <ShellActionLink
                  href={buildExecutionReviewScopeHref(scopedRouteScope, "issues")}
                  label="Open issues queue"
                />
              }
              contentClassName="grid gap-3"
            >
              {detail.issues.map((issue) => (
                <IssueCard key={issue.id} issue={issue} />
              ))}
            </ShellSectionCard>
          ) : null}

          {detail.approvals.length > 0 ? (
            <ShellSectionCard
              title={`Approvals (${detail.approvals.length})`}
              description="Pending or historical approvals linked to this runtime agent."
              actions={
                <ShellActionLink
                  href={buildExecutionReviewScopeHref(scopedRouteScope, "approvals")}
                  label="Open approvals queue"
                />
              }
              contentClassName="grid gap-3"
            >
              {detail.approvals.map((approval) => (
                <ApprovalCard key={approval.id} approval={approval} />
              ))}
            </ShellSectionCard>
          ) : null}

          {detail.tool_permission_runtimes.length > 0 ? (
            <ShellSectionCard
              title={`Tool permissions (${detail.tool_permission_runtimes.length})`}
              description="Tool-permission prompts and settlement state linked to this runtime agent."
              actions={
                <ShellActionLink
                  href={buildExecutionReviewScopeHref(scopedRouteScope, "runtimes")}
                  label="Open runtime review"
                />
              }
              contentClassName="grid gap-3"
            >
              {detail.tool_permission_runtimes.map((runtime) => (
                <ToolPermissionCard key={runtime.id} runtime={runtime} />
              ))}
            </ShellSectionCard>
          ) : null}

          {detail.async_tasks.length > 0 ? (
            <ShellSectionCard
              title={`Async follow-through (${detail.async_tasks.length})`}
              description="Background tasks attached to this runtime agent and their current settlement state."
              contentClassName="grid gap-3"
            >
              {detail.async_tasks.map((task, index) => (
                <AsyncTaskCard key={String(task.id ?? index)} task={task} />
              ))}
            </ShellSectionCard>
          ) : null}

          <ShellSectionCard
            title={`Event timeline (${detail.events.length})`}
            description="Recent execution-plane events attached to this runtime agent."
            actions={<ShellActionLink href={eventsHref} label="Open scoped event feed" />}
            contentClassName="grid gap-3"
          >
            {detail.events.length > 0 ? (
              detail.events.map((event, index) => (
                <EventCard
                  key={`${event.timestamp ?? "event"}:${event.event}:${index}`}
                  event={event}
                />
              ))
            ) : (
              <ShellEmptyState
                centered
                icon={<Activity className="h-5 w-5" />}
                title="No runtime events yet"
                description="Execution-plane events will appear here once this runtime agent emits state transitions."
                className="py-10"
              />
            )}
          </ShellSectionCard>

          {detail.issues.length === 0 &&
          detail.approvals.length === 0 &&
          detail.tool_permission_runtimes.length === 0 &&
          detail.async_tasks.length === 0 ? (
            <ShellSectionCard
              title="No current blockers"
              description="This runtime agent is not currently carrying linked issues, approvals, tool-permission prompts, or async tasks."
              contentClassName="grid gap-3 md:grid-cols-3"
            >
              {plainCard(
                <>
                  <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-foreground">
                    <PlayCircle className="h-4 w-4 text-emerald-400" />
                    Runtime looks clean
                  </div>
                  <p className="text-[12px] leading-6 text-muted-foreground">
                    The agent is not currently blocked on control-plane issues or review work.
                  </p>
                </>
              )}
              {plainCard(
                <>
                  <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-foreground">
                    <CheckSquare className="h-4 w-4 text-sky-400" />
                    No approval pressure
                  </div>
                  <p className="text-[12px] leading-6 text-muted-foreground">
                    There are no pending approvals or tool-permission prompts in the linked runtime history.
                  </p>
                </>
              )}
              {plainCard(
                <>
                  <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-foreground">
                    <Clock3 className="h-4 w-4 text-amber-400" />
                    No async drift
                  </div>
                  <p className="text-[12px] leading-6 text-muted-foreground">
                    Background follow-through is currently clear, so the remaining signal is in the event timeline.
                  </p>
                </>
              )}
            </ShellSectionCard>
          ) : null}
        </>
      ) : (
        <ShellEmptyState
          centered
          icon={<Bot className="h-5 w-5" />}
          title="Waiting for runtime-agent detail"
          description="Execution-plane detail will appear here once the runtime agent snapshot loads."
          className="py-16"
        />
      )}
    </ShellPage>
  );
}
