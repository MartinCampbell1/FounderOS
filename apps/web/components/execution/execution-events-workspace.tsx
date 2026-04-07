"use client";

import type {
  AutopilotExecutionEventRecord,
  ShellPreferences,
} from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  Bot,
  CheckSquare,
  PlayCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import {
  ShellActionLink,
  ShellEmptyState,
  ShellHero,
  ShellHeroSearchField,
  ShellMetricCard,
  ShellPage,
  ShellPillButton,
  ShellRefreshButton,
  ShellSectionCard,
  ShellStatusBanner,
} from "@/components/shell/shell-screen-primitives";
import {
  emptyShellExecutionEventsSnapshot,
  type ShellExecutionEventsSnapshot,
} from "@/lib/execution-events-model";
import {
  buildExecutionAgentScopeHref,
  buildExecutionEventsScopeHref,
  buildExecutionProjectScopeHref,
  routeScopeFromProjectRef,
  type ShellRouteScope,
} from "@/lib/route-scope";
import {
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import {
  executionEventStreamLabel,
  mergeExecutionEventLists,
  useExecutionLiveEvents,
} from "@/lib/execution-live-events";
import { fetchShellExecutionEventsSnapshot } from "@/lib/shell-snapshot-client";
import { useShellManualRefresh } from "@/lib/use-shell-manual-refresh";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";

const EMPTY_EVENTS_SNAPSHOT = emptyShellExecutionEventsSnapshot();

type EventFilter = "all" | "attention" | "action-runs" | "approvals" | "issues";

type ExecutionEventsInitialFilters = {
  runtimeAgentId?: string;
  orchestratorSessionId?: string;
  initiativeId?: string;
  orchestrator?: string;
};

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

function sanitizeEventError(error: string | null) {
  if (!error) {
    return null;
  }

  const normalized = error.toLowerCase();
  if (
    normalized.includes("fetch failed") ||
    normalized.includes("timed out") ||
    normalized.includes("network")
  ) {
    return "Autopilot execution event feed is unavailable right now. Check the upstream connection in Settings, then refresh this route.";
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
  if (normalized === "ok" || normalized === "completed" || normalized === "success") {
    return "success";
  }
  if (normalized === "running" || normalized === "pending" || normalized === "info") {
    return "info";
  }
  if (normalized === "warning" || normalized === "partial" || normalized === "paused") {
    return "warning";
  }
  if (normalized === "failed" || normalized === "error" || normalized === "blocked") {
    return "danger";
  }
  return "neutral";
}

function eventRuntimeAgentIds(event: AutopilotExecutionEventRecord) {
  return [
    normalizeValue(event.runtime_agent_id),
    normalizeValue(event.worker_runtime_agent_id),
    normalizeValue(event.critic_runtime_agent_id),
    normalizeValue(event.specialist_runtime_agent_id),
    ...(event.runtime_agent_ids ?? []).map((value) => normalizeValue(value)),
  ].filter(Boolean);
}

function isAttentionEvent(event: AutopilotExecutionEventRecord) {
  const status = normalizeValue(event.status).toLowerCase();
  const eventName = normalizeValue(event.event).toLowerCase();

  if (status === "failed" || status === "error" || status === "warning") {
    return true;
  }
  if (normalizeValue(event.issue_id) || normalizeValue(event.approval_id)) {
    return true;
  }
  return (
    eventName.includes("failed") ||
    eventName.includes("approval") ||
    eventName.includes("issue") ||
    eventName.includes("quarantine") ||
    eventName.includes("blocked")
  );
}

function matchesEventFilter(event: AutopilotExecutionEventRecord, filter: EventFilter) {
  if (filter === "all") {
    return true;
  }
  if (filter === "attention") {
    return isAttentionEvent(event);
  }
  if (filter === "action-runs") {
    return Boolean(normalizeValue(event.agent_action_run_id));
  }
  if (filter === "approvals") {
    return Boolean(normalizeValue(event.approval_id));
  }
  return Boolean(normalizeValue(event.issue_id));
}

function matchesEventQuery(event: AutopilotExecutionEventRecord, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return [
    event.event,
    event.status,
    event.message,
    event.project_id,
    event.project_name,
    event.story_id,
    event.actor,
    event.agent_action_run_id,
    event.orchestrator_session_id,
    event.approval_id,
    event.issue_id,
    ...eventRuntimeAgentIds(event),
  ].some((value) =>
    String(value ?? "")
      .toLowerCase()
      .includes(normalized)
  );
}

function topEntries(map: Record<string, number>, limit = 6) {
  return Object.entries(map)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit);
}

function buildCounts(events: AutopilotExecutionEventRecord[]) {
  const projectIds = new Set<string>();
  const runtimeAgentIds = new Set<string>();
  const sessionIds = new Set<string>();
  const byStatus: Record<string, number> = {};
  const byEvent: Record<string, number> = {};
  let attention = 0;
  let actionRuns = 0;
  let approvals = 0;
  let issues = 0;

  for (const event of events) {
    const projectId = normalizeValue(event.project_id);
    const sessionId = normalizeValue(event.orchestrator_session_id);
    const status = normalizeValue(event.status) || "unknown";
    const eventName = normalizeValue(event.event) || "unknown";

    if (projectId) {
      projectIds.add(projectId);
    }
    if (sessionId) {
      sessionIds.add(sessionId);
    }
    for (const runtimeAgentId of eventRuntimeAgentIds(event)) {
      runtimeAgentIds.add(runtimeAgentId);
    }

    byStatus[status] = (byStatus[status] ?? 0) + 1;
    byEvent[eventName] = (byEvent[eventName] ?? 0) + 1;

    if (isAttentionEvent(event)) {
      attention += 1;
    }
    if (normalizeValue(event.agent_action_run_id)) {
      actionRuns += 1;
    }
    if (normalizeValue(event.approval_id)) {
      approvals += 1;
    }
    if (normalizeValue(event.issue_id)) {
      issues += 1;
    }
  }

  return {
    total: events.length,
    attention,
    actionRuns,
    approvals,
    issues,
    projects: projectIds.size,
    runtimeAgents: runtimeAgentIds.size,
    sessions: sessionIds.size,
    latestEventAt: events[0]?.timestamp ?? null,
    byStatus,
    byEvent,
  };
}

function EventCard({
  event,
  routeScope,
  activeSessionId,
}: {
  event: AutopilotExecutionEventRecord;
  routeScope: ShellRouteScope;
  activeSessionId: string;
}) {
  const runtimeAgentIds = eventRuntimeAgentIds(event);
  const effectiveProjectId = normalizeValue(event.project_id) || routeScope.projectId;
  const scopedRouteScope = routeScopeFromProjectRef(
    effectiveProjectId,
    null,
    routeScope
  );
  const singleRuntimeAgentId = runtimeAgentIds.length === 1 ? runtimeAgentIds[0] : "";
  const projectHref = effectiveProjectId
    ? buildExecutionProjectScopeHref(effectiveProjectId, scopedRouteScope)
    : "";
  const agentHref = singleRuntimeAgentId
    ? buildExecutionAgentScopeHref(singleRuntimeAgentId, scopedRouteScope)
    : "";
  const sessionId = normalizeValue(event.orchestrator_session_id);
  const sessionHref =
    sessionId && sessionId !== activeSessionId
      ? buildExecutionEventsScopeHref(scopedRouteScope, {
          orchestratorSessionId: sessionId,
        })
      : "";

  return (
    <div className="space-y-3 rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="truncate text-[14px] font-medium text-foreground">
            {humanizeToken(event.event)}
          </div>
          <div className="text-[12px] leading-5 text-muted-foreground">
            {event.message || "No execution-plane message was attached to this event."}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(event.status)}>{event.status || "unknown"}</Badge>
          {event.agent_action_run_id ? <Badge tone="info">action run</Badge> : null}
          {event.approval_id ? <Badge tone="warning">approval</Badge> : null}
          {event.issue_id ? <Badge tone="danger">issue</Badge> : null}
        </div>
      </div>

      <div className="grid gap-2 text-[12px] text-muted-foreground md:grid-cols-2">
        <span>
          {event.project_name || effectiveProjectId
            ? `Project ${event.project_name || effectiveProjectId}`
            : "Project context unavailable"}
        </span>
        <span>{relativeTime(event.timestamp)}</span>
        {typeof event.story_id === "number" ? <span>Story {event.story_id}</span> : null}
        {event.actor ? <span>Actor {event.actor}</span> : null}
        {event.agent_action_run_id ? (
          <span className="break-all">Run {event.agent_action_run_id}</span>
        ) : null}
        {sessionId ? <span className="break-all">Session {sessionId}</span> : null}
        {runtimeAgentIds.length > 0 ? (
          <span className="md:col-span-2 break-all">
            Runtime agents: {runtimeAgentIds.join(", ")}
          </span>
        ) : null}
      </div>

      {projectHref || agentHref || sessionHref ? (
        <div className="flex flex-wrap gap-3 text-[12px] font-medium">
          {projectHref ? (
            <Link href={projectHref} className="text-accent transition-colors hover:text-foreground">
              Open project
            </Link>
          ) : null}
          {agentHref ? (
            <Link href={agentHref} className="text-accent transition-colors hover:text-foreground">
              Open agent
            </Link>
          ) : null}
          {sessionHref ? (
            <Link href={sessionHref} className="text-accent transition-colors hover:text-foreground">
              Scope to session
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ExecutionEventsWorkspace({
  initialPreferences,
  initialSnapshot,
  routeScope = { projectId: "", intakeSessionId: "" },
  initialFilters,
}: {
  initialPreferences?: ShellPreferences;
  initialSnapshot?: ShellExecutionEventsSnapshot | null;
  routeScope?: ShellRouteScope;
  initialFilters?: ExecutionEventsInitialFilters;
}) {
  const { preferences } = useShellPreferences(initialPreferences);
  const pollIntervalMs = getShellPollInterval(
    "execution_projects",
    preferences.refreshProfile
  );
  const { isRefreshing, refresh, refreshNonce } = useShellManualRefresh();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<EventFilter>("all");

  const loadSnapshot = useCallback(
    () => {
      const url = new URL(
        "/api/shell/execution/events",
        "http://founderos-shell.local"
      );
      if (routeScope.projectId) {
        url.searchParams.set("project_id", routeScope.projectId);
      }
      if (initialFilters?.runtimeAgentId) {
        url.searchParams.set("runtime_agent_id", initialFilters.runtimeAgentId);
      }
      if (initialFilters?.orchestratorSessionId) {
        url.searchParams.set(
          "orchestrator_session_id",
          initialFilters.orchestratorSessionId
        );
      }
      if (initialFilters?.initiativeId) {
        url.searchParams.set("initiative_id", initialFilters.initiativeId);
      }
      if (initialFilters?.orchestrator) {
        url.searchParams.set("orchestrator", initialFilters.orchestrator);
      }
      url.searchParams.set("limit", "250");
      return fetchShellExecutionEventsSnapshot(`${url.pathname}${url.search}`);
    },
    [initialFilters, routeScope.projectId]
  );
  const selectLoadState = useCallback(
    (snapshot: ShellExecutionEventsSnapshot) => snapshot.eventsLoadState,
    []
  );

  const { loadState, snapshot } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_EVENTS_SNAPSHOT,
    initialSnapshot,
    refreshNonce,
    pollIntervalMs,
    loadSnapshot,
    selectLoadState,
  });

  const error = useMemo(
    () => sanitizeEventError(snapshot.eventsError),
    [snapshot.eventsError]
  );
  const { events: liveEvents, streamState } = useExecutionLiveEvents({
    routeScope,
    filters: {
      projectId: routeScope.projectId,
      runtimeAgentId: initialFilters?.runtimeAgentId,
      orchestratorSessionId: initialFilters?.orchestratorSessionId,
      initiativeId: initialFilters?.initiativeId,
      orchestrator: initialFilters?.orchestrator,
    },
  });
  const mergedEvents = useMemo(
    () => mergeExecutionEventLists(snapshot.events, liveEvents),
    [liveEvents, snapshot.events]
  );
  const counts = useMemo(() => buildCounts(mergedEvents), [mergedEvents]);
  const visibleEvents = useMemo(
    () =>
      mergedEvents.filter((event) => {
        if (!matchesEventFilter(event, filter)) {
          return false;
        }
        return matchesEventQuery(event, query);
      }),
    [filter, mergedEvents, query]
  );
  const topStatuses = useMemo(
    () => topEntries(counts.byStatus),
    [counts.byStatus]
  );
  const topEvents = useMemo(
    () => topEntries(counts.byEvent),
    [counts.byEvent]
  );
  const hasScopedFilters = Boolean(
    routeScope.projectId ||
      initialFilters?.runtimeAgentId ||
      initialFilters?.orchestratorSessionId ||
      initialFilters?.initiativeId ||
      initialFilters?.orchestrator
  );

  return (
    <ShellPage>
      <ShellHero
        title="Events"
        description="Poll-first execution-plane event feed covering runtime project events, action-run lifecycle changes, approvals, issues, and session-linked operational signals."
        meta={
          <>
            <span>{counts.total} events in scope</span>
            <span>{counts.projects} projects touched</span>
            <span>{counts.runtimeAgents} runtime agents referenced</span>
            <span>{executionEventStreamLabel(streamState)}</span>
          </>
        }
        actions={
          <>
            {initialFilters?.runtimeAgentId || initialFilters?.orchestratorSessionId ? (
              <ShellActionLink
                href={buildExecutionEventsScopeHref(routeScope)}
                label="Clear event filters"
              />
            ) : null}
            <ShellRefreshButton
              busy={isRefreshing || loadState === "loading"}
              onClick={refresh}
              compact
            />
          </>
        }
      />

      {error ? <ShellStatusBanner tone="danger">{error}</ShellStatusBanner> : null}
      {!error && streamState !== "idle" ? (
        <ShellStatusBanner tone="info">
          Live event stream status: {executionEventStreamLabel(streamState)}. Snapshot polling still refreshes the wider route state.
        </ShellStatusBanner>
      ) : null}
      {hasScopedFilters ? (
        <ShellStatusBanner tone="info">
          {routeScope.projectId ? `Project ${routeScope.projectId}` : "Global"} scope
          {initialFilters?.runtimeAgentId
            ? ` · runtime agent ${initialFilters.runtimeAgentId}`
            : ""}
          {initialFilters?.orchestratorSessionId
            ? ` · session ${initialFilters.orchestratorSessionId}`
            : ""}
          {initialFilters?.initiativeId ? ` · initiative ${initialFilters.initiativeId}` : ""}
          {initialFilters?.orchestrator ? ` · orchestrator ${initialFilters.orchestrator}` : ""}
        </ShellStatusBanner>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4">
          <ShellMetricCard
            label="Events in scope"
            value={String(counts.total)}
            detail="The current route-scope plus event filters determine this feed."
          />
        </div>
        <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4">
          <ShellMetricCard
            label="Attention signals"
            value={String(counts.attention)}
            detail="Warnings, failures, issues, and approval-linked events."
          />
        </div>
        <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4">
          <ShellMetricCard
            label="Action-run lifecycle"
            value={String(counts.actionRuns)}
            detail="Events attached to execution-plane batch or single-agent runs."
          />
        </div>
        <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4">
          <ShellMetricCard
            label="Latest event"
            value={relativeTime(counts.latestEventAt, "No events yet")}
            detail="This feed currently tracks the newest execution-plane state transition at the top."
          />
        </div>
      </div>

      <ShellSectionCard
        title={`Event feed (${visibleEvents.length})`}
        description="Search by event name, project, runtime agent, run id, session id, approval id, or issue id, then pivot into the affected project or agent."
        contentClassName="space-y-4"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <ShellHeroSearchField
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by event, project, runtime agent, run id, session id, approval, or issue..."
          />
          <div className="flex flex-wrap gap-2">
            {([
              { key: "all", label: "All", icon: <Activity className="h-3.5 w-3.5" /> },
              {
                key: "attention",
                label: "Attention",
                icon: <AlertTriangle className="h-3.5 w-3.5" />,
              },
              {
                key: "action-runs",
                label: "Action runs",
                icon: <PlayCircle className="h-3.5 w-3.5" />,
              },
              {
                key: "approvals",
                label: "Approvals",
                icon: <CheckSquare className="h-3.5 w-3.5" />,
              },
              {
                key: "issues",
                label: "Issues",
                icon: <ArrowRightLeft className="h-3.5 w-3.5" />,
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

        {visibleEvents.length > 0 ? (
          <div className="grid gap-3">
            {visibleEvents.map((event, index) => (
              <EventCard
                key={`${event.timestamp ?? "event"}:${event.event}:${index}`}
                event={event}
                routeScope={routeScope}
                activeSessionId={initialFilters?.orchestratorSessionId ?? ""}
              />
            ))}
          </div>
        ) : (
          <ShellEmptyState
            centered
            icon={<Activity className="h-5 w-5" />}
            title={snapshot.events.length > 0 ? "No matching events" : "No execution events yet"}
            description={
              snapshot.events.length > 0
                ? "No events match the current search or feed filter."
                : error
                  ? "Execution events will reappear here once Autopilot reconnects."
                  : "Autopilot will populate this feed once runtime projects or control-plane actions emit events."
            }
            action={
              snapshot.events.length > 0
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
        )}
      </ShellSectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <ShellSectionCard
          title="Status mix"
          description="The current feed grouped by event status."
          contentClassName="grid gap-3"
        >
          {topStatuses.length > 0 ? (
            topStatuses.map(([status, count]) => (
              <div
                key={status}
                className="flex items-center justify-between rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4 py-3"
              >
                <div className="text-[13px] font-medium text-foreground">
                  {humanizeToken(status)}
                </div>
                <Badge tone={statusTone(status)}>{count}</Badge>
              </div>
            ))
          ) : (
            <ShellEmptyState
              centered
              icon={<AlertTriangle className="h-5 w-5" />}
              title="No status breakdown yet"
              description="Status counts will appear once the feed contains execution events."
              className="py-10"
            />
          )}
        </ShellSectionCard>

        <ShellSectionCard
          title="Top event kinds"
          description="Highest-volume event names in the current feed scope."
          contentClassName="grid gap-3"
        >
          {topEvents.length > 0 ? (
            topEvents.map(([eventName, count]) => (
              <div
                key={eventName}
                className="flex items-center justify-between rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4 py-3"
              >
                <div className="min-w-0 text-[13px] font-medium text-foreground">
                  <span className="truncate">{humanizeToken(eventName)}</span>
                </div>
                <Badge tone="neutral">{count}</Badge>
              </div>
            ))
          ) : (
            <ShellEmptyState
              centered
              icon={<Bot className="h-5 w-5" />}
              title="No event mix yet"
              description="Once execution emits runtime events, the dominant event names will surface here."
              className="py-10"
            />
          )}
        </ShellSectionCard>
      </div>
    </ShellPage>
  );
}
