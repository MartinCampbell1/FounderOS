import type {
  ShellOperatorPreferencesSnapshot,
  ShellRuntimeSnapshot,
} from "@founderos/api-clients";

import { buildGatewayHealthSnapshot } from "@/lib/gateway";
import { buildShellSettingsSnapshot } from "@/lib/settings";

export const EMPTY_RUNTIME_SNAPSHOT: ShellRuntimeSnapshot = {
  generatedAt: "",
  settings: null,
  health: null,
  errors: [],
  loadState: "ready",
};

export function emptyShellRuntimeSnapshot(): ShellRuntimeSnapshot {
  return {
    generatedAt: "",
    settings: null,
    health: null,
    errors: [],
    loadState: "ready",
  };
}

export async function buildShellRuntimeSnapshot(
  operatorControls?: ShellOperatorPreferencesSnapshot
): Promise<ShellRuntimeSnapshot> {
  const generatedAt = new Date().toISOString();
  const errors: string[] = [];

  const [settingsResult, healthResult] = await Promise.allSettled([
    Promise.resolve(buildShellSettingsSnapshot(operatorControls)),
    buildGatewayHealthSnapshot(),
  ]);

  const settings =
    settingsResult.status === "fulfilled"
      ? settingsResult.value
      : (errors.push(
          settingsResult.reason instanceof Error
            ? `Shell settings: ${settingsResult.reason.message}`
            : "Shell settings: request failed."
        ),
        null);

  const health =
    healthResult.status === "fulfilled"
      ? healthResult.value
      : (errors.push(
          healthResult.reason instanceof Error
            ? `Gateway health: ${healthResult.reason.message}`
            : "Gateway health: request failed."
        ),
        null);

  return {
    generatedAt,
    settings,
    health,
    errors,
    loadState: errors.length === 2 ? "error" : "ready",
  };
}
