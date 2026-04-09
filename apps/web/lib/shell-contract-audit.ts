import type {
  ShellContractAuditLiveRouteRecord,
  ShellContractAuditSnapshot,
  ShellContractAuditStatus,
  ShellOperatorPreferencesSnapshot,
} from "@founderos/api-clients";

import { buildDashboardSnapshot } from "@/lib/dashboard";
import { buildDiscoverySessionsSnapshot } from "@/lib/discovery";
import { inspectExecutionBriefHandoffStore } from "@/lib/execution-brief-handoffs";
import { buildExecutionWorkspaceSnapshot } from "@/lib/execution";
import { buildShellParityTargetsSnapshot } from "@/lib/shell-parity-targets";
import {
  buildShellOperatorPreferencesSnapshot,
  DEFAULT_SHELL_PREFERENCES,
} from "@/lib/shell-preferences-contract";
import {
  SHELL_BROWSER_CONTRACT,
  SHELL_CONTRACT_AUDIT_ROUTE,
  SHELL_EXECUTION_BRIEF_HANDOFF_ROUTE,
  SHELL_OPERATOR_PREFERENCES_ROUTE,
  SHELL_PARITY_TARGETS_ROUTE,
  SHELL_RUNTIME_ROUTE,
} from "@/lib/shell-browser-contract";
import { buildShellReviewCenterSnapshot } from "@/lib/review-center";
import { buildShellRuntimeSnapshot } from "@/lib/runtime";

function buildLiveRouteRecord(input: {
  key: string;
  label: string;
  route: string;
  status: ShellContractAuditStatus;
  detail: string;
}): ShellContractAuditLiveRouteRecord {
  return input;
}

function detailFromErrors(
  errors: string[],
  fallbackOk: string,
  fallbackError: string,
): string {
  if (errors.length > 0) {
    return errors[0] ?? fallbackError;
  }
  return fallbackOk || fallbackError;
}

export function emptyShellContractAuditSnapshot(): ShellContractAuditSnapshot {
  return {
    generatedAt: "",
    liveRoutes: [],
    deprecatedRoutes: [],
    summary: {
      liveOkCount: 0,
      liveDegradedCount: 0,
      liveErrorCount: 0,
      deprecatedCount: 0,
    },
    errors: [],
    loadState: "ready",
  };
}

export async function buildShellContractAuditSnapshot(
  operatorControls?: ShellOperatorPreferencesSnapshot,
): Promise<ShellContractAuditSnapshot> {
  const [runtime, dashboard, review, discovery, execution, parityTargets] =
    await Promise.all([
      buildShellRuntimeSnapshot(operatorControls),
      buildDashboardSnapshot(),
      buildShellReviewCenterSnapshot(),
      buildDiscoverySessionsSnapshot(null),
      buildExecutionWorkspaceSnapshot(null),
      buildShellParityTargetsSnapshot(),
    ]);

  const preferencesSnapshot = buildShellOperatorPreferencesSnapshot(
    operatorControls?.preferences ?? DEFAULT_SHELL_PREFERENCES,
    operatorControls?.source ?? "default",
  );
  const handoffStore = inspectExecutionBriefHandoffStore();

  const liveRoutes: ShellContractAuditLiveRouteRecord[] = [
    buildLiveRouteRecord({
      key: "runtime",
      label: "Shell runtime",
      route: SHELL_RUNTIME_ROUTE,
      status:
        runtime.loadState === "error" || !runtime.settings || !runtime.health
          ? "error"
          : runtime.errors.length > 0 || runtime.health.status !== "ok"
            ? "degraded"
            : "ok",
      detail:
        runtime.loadState === "error" || !runtime.settings || !runtime.health
          ? detailFromErrors(
              runtime.errors,
              "",
              "Shell runtime snapshot is unavailable.",
            )
          : runtime.errors.length > 0
            ? (runtime.errors[0] ?? "Shell runtime snapshot reported an error.")
            : runtime.health.status !== "ok"
              ? `Gateway health is ${runtime.health.status}.`
              : "Shell runtime snapshot is available and healthy.",
    }),
    buildLiveRouteRecord({
      key: "contractAudit",
      label: "Shell contract audit",
      route: SHELL_CONTRACT_AUDIT_ROUTE,
      status: "ok",
      detail:
        "Shell contract audit is generated from server-side builders and browser-facing route mappings.",
    }),
    buildLiveRouteRecord({
      key: "operatorPreferences",
      label: "Operator preferences",
      route: SHELL_OPERATOR_PREFERENCES_ROUTE,
      status: "ok",
      detail: `Operator preferences snapshot is readable with source ${preferencesSnapshot.source} and refresh profile ${preferencesSnapshot.preferences.refreshProfile}.`,
    }),
    buildLiveRouteRecord({
      key: "parityTargets",
      label: "Parity target discovery",
      route: SHELL_PARITY_TARGETS_ROUTE,
      status:
        parityTargets.loadState === "error"
          ? "error"
          : parityTargets.errors.length > 0
            ? "degraded"
            : "ok",
      detail:
        parityTargets.loadState === "error"
          ? detailFromErrors(
              parityTargets.errors,
              "",
              "Parity target discovery is unavailable.",
            )
          : parityTargets.errors.length > 0
            ? (parityTargets.errors[0] ??
              "Parity target discovery reported an error.")
            : "Parity target discovery is reachable and resolved live target ids.",
    }),
    buildLiveRouteRecord({
      key: "dashboard",
      label: "Dashboard snapshot",
      route: SHELL_BROWSER_CONTRACT.liveRoutes.dashboard,
      status:
        dashboard.loadState === "error"
          ? "error"
          : dashboard.errors.length > 0 || dashboard.health?.status !== "ok"
            ? "degraded"
            : "ok",
      detail:
        dashboard.loadState === "error"
          ? detailFromErrors(
              dashboard.errors,
              "",
              "Dashboard snapshot is unavailable.",
            )
          : dashboard.errors.length > 0
            ? (dashboard.errors[0] ?? "Dashboard snapshot reported an error.")
            : dashboard.health?.status !== "ok"
              ? `Dashboard snapshot is reachable, but gateway health is ${dashboard.health?.status ?? "unknown"}.`
              : "Dashboard snapshot is reachable and healthy.",
    }),
    buildLiveRouteRecord({
      key: "review",
      label: "Review center snapshot",
      route: SHELL_BROWSER_CONTRACT.liveRoutes.review,
      status:
        review.loadState === "error"
          ? "error"
          : review.errors.length > 0
            ? "degraded"
            : "ok",
      detail:
        review.loadState === "error"
          ? detailFromErrors(
              review.errors,
              "",
              "Review center snapshot is unavailable.",
            )
          : review.errors.length > 0
            ? (review.errors[0] ?? "Review center snapshot reported an error.")
            : "Review center snapshot is reachable and healthy.",
    }),
    buildLiveRouteRecord({
      key: "discoverySessions",
      label: "Discovery workspace snapshot",
      route: "/api/shell/discovery/sessions",
      status:
        discovery.sessionsLoadState === "error" &&
        discovery.chainsLoadState === "error" &&
        discovery.launchPresetsLoadState === "error"
          ? "error"
          : discovery.sessionsError ||
              discovery.chainsError ||
              discovery.launchPresetsError
            ? "degraded"
            : "ok",
      detail:
        discovery.sessionsLoadState === "error" &&
        discovery.chainsLoadState === "error" &&
        discovery.launchPresetsLoadState === "error"
          ? discovery.sessionsError ||
            discovery.chainsError ||
            discovery.launchPresetsError ||
            "Discovery workspace snapshot is unavailable."
          : discovery.sessionsError ||
            discovery.chainsError ||
            discovery.launchPresetsError ||
            "Discovery workspace snapshot is reachable and healthy.",
    }),
    buildLiveRouteRecord({
      key: "executionWorkspace",
      label: "Execution workspace snapshot",
      route: "/api/shell/execution/workspace",
      status:
        execution.projectsLoadState === "error" &&
        execution.launchPresetsLoadState === "error"
          ? "error"
          : execution.projectsError || execution.launchPresetsError
            ? "degraded"
            : "ok",
      detail:
        execution.projectsLoadState === "error" &&
        execution.launchPresetsLoadState === "error"
          ? execution.projectsError ||
            execution.launchPresetsError ||
            "Execution workspace snapshot is unavailable."
          : execution.projectsError ||
            execution.launchPresetsError ||
            "Execution workspace snapshot is reachable and healthy.",
    }),
    buildLiveRouteRecord({
      key: "handoffStore",
      label: "Execution brief handoff store",
      route: SHELL_EXECUTION_BRIEF_HANDOFF_ROUTE,
      status: handoffStore.status,
      detail: handoffStore.detail,
    }),
  ];

  const deprecatedRoutes = SHELL_BROWSER_CONTRACT.deprecatedRoutes.map(
    (route) => ({
      ...route,
      status: "ok" as const,
      detail: `Legacy browser callers should now redirect or alias through ${route.shellNamespace}.`,
    }),
  );

  const errors = liveRoutes
    .filter((route) => route.status === "error")
    .map((route) => `${route.label}: ${route.detail}`);

  return {
    generatedAt: new Date().toISOString(),
    liveRoutes,
    deprecatedRoutes,
    summary: {
      liveOkCount: liveRoutes.filter((route) => route.status === "ok").length,
      liveDegradedCount: liveRoutes.filter(
        (route) => route.status === "degraded",
      ).length,
      liveErrorCount: liveRoutes.filter((route) => route.status === "error")
        .length,
      deprecatedCount: deprecatedRoutes.length,
    },
    errors,
    loadState: errors.length > 0 ? "error" : "ready",
  };
}
