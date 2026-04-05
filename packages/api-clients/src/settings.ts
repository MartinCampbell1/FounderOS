import type {
  FounderOSConfigIssue,
  FounderOSConfigValueSource,
} from "@founderos/config";
import type { ShellOperatorPreferencesSnapshot } from "./operator-preferences";

export type {
  FounderOSConfigIssue as ShellConfigIssue,
  FounderOSConfigValueSource as ShellConfigValueSource,
} from "@founderos/config";

export interface ShellResolvedEnvSetting {
  key: string;
  value: string;
  source: FounderOSConfigValueSource;
  description: string;
  rawValue?: string | null;
  issues: FounderOSConfigIssue[];
}

export interface ShellRuntimeSettings {
  host: string;
  port: string;
  origin: string;
  env: ShellResolvedEnvSetting[];
  issues: FounderOSConfigIssue[];
}

export interface ShellUpstreamSettingsRecord {
  id: "quorum" | "autopilot";
  label: string;
  envKey: string;
  baseUrl: string;
  source: FounderOSConfigValueSource;
  rawValue?: string | null;
  shellNamespace: string;
  healthUrl: string;
  issues: FounderOSConfigIssue[];
}

export interface ShellGatewayRouteRecord {
  route: string;
  method: string;
  owner: string;
  purpose: string;
  upstream: "quorum" | "autopilot" | "shell";
}

export interface ShellContractRecord {
  label: string;
  owner: string;
  detail: string;
}

export interface ShellMigrationStatusRecord {
  key: string;
  label: string;
  status: "live" | "in_progress" | "planned";
  href: string;
  detail: string;
}

export interface ShellWorkflowCommandRecord {
  label: string;
  command: string;
  detail: string;
}

export interface ShellWorkflowNoteRecord {
  label: string;
  detail: string;
}

export interface ShellSettingsSnapshot {
  generatedAt: string;
  operatorControls: ShellOperatorPreferencesSnapshot;
  runtime: ShellRuntimeSettings;
  upstreams: ShellUpstreamSettingsRecord[];
  validation: {
    status: "ok" | "warning";
    issues: FounderOSConfigIssue[];
  };
  gatewayRoutes: ShellGatewayRouteRecord[];
  shellContracts: ShellContractRecord[];
  migrationStatus: ShellMigrationStatusRecord[];
  developerWorkflow: {
    workspace: string;
    commands: ShellWorkflowCommandRecord[];
    notes: ShellWorkflowNoteRecord[];
  };
}

export async function fetchShellSettingsSnapshot(
  input: RequestInfo | URL = "/api/shell/runtime",
  init?: RequestInit
): Promise<ShellSettingsSnapshot> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Settings request failed: ${response.status}`);
  }

  const payload = (await response.json()) as
    | ShellSettingsSnapshot
    | { settings: ShellSettingsSnapshot | null };

  if ("settings" in payload) {
    if (!payload.settings) {
      throw new Error("Shell runtime did not include a settings snapshot.");
    }
    return payload.settings;
  }

  return payload;
}
