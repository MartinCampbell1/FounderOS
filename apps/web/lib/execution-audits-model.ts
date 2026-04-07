import type {
  AutopilotExecutionAgentActionRunSummaryRecord,
  AutopilotExecutionShadowAuditDetail,
  AutopilotExecutionShadowAuditRecord,
} from "@founderos/api-clients";

export interface ShellExecutionAuditListRecord
  extends AutopilotExecutionShadowAuditRecord {
  linkedRunIds: string[];
  latestRunAt?: string | null;
}

export interface ShellExecutionAuditsSnapshot {
  generatedAt: string;
  audits: ShellExecutionAuditListRecord[];
  auditsError: string | null;
  auditsLoadState: "ready" | "error";
}

export interface ShellExecutionAuditSnapshot {
  generatedAt: string;
  audit: AutopilotExecutionShadowAuditDetail | null;
  auditError: string | null;
  auditLoadState: "ready" | "error";
  linkedRuns: AutopilotExecutionAgentActionRunSummaryRecord[];
  linkedRunsError: string | null;
  linkedRunsLoadState: "ready" | "error";
}

export function emptyShellExecutionAuditsSnapshot(): ShellExecutionAuditsSnapshot {
  return {
    generatedAt: "",
    audits: [],
    auditsError: null,
    auditsLoadState: "ready",
  };
}

export function emptyShellExecutionAuditSnapshot(): ShellExecutionAuditSnapshot {
  return {
    generatedAt: "",
    audit: null,
    auditError: null,
    auditLoadState: "ready",
    linkedRuns: [],
    linkedRunsError: null,
    linkedRunsLoadState: "ready",
  };
}
