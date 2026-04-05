export type ShellContractAuditStatus = "ok" | "degraded" | "error";

export interface ShellContractAuditLiveRouteRecord {
  key: string;
  label: string;
  route: string;
  status: ShellContractAuditStatus;
  detail: string;
}

export interface ShellContractAuditDeprecatedRouteRecord {
  legacyPath: string;
  method: string;
  shellNamespace: string;
  status: "ok";
  detail: string;
}

export interface ShellContractAuditSummary {
  liveOkCount: number;
  liveDegradedCount: number;
  liveErrorCount: number;
  deprecatedCount: number;
}

export interface ShellContractAuditSnapshot {
  generatedAt: string;
  liveRoutes: ShellContractAuditLiveRouteRecord[];
  deprecatedRoutes: ShellContractAuditDeprecatedRouteRecord[];
  summary: ShellContractAuditSummary;
  errors: string[];
  loadState: "ready" | "error";
}

export async function fetchShellContractAuditSnapshot(
  input: RequestInfo | URL = "/api/shell/contract",
  init?: RequestInit
): Promise<ShellContractAuditSnapshot> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Shell contract audit request failed: ${response.status}`);
  }

  return (await response.json()) as ShellContractAuditSnapshot;
}
