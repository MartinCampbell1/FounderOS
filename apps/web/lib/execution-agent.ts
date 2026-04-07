import type {
  AutopilotExecutionApprovalRecord,
  AutopilotExecutionEventRecord,
  AutopilotExecutionIssueRecord,
  AutopilotExecutionRuntimeAgentDetail,
  AutopilotExecutionRuntimeAgentTaskRecord,
  AutopilotToolPermissionRuntimeRecord,
} from "@founderos/api-clients";

import type { ShellExecutionAgentSnapshot } from "@/lib/execution-agent-model";
import { formatUpstreamErrorMessage, requestUpstreamJson } from "@/lib/upstream";

function normalizeRuntimeAgentId(value?: string | null) {
  return (value || "").trim();
}

function sortEvents(events: AutopilotExecutionEventRecord[]) {
  return [...events].sort((left, right) => {
    const leftTime = Date.parse(left.timestamp ?? "") || 0;
    const rightTime = Date.parse(right.timestamp ?? "") || 0;
    return rightTime - leftTime;
  });
}

function sortIssues(items: AutopilotExecutionIssueRecord[]) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.updated_at ?? left.created_at ?? "") || 0;
    const rightTime = Date.parse(right.updated_at ?? right.created_at ?? "") || 0;
    return rightTime - leftTime;
  });
}

function sortApprovals(items: AutopilotExecutionApprovalRecord[]) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.updated_at ?? left.created_at ?? "") || 0;
    const rightTime = Date.parse(right.updated_at ?? right.created_at ?? "") || 0;
    return rightTime - leftTime;
  });
}

function sortToolPermissionRuntimes(items: AutopilotToolPermissionRuntimeRecord[]) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.updated_at ?? left.created_at ?? "") || 0;
    const rightTime = Date.parse(right.updated_at ?? right.created_at ?? "") || 0;
    return rightTime - leftTime;
  });
}

function sortAsyncTasks(items: AutopilotExecutionRuntimeAgentTaskRecord[]) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.updated_at ?? left.created_at ?? "") || 0;
    const rightTime = Date.parse(right.updated_at ?? right.created_at ?? "") || 0;
    return rightTime - leftTime;
  });
}

function normalizeAgentDetail(
  detail: AutopilotExecutionRuntimeAgentDetail
): AutopilotExecutionRuntimeAgentDetail {
  return {
    ...detail,
    issues: sortIssues(detail.issues ?? []),
    approvals: sortApprovals(detail.approvals ?? []),
    tool_permission_runtimes: sortToolPermissionRuntimes(
      detail.tool_permission_runtimes ?? []
    ),
    async_tasks: sortAsyncTasks(detail.async_tasks ?? []),
    events: sortEvents(detail.events ?? []),
  };
}

export async function buildExecutionAgentSnapshot(
  runtimeAgentId: string,
  options?: {
    eventLimit?: number | null;
  }
): Promise<ShellExecutionAgentSnapshot> {
  const normalizedRuntimeAgentId = normalizeRuntimeAgentId(runtimeAgentId);
  const eventLimit =
    typeof options?.eventLimit === "number"
      ? Math.max(20, Math.min(Math.trunc(options.eventLimit), 300))
      : 120;

  const agentResult = await Promise.allSettled([
    requestUpstreamJson<AutopilotExecutionRuntimeAgentDetail>(
      "autopilot",
      `execution-plane/agents/${encodeURIComponent(normalizedRuntimeAgentId)}`,
      new URLSearchParams({ event_limit: String(eventLimit) }),
      { timeoutMs: 5000 }
    ),
  ]).then((results) => results[0]);

  return {
    generatedAt: new Date().toISOString(),
    runtimeAgentId: normalizedRuntimeAgentId,
    agent:
      agentResult.status === "fulfilled"
        ? normalizeAgentDetail(agentResult.value)
        : null,
    agentError:
      agentResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage(
            `Execution runtime agent ${normalizedRuntimeAgentId}`,
            agentResult.reason
          ),
    agentLoadState: agentResult.status === "fulfilled" ? "ready" : "error",
  };
}
