export type ShellParityAuditUpstream =
  | "quorum"
  | "autopilot"
  | "composite";

export type ShellParityAuditStatus = "ok" | "drift" | "blocked" | "error";

export interface ShellParityAuditSummary {
  okCount: number;
  driftCount: number;
  blockedCount: number;
  errorCount: number;
}

export interface ShellParityAuditRecord {
  key: string;
  label: string;
  upstream: ShellParityAuditUpstream;
  shellRoute: string;
  shellSurfaceHref: string;
  upstreamRoute: string;
  status: ShellParityAuditStatus;
  shellCount: number | null;
  upstreamCount: number | null;
  detail: string;
  shellSampleIds: string[];
  upstreamSampleIds: string[];
  missingInShellSampleIds: string[];
  missingInUpstreamSampleIds: string[];
}

export interface ShellParityAuditDrilldownMetric {
  label: string;
  shellValue: string;
  upstreamValue: string;
  matches: boolean;
}

export interface ShellParityAuditDrilldown {
  key: string;
  label: string;
  upstream: ShellParityAuditUpstream;
  shellRoute: string;
  shellSurfaceHref: string;
  upstreamRoute: string;
  targetId: string;
  status: ShellParityAuditStatus;
  detail: string;
  metrics: ShellParityAuditDrilldownMetric[];
}

export interface ShellParityAuditSnapshot {
  generatedAt: string;
  records: ShellParityAuditRecord[];
  drilldowns: ShellParityAuditDrilldown[];
  summary: ShellParityAuditSummary;
  drilldownSummary: ShellParityAuditSummary;
  errors: string[];
  loadState: "ready" | "error";
}

export async function fetchShellParityAuditSnapshot(
  input: RequestInfo | URL = "/api/shell/parity",
  init?: RequestInit
): Promise<ShellParityAuditSnapshot> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Shell parity audit request failed: ${response.status}`);
  }

  return (await response.json()) as ShellParityAuditSnapshot;
}
