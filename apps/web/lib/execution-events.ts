import type {
  AutopilotExecutionEventRecord,
  AutopilotExecutionRuntimeAgentRecord,
} from "@founderos/api-clients";

import type {
  ShellExecutionEventsCounts,
  ShellExecutionEventsSnapshot,
} from "@/lib/execution-events-model";
import {
  buildUpstreamQuery,
  formatUpstreamErrorMessage,
  requestUpstreamJson,
} from "@/lib/upstream";

function normalizeValue(value?: string | null) {
  return (value || "").trim();
}

function eventTimestamp(value?: string | null) {
  return Date.parse(value ?? "") || 0;
}

function sortEvents(items: AutopilotExecutionEventRecord[]) {
  return [...items].sort((left, right) => {
    const timeDiff = eventTimestamp(right.timestamp) - eventTimestamp(left.timestamp);
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return String(right.event ?? "").localeCompare(String(left.event ?? ""));
  });
}

function sortAgents(items: AutopilotExecutionRuntimeAgentRecord[]) {
  return [...items].sort((left, right) => {
    const leftProject = normalizeValue(left.project_name || left.project_id);
    const rightProject = normalizeValue(right.project_name || right.project_id);
    return leftProject.localeCompare(rightProject) || left.agent_id.localeCompare(right.agent_id);
  });
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

  if (status === "error" || status === "failed" || status === "warning") {
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

function buildCounts(events: AutopilotExecutionEventRecord[]): ShellExecutionEventsCounts {
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

export async function buildExecutionEventsSnapshot(filters?: {
  projectId?: string | null;
  runtimeAgentId?: string | null;
  orchestratorSessionId?: string | null;
  initiativeId?: string | null;
  orchestrator?: string | null;
  limit?: number | null;
}): Promise<ShellExecutionEventsSnapshot> {
  const projectId = normalizeValue(filters?.projectId);
  const runtimeAgentId = normalizeValue(filters?.runtimeAgentId);
  const orchestratorSessionId = normalizeValue(filters?.orchestratorSessionId);
  const initiativeId = normalizeValue(filters?.initiativeId);
  const orchestrator = normalizeValue(filters?.orchestrator);
  const limit =
    typeof filters?.limit === "number"
      ? Math.max(20, Math.min(Math.trunc(filters.limit), 400))
      : 200;

  const [eventsResult, agentsResult] = await Promise.allSettled([
    orchestratorSessionId
      ? requestUpstreamJson<{ events: AutopilotExecutionEventRecord[] }>(
          "autopilot",
          `execution-plane/orchestrator-sessions/${encodeURIComponent(orchestratorSessionId)}/events`,
          buildUpstreamQuery({ limit }),
          { timeoutMs: 5000 }
        )
      : requestUpstreamJson<{ events: AutopilotExecutionEventRecord[] }>(
          "autopilot",
          "execution-plane/events",
          buildUpstreamQuery({
            project_id: projectId,
            initiative_id: initiativeId,
            orchestrator,
            runtime_agent_id: runtimeAgentId,
            limit,
          }),
          { timeoutMs: 5000 }
        ),
    requestUpstreamJson<{ agents: AutopilotExecutionRuntimeAgentRecord[] }>(
      "autopilot",
      "execution-plane/agents",
      undefined,
      { timeoutMs: 5000 }
    ),
  ]);

  const events =
    eventsResult.status === "fulfilled" ? sortEvents(eventsResult.value.events) : [];
  const agents =
    agentsResult.status === "fulfilled" ? sortAgents(agentsResult.value.agents) : [];

  return {
    generatedAt: new Date().toISOString(),
    filters: {
      projectId,
      runtimeAgentId,
      orchestratorSessionId,
      limit,
    },
    events,
    eventsError:
      eventsResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage(
            orchestratorSessionId
              ? "Execution orchestrator-session events"
              : "Execution event feed",
            eventsResult.reason
          ),
    eventsLoadState: eventsResult.status === "fulfilled" ? "ready" : "error",
    agents,
    agentsError:
      agentsResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage("Execution runtime agents", agentsResult.reason),
    agentsLoadState: agentsResult.status === "fulfilled" ? "ready" : "error",
    counts: buildCounts(events),
  };
}
