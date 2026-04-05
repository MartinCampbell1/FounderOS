"use client";

import {
  fetchShellRuntimeSnapshot,
  type ShellContractAuditSnapshot,
  type ShellParityAuditSnapshot,
  type ShellParityTargetsSnapshot,
  type ShellRuntimeSnapshot,
} from "@founderos/api-clients";
import {
  Settings2,
  Monitor,
  Palette,
  RefreshCw,
  Server,
  ChevronLeft,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useCallback, useSyncExternalStore } from "react";

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
import type { ShellRouteScope, ShellSettingsParityTargets } from "@/lib/route-scope";
import {
  SHELL_REFRESH_PROFILE_OPTIONS,
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";
import { EMPTY_RUNTIME_SNAPSHOT } from "@/lib/runtime";

type SettingsRouteScope = ShellRouteScope;
type SettingsParityTargets = ShellSettingsParityTargets;

export function SettingsWorkspace({
  initialRuntimeSnapshot,
}: {
  initialRuntimeSnapshot?: ShellRuntimeSnapshot | null;
  initialContractAuditSnapshot?: ShellContractAuditSnapshot | null;
  initialParityTargetSnapshot?: ShellParityTargetsSnapshot | null;
  initialParityAuditSnapshot?: ShellParityAuditSnapshot | null;
  routeScope?: SettingsRouteScope;
  parityTargets?: SettingsParityTargets;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
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

  const currentTheme = mounted ? (resolvedTheme ?? "system") : "system";

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
    </SettingsLayout>
  );
}
