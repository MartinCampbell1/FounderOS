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
  operatorControls?: ShellOperatorPreferencesSnapshot,
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
            : "Shell settings: request failed.",
        ),
        null);

  const health =
    healthResult.status === "fulfilled"
      ? healthResult.value
      : (errors.push(
          healthResult.reason instanceof Error
            ? `Gateway health: ${healthResult.reason.message}`
            : "Gateway health: request failed.",
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

export function sanitizeShellRuntimeSnapshot(
  snapshot: ShellRuntimeSnapshot,
): ShellRuntimeSnapshot {
  const redacted = "[redacted]";
  return {
    ...snapshot,
    settings: snapshot.settings
      ? {
          ...snapshot.settings,
          runtime: {
            ...snapshot.settings.runtime,
            origin: redacted,
            env: snapshot.settings.runtime.env.map((entry) => ({
              ...entry,
              value: redacted,
              rawValue: null,
              issues: entry.issues.map((issue) => ({
                ...issue,
                message: "Configuration issue present.",
              })),
            })),
          },
          upstreams: snapshot.settings.upstreams.map((upstream) => ({
            ...upstream,
            baseUrl: redacted,
            rawValue: null,
            healthUrl: redacted,
            issues: upstream.issues.map((issue) => ({
              ...issue,
              message: "Configuration issue present.",
            })),
          })),
          validation: {
            ...snapshot.settings.validation,
            issues: snapshot.settings.validation.issues.map((issue) => ({
              ...issue,
              message: "Configuration issue present.",
            })),
          },
          gatewayRoutes: [],
          shellContracts: [],
          migrationStatus: [],
          developerWorkflow: {
            workspace: "",
            commands: [],
            notes: [],
          },
        }
      : null,
    health: snapshot.health
      ? {
          ...snapshot.health,
          services: {
            quorum: {
              ...snapshot.health.services.quorum,
              baseUrl: redacted,
              details: snapshot.health.services.quorum.details
                ? "Upstream status available."
                : undefined,
            },
            autopilot: {
              ...snapshot.health.services.autopilot,
              baseUrl: redacted,
              details: snapshot.health.services.autopilot.details
                ? "Upstream status available."
                : undefined,
            },
          },
        }
      : null,
    errors:
      snapshot.errors.length > 0 ? ["Shell runtime reported an error."] : [],
  };
}
