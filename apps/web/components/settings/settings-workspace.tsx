"use client";

import {
  fetchShellRuntimeSnapshot,
  type ShellContractAuditSnapshot,
  type ShellParityAuditDrilldown,
  type ShellParityAuditSnapshot,
  type ShellParityAuditStatus,
  type ShellParityTargetsSnapshot,
  type ShellRuntimeSnapshot,
} from "@founderos/api-clients";
import { Settings2, Server } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useCallback } from "react";

import {
  SettingsLayout,
  SettingsPageTitle,
  SettingsSectionTitle,
  SettingsGroup,
  SettingsRow,
  SettingsSelect,
  SettingsToggle,
  SettingsStatusIndicator,
  SettingsSidebarSection,
  SettingsSidebarLink,
  SettingsSidebarBackLink,
} from "@/components/shell/shell-settings-primitives";
import { buildLiveParityWorkflowCommands } from "@/lib/live-parity-commands";
import type { ShellRouteScope, ShellSettingsParityTargets } from "@/lib/route-scope";
import {
  SHELL_REFRESH_PROFILE_OPTIONS,
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import { useIsHydrated } from "@/lib/use-is-hydrated";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";
import { EMPTY_RUNTIME_SNAPSHOT } from "@/lib/runtime";

type SettingsRouteScope = ShellRouteScope;
type SettingsParityTargets = ShellSettingsParityTargets;

function toSettingsStatus(status: ShellParityAuditStatus) {
  if (status === "ok") {
    return "online" as const;
  }
  if (status === "drift") {
    return "degraded" as const;
  }
  return "offline" as const;
}

function summarizeDrilldownMetrics(drilldown: ShellParityAuditDrilldown) {
  if (drilldown.metrics.length === 0) {
    return "No drilldown metrics available.";
  }

  return drilldown.metrics
    .slice(0, 4)
    .map(
      (metric) =>
        `${metric.label}: shell ${metric.shellValue} / upstream ${metric.upstreamValue}`
    )
    .join(" · ");
}

export function SettingsWorkspace({
  initialRuntimeSnapshot,
  initialContractAuditSnapshot,
  initialParityTargetSnapshot,
  initialParityAuditSnapshot,
  routeScope,
  parityTargets,
}: {
  initialRuntimeSnapshot?: ShellRuntimeSnapshot | null;
  initialContractAuditSnapshot?: ShellContractAuditSnapshot | null;
  initialParityTargetSnapshot?: ShellParityTargetsSnapshot | null;
  initialParityAuditSnapshot?: ShellParityAuditSnapshot | null;
  routeScope?: SettingsRouteScope;
  parityTargets?: SettingsParityTargets;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useIsHydrated();
  const { preferences, updatePreferences } = useShellPreferences(
    initialRuntimeSnapshot?.settings?.operatorControls.preferences
  );
  const pollInterval = getShellPollInterval("settings", preferences.refreshProfile);
  const loadRuntimeSnapshot = useCallback(() => fetchShellRuntimeSnapshot(), []);
  const selectLoadState = useCallback(
    (s: ShellRuntimeSnapshot) => s.loadState,
    []
  );
  const { snapshot: runtimeSnapshot } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_RUNTIME_SNAPSHOT,
    initialSnapshot: initialRuntimeSnapshot,
    refreshNonce: 0,
    pollIntervalMs: pollInterval,
    loadSnapshot: loadRuntimeSnapshot,
    selectLoadState,
  });

  const health = runtimeSnapshot.health;
  const settings = runtimeSnapshot.settings;
  const quorumStatus = health?.services.quorum.status === "ok" ? "online" as const : "offline" as const;
  const autopilotStatus = health?.services.autopilot.status === "ok" ? "online" as const : "offline" as const;
  const quorumUrl = settings?.upstreams?.find((u) => u.id === "quorum")?.baseUrl ?? "http://127.0.0.1:8800";
  const autopilotUrl = settings?.upstreams?.find((u) => u.id === "autopilot")?.baseUrl ?? "http://127.0.0.1:8420/api";
  const shellOrigin = settings?.runtime?.origin ?? `http://127.0.0.1:${settings?.runtime?.port ?? 3737}`;
  const effectiveRouteScope = {
    projectId:
      routeScope?.projectId ||
      initialParityTargetSnapshot?.routeScope.projectId ||
      "",
    intakeSessionId:
      routeScope?.intakeSessionId ||
      initialParityTargetSnapshot?.routeScope.intakeSessionId ||
      "",
  };
  const effectiveParityTargets = {
    discoverySessionId:
      parityTargets?.discoverySessionId ||
      initialParityTargetSnapshot?.parityTargets.discoverySessionId ||
      "",
    discoveryIdeaId:
      parityTargets?.discoveryIdeaId ||
      initialParityTargetSnapshot?.parityTargets.discoveryIdeaId ||
      "",
  };
  const parityTargetRecords = initialParityTargetSnapshot?.records ?? [];
  const parityDrilldowns = initialParityAuditSnapshot?.drilldowns ?? [];
  const parityCommands = buildLiveParityWorkflowCommands({
    origin: shellOrigin,
    routeScope: effectiveRouteScope,
    parityTargets: effectiveParityTargets,
  });

  const currentTheme = mounted ? (resolvedTheme ?? "system") : "system";

  const targetSource = (key: "project" | "intakeSession" | "discoverySession" | "discoveryIdea") =>
    parityTargetRecords.find((record) => record.key === key)?.source ?? "unresolved";

  return (
    <SettingsLayout
      sidebar={
        <>
          <SettingsSidebarBackLink href="/dashboard">
            Back to app
          </SettingsSidebarBackLink>

          <SettingsSidebarSection>
            <SettingsSidebarLink href="/settings" active icon={<Settings2 className="h-4 w-4" />}>
              Preferences
            </SettingsSidebarLink>
          </SettingsSidebarSection>

          <SettingsSidebarSection title="System">
            <SettingsSidebarLink href="/settings#connections" icon={<Server className="h-4 w-4" />}>
              Connections
            </SettingsSidebarLink>
          </SettingsSidebarSection>
        </>
      }
    >
      <SettingsPageTitle>Preferences</SettingsPageTitle>

      {/* ── Interface ──────────────────────────────────── */}
      <SettingsSectionTitle>Interface</SettingsSectionTitle>
      <SettingsGroup className="mb-8">
        <SettingsRow
          title="Theme"
          description="Choose how FounderOS appears"
          control={
            <SettingsSelect
              value={currentTheme === "dark" ? "dark" : currentTheme === "light" ? "light" : "system"}
              options={[
                { label: "System", value: "system" },
                { label: "Light", value: "light" },
                { label: "Dark", value: "dark" },
              ]}
              onChange={(v) => setTheme(v)}
            />
          }
        />
        <SettingsRow
          title="Collapsed sidebar"
          description="Start with the sidebar collapsed by default"
          control={
            <SettingsToggle
              checked={preferences.sidebarCollapsed}
              onChange={(checked) =>
                updatePreferences({ sidebarCollapsed: checked })
              }
              label="Collapse sidebar"
            />
          }
        />
      </SettingsGroup>

      <SettingsSectionTitle>Operator controls</SettingsSectionTitle>
      <SettingsGroup className="mb-8">
        <SettingsRow
          title="Preferences namespace"
          description="/api/shell/operator-preferences"
          control={
            <SettingsStatusIndicator
              status="online"
              label={settings?.operatorControls.source ?? "default"}
            />
          }
        />
        <SettingsRow
          title="Refresh profile"
          description={`Current operator cadence for settings polling is ${preferences.refreshProfile}.`}
          control={
            <span className="text-[12px] text-muted-foreground">
              {pollInterval} ms
            </span>
          }
        />
        <SettingsRow
          title="Remembered review defaults"
          description={`Global lane ${settings?.operatorControls.preferences.reviewMemory.global.lane ?? preferences.reviewMemory.global.lane} with preset ${settings?.operatorControls.preferences.reviewMemory.global.preset ?? preferences.reviewMemory.global.preset ?? "none"}.`}
          control={
            <SettingsStatusIndicator
              status={settings?.operatorControls.source === "cookie" ? "online" : "degraded"}
              label={settings?.operatorControls.source === "cookie" ? "Persisted" : "Defaulted"}
            />
          }
        />
      </SettingsGroup>

      {/* ── Data refresh ───────────────────────────────── */}
      <SettingsSectionTitle>Data refresh</SettingsSectionTitle>
      <SettingsGroup className="mb-8">
        <SettingsRow
          title="Refresh profile"
          description="Controls how frequently the shell polls for updated data"
          control={
            <SettingsSelect
              value={preferences.refreshProfile}
              options={SHELL_REFRESH_PROFILE_OPTIONS.map((opt) => ({
                label: opt.label,
                value: opt.value,
              }))}
              onChange={(v) =>
                updatePreferences({
                  refreshProfile: v as typeof preferences.refreshProfile,
                })
              }
            />
          }
        />
      </SettingsGroup>

      {/* ── Connections ────────────────────────────────── */}
      <div id="connections">
        <SettingsSectionTitle>Connections</SettingsSectionTitle>
      </div>
      <SettingsGroup className="mb-8">
        <SettingsRow
          title="Quorum"
          description={quorumUrl}
          control={
            <SettingsStatusIndicator
              status={quorumStatus}
              label={quorumStatus === "online" ? "Connected" : "Offline"}
            />
          }
        />
        <SettingsRow
          title="Autopilot"
          description={autopilotUrl}
          control={
            <SettingsStatusIndicator
              status={autopilotStatus}
              label={autopilotStatus === "online" ? "Connected" : "Offline"}
            />
          }
        />
      </SettingsGroup>

      {/* ── About ──────────────────────────────────────── */}
      <SettingsSectionTitle>About</SettingsSectionTitle>
      <SettingsGroup className="mb-8">
        <SettingsRow
          title="Shell origin"
          description={shellOrigin}
        />
        <SettingsRow
          title="Status"
          description={
            health
              ? `Gateway ${health.status} as of ${new Date(health.generatedAt).toLocaleTimeString()}`
              : "Checking..."
          }
        />
      </SettingsGroup>

      <SettingsSectionTitle>Route scope</SettingsSectionTitle>
      <SettingsGroup className="mb-8">
        <SettingsRow
          title="Project scope"
          description={effectiveRouteScope.projectId || "No scoped project id in the current route."}
          control={
            <SettingsStatusIndicator
              status={effectiveRouteScope.projectId ? "online" : "offline"}
              label={effectiveRouteScope.projectId ? "Scoped" : "Global"}
            />
          }
        />
        <SettingsRow
          title="Intake scope"
          description={
            effectiveRouteScope.intakeSessionId ||
            "No scoped intake session id in the current route."
          }
          control={
            <SettingsStatusIndicator
              status={effectiveRouteScope.intakeSessionId ? "online" : "offline"}
              label={effectiveRouteScope.intakeSessionId ? "Scoped" : "Global"}
            />
          }
        />
      </SettingsGroup>

      <SettingsSectionTitle>Resolved parity targets</SettingsSectionTitle>
      <SettingsGroup className="mb-8">
        <SettingsRow
          title="Discovery session"
          description={effectiveParityTargets.discoverySessionId || "No discovery session target resolved."}
          control={<span className="text-[12px] text-muted-foreground">{targetSource("discoverySession")}</span>}
        />
        <SettingsRow
          title="Discovery idea"
          description={effectiveParityTargets.discoveryIdeaId || "No discovery idea target resolved."}
          control={<span className="text-[12px] text-muted-foreground">{targetSource("discoveryIdea")}</span>}
        />
        <SettingsRow
          title="Coverage"
          description={
            initialParityTargetSnapshot
              ? `${initialParityTargetSnapshot.coverage.completeLinkedChainCount} complete linked chains across ${initialParityTargetSnapshot.coverage.completeLinkedScenarioVariantCount} scenario variants.`
              : "Coverage data unavailable."
          }
        />
      </SettingsGroup>

      <SettingsSectionTitle>Browser contract audit</SettingsSectionTitle>
      <SettingsGroup className="mb-8">
        <SettingsRow
          title="Summary"
          description={
            initialContractAuditSnapshot
              ? `${initialContractAuditSnapshot.summary.liveOkCount} ok, ${initialContractAuditSnapshot.summary.liveDegradedCount} degraded, ${initialContractAuditSnapshot.summary.liveErrorCount} errors across ${initialContractAuditSnapshot.summary.deprecatedCount} deprecated routes.`
              : "Contract audit snapshot unavailable."
          }
        />
        {(initialContractAuditSnapshot?.liveRoutes ?? []).slice(0, 3).map((route) => (
          <SettingsRow
            key={route.key}
            title={route.label}
            description={`${route.route} · ${route.detail}`}
            control={
              <SettingsStatusIndicator
                status={route.status === "ok" ? "online" : "offline"}
                label={route.status}
              />
            }
          />
        ))}
      </SettingsGroup>

      <SettingsSectionTitle>Upstream parity audit</SettingsSectionTitle>
      <SettingsGroup className="mb-8">
        <SettingsRow
          title="Summary"
          description={
            initialParityAuditSnapshot
              ? `${initialParityAuditSnapshot.summary.okCount} ok, ${initialParityAuditSnapshot.summary.driftCount} drift, ${initialParityAuditSnapshot.summary.blockedCount} blocked, ${initialParityAuditSnapshot.summary.errorCount} errors.`
              : "Parity audit snapshot unavailable."
          }
        />
        <SettingsRow
          title="Drilldowns"
          description={
            initialParityAuditSnapshot
              ? `${parityDrilldowns.length} scoped drilldowns available for the current route context.`
              : "No scoped drilldowns available."
          }
        />
      </SettingsGroup>

      <SettingsSectionTitle>Detail drilldowns</SettingsSectionTitle>
      <SettingsGroup className="mb-8">
        {parityDrilldowns.length > 0 ? (
          parityDrilldowns.map((drilldown) => (
            <SettingsRow
              key={`${drilldown.key}:${drilldown.targetId}`}
              className="items-start"
              title={drilldown.label}
              description={
                <div className="space-y-2">
                  <div>{drilldown.detail}</div>
                  <div className="text-[12px] text-muted-foreground">
                    {summarizeDrilldownMetrics(drilldown)}
                  </div>
                  <code className="block overflow-x-auto rounded bg-muted px-2 py-1 text-[12px] text-foreground">
                    {drilldown.upstreamRoute}
                  </code>
                </div>
              }
              control={
                <div className="flex flex-col items-end gap-2 text-right">
                  <SettingsStatusIndicator
                    status={toSettingsStatus(drilldown.status)}
                    label={drilldown.status}
                  />
                  <Link
                    href={drilldown.shellSurfaceHref}
                    className="text-[12px] font-medium text-foreground underline underline-offset-4"
                  >
                    Open shell surface
                  </Link>
                </div>
              }
            />
          ))
        ) : (
          <SettingsRow
            title="Scoped drilldowns"
            description="No scope-aware parity drilldowns were resolved for the current route context."
          />
        )}
      </SettingsGroup>

      <SettingsSectionTitle>Scoped parity playbooks</SettingsSectionTitle>
      <SettingsGroup className="mb-8">
        {parityCommands.map((command) => (
          <SettingsRow
            key={command.label}
            className="items-start"
            title={command.label}
            description={
              <div className="space-y-2">
                <div>{command.detail}</div>
                <code className="block overflow-x-auto rounded bg-muted px-2 py-1 text-[12px] text-foreground">
                  {command.command}
                </code>
              </div>
            }
          />
        ))}
      </SettingsGroup>
    </SettingsLayout>
  );
}
