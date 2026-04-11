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
} from "@/components/shell/shell-settings-primitives";
import { SettingsSidebar } from "@/components/settings/settings-sidebar";
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
type SettingsSurfaceStatus = "online" | "degraded" | "offline";

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

function SettingsHeroStat({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: string;
  detail?: string;
  status?: {
    label: string;
    tone: SettingsSurfaceStatus;
  };
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/70 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            {label}
          </div>
          <div className="text-sm font-medium text-foreground">{value}</div>
        </div>
        {status ? (
          <SettingsStatusIndicator status={status.tone} label={status.label} />
        ) : null}
      </div>
      {detail ? (
        <div className="mt-3 text-[12px] leading-5 text-muted-foreground">
          {detail}
        </div>
      ) : null}
    </div>
  );
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
  const themeLabel =
    currentTheme === "system"
      ? "System"
      : currentTheme === "dark"
        ? "Dark"
        : "Light";
  const connectionStatus: SettingsSurfaceStatus =
    quorumStatus === "online" && autopilotStatus === "online"
      ? "online"
      : quorumStatus === "offline" && autopilotStatus === "offline"
        ? "offline"
        : "degraded";
  const connectionLabel =
    connectionStatus === "online"
      ? "Healthy"
      : connectionStatus === "degraded"
        ? "Partial"
        : "Offline";
  const parityStatus: SettingsSurfaceStatus = initialParityAuditSnapshot
    ? initialParityAuditSnapshot.summary.errorCount > 0 ||
      initialParityAuditSnapshot.summary.blockedCount > 0
      ? "offline"
      : initialParityAuditSnapshot.summary.driftCount > 0
        ? "degraded"
        : "online"
    : "offline";
  const parityLabel =
    parityStatus === "online"
      ? "Aligned"
      : parityStatus === "degraded"
        ? "Drifted"
        : "Blocked";
  const parityCoverageLabel = initialParityTargetSnapshot
    ? `${initialParityTargetSnapshot.coverage.completeLinkedChainCount} linked chains · ${initialParityTargetSnapshot.coverage.completeLinkedScenarioVariantCount} variants`
    : "Coverage unavailable";
  const routeScopeLabel = effectiveRouteScope.projectId
    ? effectiveRouteScope.intakeSessionId
      ? "Project + intake scoped"
      : "Project scoped"
    : effectiveRouteScope.intakeSessionId
      ? "Intake scoped"
      : "Global";

  const targetSource = (key: "project" | "intakeSession" | "discoverySession" | "discoveryIdea") =>
    parityTargetRecords.find((record) => record.key === key)?.source ?? "unresolved";

  return (
    <SettingsLayout
      sidebar={<SettingsSidebar activeView="overview" showDiagnostics />}
    >
      <div
        id="overview"
        className="mb-6 rounded-3xl border border-border/60 bg-muted/20 px-5 py-6 shadow-sm lg:px-6"
      >
        <div className="flex flex-col gap-3">
          <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            Settings / Preferences
          </div>
          <SettingsPageTitle>Preferences</SettingsPageTitle>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Tune appearance, polling cadence, connection health, and route-scoped
            parity surfaces without leaving the shell grammar.
          </p>
        </div>
      </div>

      <div className="mb-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SettingsHeroStat
          label="Theme"
          value={themeLabel}
          detail="Appearance mode for the shell chrome."
        />
        <SettingsHeroStat
          label="Polling"
          value={preferences.refreshProfile}
          detail={`${pollInterval} ms cadence for settings snapshots.`}
        />
        <SettingsHeroStat
          label="Connections"
          value={connectionLabel}
          detail="Quorum and Autopilot availability."
          status={{ tone: connectionStatus, label: connectionLabel }}
        />
        <SettingsHeroStat
          label="Parity"
          value={parityLabel}
          detail={parityCoverageLabel}
          status={{ tone: parityStatus, label: parityLabel }}
        />
      </div>

      {/* ── Interface ──────────────────────────────────── */}
      <SettingsSectionTitle>Interface</SettingsSectionTitle>
      <SettingsGroup className="mb-8">
        <SettingsRow
          title="Theme"
          description="Choose the shell appearance mode."
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
          description="Start with the rail collapsed by default."
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

      <SettingsSectionTitle>Runtime controls</SettingsSectionTitle>
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
          description={`Settings polling cadence is ${preferences.refreshProfile}.`}
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
      <SettingsSectionTitle>Polling</SettingsSectionTitle>
      <SettingsGroup className="mb-8">
        <SettingsRow
          title="Refresh profile"
          description="Controls how frequently the shell polls for updated data."
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
      <div id="connections" className="scroll-mt-24">
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
      <SettingsSectionTitle>Runtime</SettingsSectionTitle>
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

      <div id="route-scope" className="scroll-mt-24">
        <SettingsSectionTitle>Route scope</SettingsSectionTitle>
      </div>
      <SettingsGroup className="mb-8">
        <SettingsRow
          title="Scope profile"
          description={routeScopeLabel}
        />
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

      <SettingsSectionTitle>Parity targets</SettingsSectionTitle>
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

      <div id="audits" className="space-y-6 scroll-mt-24">
        <SettingsSectionTitle>Parity audits</SettingsSectionTitle>
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="space-y-3">
            <SettingsSectionTitle>Browser contract audit</SettingsSectionTitle>
            <SettingsGroup>
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
          </div>
          <div className="space-y-3">
            <SettingsSectionTitle>Upstream parity audit</SettingsSectionTitle>
            <SettingsGroup>
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
          </div>
        </div>

        <SettingsSectionTitle>Detail drilldowns</SettingsSectionTitle>
        <SettingsGroup>
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

        <SettingsSectionTitle>Parity playbooks</SettingsSectionTitle>
        <SettingsGroup>
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
      </div>
    </SettingsLayout>
  );
}
