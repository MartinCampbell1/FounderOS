import type {
  AutopilotExecutionAgentActionRunSummaryRecord,
  AutopilotExecutionShadowAuditDetail,
  AutopilotExecutionShadowAuditRecord,
} from "@founderos/api-clients";

import type {
  ShellExecutionAuditListRecord,
  ShellExecutionAuditSnapshot,
  ShellExecutionAuditsSnapshot,
} from "@/lib/execution-audits-model";
import { formatUpstreamErrorMessage, requestUpstreamJson } from "@/lib/upstream";

function sortActionRuns(items: AutopilotExecutionAgentActionRunSummaryRecord[]) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.created_at ?? left.updated_at ?? "") || 0;
    const rightTime = Date.parse(right.created_at ?? right.updated_at ?? "") || 0;
    return rightTime - leftTime;
  });
}

function sortAudits(items: ShellExecutionAuditListRecord[]) {
  return [...items].sort((left, right) => {
    if (left.open !== right.open) {
      return left.open ? -1 : 1;
    }

    const leftTime =
      Date.parse(left.updated_at ?? left.latestRunAt ?? left.created_at ?? "") || 0;
    const rightTime =
      Date.parse(right.updated_at ?? right.latestRunAt ?? right.created_at ?? "") || 0;
    return rightTime - leftTime;
  });
}

function aggregateShadowAudits(
  runs: AutopilotExecutionAgentActionRunSummaryRecord[]
): ShellExecutionAuditListRecord[] {
  const auditMap = new Map<string, ShellExecutionAuditListRecord>();
  const runIdsByAuditId = new Map<string, Set<string>>();

  for (const run of runs) {
    for (const audit of run.shadow_audits ?? []) {
      const auditId = String(audit.id || "").trim();
      if (!auditId) {
        continue;
      }

      const runIds = runIdsByAuditId.get(auditId) ?? new Set<string>();
      runIds.add(run.id);
      runIdsByAuditId.set(auditId, runIds);

      const existing = auditMap.get(auditId);
      const nextLatestRunAt = (() => {
        const candidate = run.updated_at || run.created_at || null;
        if (!existing) {
          return candidate;
        }
        const existingTime = Date.parse(existing.latestRunAt ?? existing.updated_at ?? "") || 0;
        const candidateTime = Date.parse(candidate ?? "") || 0;
        return candidateTime > existingTime ? candidate : existing.latestRunAt;
      })();

      const normalizedAudit: ShellExecutionAuditListRecord = {
        ...(existing ?? (audit as AutopilotExecutionShadowAuditRecord)),
        ...(audit as AutopilotExecutionShadowAuditRecord),
        linkedRunIds: Array.from(runIds),
        latestRunAt: nextLatestRunAt,
      };

      auditMap.set(auditId, normalizedAudit);
    }
  }

  return sortAudits(Array.from(auditMap.values()));
}

export async function buildExecutionAuditsSnapshot(): Promise<ShellExecutionAuditsSnapshot> {
  const runsResult = await Promise.allSettled([
    requestUpstreamJson<{ runs: AutopilotExecutionAgentActionRunSummaryRecord[] }>(
      "autopilot",
      "execution-plane/agents/action-runs?summary=true",
      undefined,
      { timeoutMs: 5000 }
    ),
  ]);

  const firstResult = runsResult[0];

  return {
    generatedAt: new Date().toISOString(),
    audits:
      firstResult.status === "fulfilled"
        ? aggregateShadowAudits(sortActionRuns(firstResult.value.runs))
        : [],
    auditsError:
      firstResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage("Execution shadow audits", firstResult.reason),
    auditsLoadState: firstResult.status === "fulfilled" ? "ready" : "error",
  };
}

export async function buildExecutionAuditSnapshot(
  auditId: string
): Promise<ShellExecutionAuditSnapshot> {
  const [auditResult, runsResult] = await Promise.allSettled([
    requestUpstreamJson<AutopilotExecutionShadowAuditDetail>(
      "autopilot",
      `execution-plane/shadow-audits/${encodeURIComponent(auditId)}`,
      undefined,
      { timeoutMs: 5000 }
    ),
    requestUpstreamJson<{ runs: AutopilotExecutionAgentActionRunSummaryRecord[] }>(
      "autopilot",
      "execution-plane/agents/action-runs?summary=true",
      undefined,
      { timeoutMs: 5000 }
    ),
  ]);

  const linkedRuns =
    runsResult.status === "fulfilled"
      ? sortActionRuns(
          runsResult.value.runs.filter((run) =>
            (run.shadow_audits ?? []).some((audit) => audit.id === auditId)
          )
        )
      : [];

  return {
    generatedAt: new Date().toISOString(),
    audit: auditResult.status === "fulfilled" ? auditResult.value : null,
    auditError:
      auditResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage("Execution shadow audit", auditResult.reason),
    auditLoadState: auditResult.status === "fulfilled" ? "ready" : "error",
    linkedRuns,
    linkedRunsError:
      runsResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage(
            "Execution shadow audit linked runs",
            runsResult.reason
          ),
    linkedRunsLoadState: runsResult.status === "fulfilled" ? "ready" : "error",
  };
}
