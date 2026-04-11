"use client";

import { cn } from "@founderos/ui/lib/utils";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { SettingsSidebar } from "@/components/settings/settings-sidebar";
import {
  SettingsGroup,
  SettingsLayout,
  SettingsPageTitle,
  SettingsRow,
  SettingsSectionTitle,
  SettingsSidebarLink,
  SettingsSidebarSection,
  SettingsStatusIndicator,
} from "@/components/shell/shell-settings-primitives";
import type {
  CapabilityConnector,
  CapabilityLaunchPreset,
  CapabilityPlugin,
  CapabilityProvider,
  CapabilityTool,
  ShellCapabilitiesSnapshot,
} from "@/lib/capabilities";
import { emptyCapabilitiesSnapshot } from "@/lib/capabilities";

type TabKey = "providers" | "connectors" | "tools" | "plugins" | "launchPresets";
type SurfaceStatus = "online" | "degraded" | "offline";

const TABS: Array<{
  key: TabKey;
  label: string;
  description: string;
  emptyMessage: string;
}> = [
  {
    key: "providers",
    label: "Providers",
    description: "Model backends and service status.",
    emptyMessage: "No providers have been catalogued yet.",
  },
  {
    key: "connectors",
    label: "Connectors",
    description: "Integration links and transport state.",
    emptyMessage: "No connectors have been catalogued yet.",
  },
  {
    key: "tools",
    label: "Tools",
    description: "Callable tools and their owning provider.",
    emptyMessage: "No tools have been catalogued yet.",
  },
  {
    key: "plugins",
    label: "Plugins",
    description: "Plugin packages and exposed commands.",
    emptyMessage: "No plugins have been catalogued yet.",
  },
  {
    key: "launchPresets",
    label: "Launch presets",
    description: "Saved launch bundles and their notes.",
    emptyMessage: "No launch presets have been catalogued yet.",
  },
];

const TAB_META = Object.fromEntries(TABS.map((tab) => [tab.key, tab])) as Record<
  TabKey,
  (typeof TABS)[number]
>;

const surfaceToneClass: Record<SurfaceStatus, string> = {
  online:
    "border-emerald-500/15 bg-emerald-500/[0.04] text-emerald-700 dark:text-emerald-300",
  degraded:
    "border-amber-500/15 bg-amber-500/[0.04] text-amber-700 dark:text-amber-300",
  offline: "border-red-500/15 bg-red-500/[0.04] text-red-700 dark:text-red-300",
};

const tableHeaderCellClass =
  "px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground";
const tableCellClass = "px-3 py-2.5 align-top";

function formatCount(count: number, singular: string) {
  return `${count.toLocaleString()} ${count === 1 ? singular : `${singular}s`}`;
}

function formatTimestamp(value: string) {
  if (!value) {
    return "Awaiting first snapshot";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getOverallStatus(loadState: "loading" | "ready" | "error", snapshot: ShellCapabilitiesSnapshot) {
  if (loadState === "loading") {
    return { tone: "degraded" as const, label: "Loading" };
  }

  if (loadState === "error") {
    return { tone: "offline" as const, label: "Failed" };
  }

  const hasFamilyErrors =
    snapshot.catalogLoadState === "error" ||
    snapshot.providersLoadState === "error" ||
    snapshot.connectorsLoadState === "error" ||
    snapshot.toolsLoadState === "error" ||
    snapshot.pluginsLoadState === "error" ||
    snapshot.launchPresetsLoadState === "error";

  return hasFamilyErrors
    ? { tone: "degraded" as const, label: "Partial" }
    : { tone: "online" as const, label: "Ready" };
}

function getFamilyStatus({
  pageLoadState,
  familyLoadState,
  count,
}: {
  pageLoadState: "loading" | "ready" | "error";
  familyLoadState: "ready" | "error";
  count: number;
}) {
  if (pageLoadState === "loading") {
    return { tone: "degraded" as const, label: "Loading" };
  }

  if (pageLoadState === "error") {
    return { tone: "offline" as const, label: "Failed" };
  }

  if (familyLoadState === "error") {
    return count > 0
      ? { tone: "degraded" as const, label: "Fallback" }
      : { tone: "offline" as const, label: "Error" };
  }

  return count > 0
    ? { tone: "online" as const, label: "Ready" }
    : { tone: "degraded" as const, label: "Empty" };
}

function getFamilyCount(tab: TabKey, snapshot: ShellCapabilitiesSnapshot) {
  switch (tab) {
    case "providers":
      return snapshot.providers.length;
    case "connectors":
      return snapshot.connectors.length;
    case "tools":
      return snapshot.tools.length;
    case "plugins":
      return snapshot.plugins.length;
    case "launchPresets":
      return snapshot.launchPresets.length;
  }
}

function getFamilyLoadState(tab: TabKey, snapshot: ShellCapabilitiesSnapshot) {
  switch (tab) {
    case "providers":
      return snapshot.providersLoadState;
    case "connectors":
      return snapshot.connectorsLoadState;
    case "tools":
      return snapshot.toolsLoadState;
    case "plugins":
      return snapshot.pluginsLoadState;
    case "launchPresets":
      return snapshot.launchPresetsLoadState;
  }
}

function getFamilyError(tab: TabKey, snapshot: ShellCapabilitiesSnapshot) {
  switch (tab) {
    case "providers":
      return snapshot.providersError;
    case "connectors":
      return snapshot.connectorsError;
    case "tools":
      return snapshot.toolsError;
    case "plugins":
      return snapshot.pluginsError;
    case "launchPresets":
      return snapshot.launchPresetsError;
  }
}

function getFamilyEmptyMessage(tab: TabKey) {
  return TAB_META[tab].emptyMessage;
}

function SettingsHeroStat({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: string;
  detail: string;
  status: { tone: SurfaceStatus; label: string };
}) {
  return (
    <div className="rounded-[16px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)]/75 px-4 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </div>
          <div className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">
            {value}
          </div>
        </div>
        <SettingsStatusIndicator status={status.tone} label={status.label} />
      </div>
      <div className="mt-3 text-[12px] leading-5 text-muted-foreground">
        {detail}
      </div>
    </div>
  );
}

function CapabilitiesTabButton({
  tab,
  active,
  count,
  status,
  onClick,
}: {
  tab: (typeof TABS)[number];
  active: boolean;
  count: number;
  status: { tone: SurfaceStatus; label: string };
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start justify-between gap-3 rounded-[8px] px-2.5 py-2 text-left text-[13px] font-medium tracking-[-0.01em] transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-0",
        active
          ? "bg-[color:var(--shell-nav-active)] text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-[color:var(--shell-control-hover)] hover:text-foreground"
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate">{tab.label}</span>
        <span
          className={cn(
            "mt-0.5 block text-[11px] leading-4",
            active ? "text-foreground/70" : "text-muted-foreground"
          )}
        >
          {tab.description} · {status.label.toLowerCase()}
        </span>
      </span>
      <span
        className={cn(
          "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border px-1.5 text-[10px] font-semibold tabular-nums tracking-[0.08em]",
          active
            ? "border-border/70 bg-background text-foreground"
            : "border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] text-muted-foreground"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function CapabilityMessage({
  tone,
  title,
  description,
}: {
  tone: SurfaceStatus;
  title: string;
  description: string;
}) {
  return (
    <div className={cn("m-4 rounded-[12px] border px-4 py-3", surfaceToneClass[tone])}>
      <div className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">
        {title}
      </div>
      <div className="mt-1 text-[12px] leading-5 text-muted-foreground">
        {description}
      </div>
    </div>
  );
}

function CapabilityLoadingState() {
  return (
    <div className="space-y-3 px-4 py-4">
      <div className="h-4 w-36 animate-pulse rounded-full bg-[color:var(--shell-control-hover)]" />
      <div className="space-y-2">
        <div className="h-3 w-full animate-pulse rounded-full bg-[color:var(--shell-control-hover)]" />
        <div className="h-3 w-11/12 animate-pulse rounded-full bg-[color:var(--shell-control-hover)]" />
        <div className="h-3 w-10/12 animate-pulse rounded-full bg-[color:var(--shell-control-hover)]" />
      </div>
      <div className="grid gap-2 pt-1">
        <div className="h-9 animate-pulse rounded-[10px] bg-[color:var(--shell-control-hover)]" />
        <div className="h-9 animate-pulse rounded-[10px] bg-[color:var(--shell-control-hover)]" />
        <div className="h-9 animate-pulse rounded-[10px] bg-[color:var(--shell-control-hover)]" />
      </div>
    </div>
  );
}

function CapabilitySurface({
  title,
  description,
  countLabel,
  status,
  pageLoadState,
  familyLoadState,
  isEmpty,
  emptyMessage,
  errorMessage,
  children,
}: {
  title: string;
  description: string;
  countLabel: string;
  status: { tone: SurfaceStatus; label: string };
  pageLoadState: "loading" | "ready" | "error";
  familyLoadState: "ready" | "error";
  isEmpty: boolean;
  emptyMessage: string;
  errorMessage: string | null;
  children: ReactNode;
}) {
  const isLoading = pageLoadState === "loading";
  const isErrorEmpty =
    pageLoadState === "error" || (familyLoadState === "error" && isEmpty);
  const showEmpty = !isLoading && !isErrorEmpty && isEmpty;

  return (
    <section className="overflow-hidden rounded-[16px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)]/70 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[color:var(--shell-control-border)] px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">
            {title}
          </div>
          <div className="mt-1 text-[12px] leading-5 text-muted-foreground">
            {description}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            {countLabel}
          </span>
          <SettingsStatusIndicator status={status.tone} label={status.label} />
        </div>
      </div>

      {isLoading ? (
        <CapabilityLoadingState />
      ) : isErrorEmpty ? (
        <CapabilityMessage
          tone="offline"
          title="Unable to load this family"
          description={errorMessage ?? "The capabilities snapshot failed before this section could render."}
        />
      ) : showEmpty ? (
        <CapabilityMessage tone="degraded" title="No rows yet" description={emptyMessage} />
      ) : (
        <>
          {errorMessage ? (
            <CapabilityMessage
              tone="degraded"
              title="Catalog fallback in use"
              description={errorMessage}
            />
          ) : null}
          {children}
        </>
      )}
    </section>
  );
}

function TableHeader({ columns }: { columns: string[] }) {
  return (
    <thead>
      <tr className="border-b border-[color:var(--shell-control-border)]">
        {columns.map((col) => (
          <th key={col} className={tableHeaderCellClass}>
            {col}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function ProvidersTable({ providers }: { providers: CapabilityProvider[] }) {
  return (
    <table className="w-full text-[12.5px]">
      <TableHeader columns={["Provider", "Status", "Models"]} />
      <tbody>
        {providers.map((provider) => {
          const name = provider.id ?? provider.name ?? "—";
          const active =
            provider.status === "active" || provider.status === "enabled";
          const models = Array.isArray(provider.models)
            ? provider.models.join(", ")
            : "—";

          return (
            <tr
              key={name}
              className="border-b border-[color:var(--shell-control-border)]/70 last:border-0"
            >
              <td className={cn(tableCellClass, "font-medium text-foreground")}>
                {name}
              </td>
              <td className={tableCellClass}>
                <SettingsStatusIndicator
                  status={active ? "online" : "degraded"}
                  label={provider.status ?? "unknown"}
                />
              </td>
              <td className={cn(tableCellClass, "text-muted-foreground")}>
                {models}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ConnectorsTable({ connectors }: { connectors: CapabilityConnector[] }) {
  return (
    <table className="w-full text-[12.5px]">
      <TableHeader columns={["Name", "Type", "Status"]} />
      <tbody>
        {connectors.map((connector, index) => {
          const name = connector.name ?? connector.id ?? String(index);
          const active =
            connector.status === "connected" ||
            connector.status === "active" ||
            connector.status === "enabled";

          return (
            <tr
              key={name}
              className="border-b border-[color:var(--shell-control-border)]/70 last:border-0"
            >
              <td className={cn(tableCellClass, "font-medium text-foreground")}>
                {name}
              </td>
              <td className={cn(tableCellClass, "text-muted-foreground")}>
                {connector.type ?? "—"}
              </td>
              <td className={tableCellClass}>
                <SettingsStatusIndicator
                  status={active ? "online" : "degraded"}
                  label={connector.status ?? "unknown"}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ToolsTable({ tools }: { tools: CapabilityTool[] }) {
  return (
    <table className="w-full text-[12.5px]">
      <TableHeader columns={["Tool", "Provider", "Description"]} />
      <tbody>
        {tools.map((tool, index) => {
          const name = tool.name ?? String(index);

          return (
            <tr
              key={name}
              className="border-b border-[color:var(--shell-control-border)]/70 last:border-0"
            >
              <td className={cn(tableCellClass, "font-medium text-foreground")}>
                {name}
              </td>
              <td className={cn(tableCellClass, "text-muted-foreground")}>
                {tool.provider ?? "—"}
              </td>
              <td className={cn(tableCellClass, "text-muted-foreground")}>
                {tool.description ?? "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function PluginsTable({ plugins }: { plugins: CapabilityPlugin[] }) {
  return (
    <table className="w-full text-[12.5px]">
      <TableHeader columns={["Plugin", "Status", "Commands"]} />
      <tbody>
        {plugins.map((plugin, index) => {
          const name = plugin.name ?? plugin.id ?? String(index);
          const active = plugin.status === "enabled" || plugin.status === "active";
          const commands = Array.isArray(plugin.commands)
            ? plugin.commands.join(", ")
            : "—";

          return (
            <tr
              key={name}
              className="border-b border-[color:var(--shell-control-border)]/70 last:border-0"
            >
              <td className={cn(tableCellClass, "font-medium text-foreground")}>
                {name}
              </td>
              <td className={tableCellClass}>
                <SettingsStatusIndicator
                  status={active ? "online" : "degraded"}
                  label={plugin.status ?? "unknown"}
                />
              </td>
              <td className={cn(tableCellClass, "text-muted-foreground")}>
                {commands}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function LaunchPresetsTable({
  launchPresets,
}: {
  launchPresets: CapabilityLaunchPreset[];
}) {
  return (
    <table className="w-full text-[12.5px]">
      <TableHeader columns={["Preset", "Description"]} />
      <tbody>
        {launchPresets.map((preset, index) => {
          const name = preset.label ?? preset.id ?? String(index);

          return (
            <tr
              key={preset.id ?? name}
              className="border-b border-[color:var(--shell-control-border)]/70 last:border-0"
            >
              <td className={cn(tableCellClass, "font-medium text-foreground")}>
                {name}
              </td>
              <td className={cn(tableCellClass, "text-muted-foreground")}>
                {preset.description ?? "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function renderFamilyTable(tab: TabKey, snapshot: ShellCapabilitiesSnapshot) {
  switch (tab) {
    case "providers":
      return <ProvidersTable providers={snapshot.providers} />;
    case "connectors":
      return <ConnectorsTable connectors={snapshot.connectors} />;
    case "tools":
      return <ToolsTable tools={snapshot.tools} />;
    case "plugins":
      return <PluginsTable plugins={snapshot.plugins} />;
    case "launchPresets":
      return <LaunchPresetsTable launchPresets={snapshot.launchPresets} />;
  }
}

export default function SettingsCapabilitiesPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("providers");
  const [snapshot, setSnapshot] = useState<ShellCapabilitiesSnapshot>(
    emptyCapabilitiesSnapshot()
  );
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading"
  );

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/shell/capabilities", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const data = (await response.json()) as ShellCapabilitiesSnapshot;

        if (!active) {
          return;
        }

        setSnapshot(data);
        setLoadState("ready");
      } catch {
        if (!active) {
          return;
        }

        setLoadState("error");
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const activeMeta = TAB_META[activeTab];
  const activeCount = getFamilyCount(activeTab, snapshot);
  const activeLoadState = getFamilyLoadState(activeTab, snapshot);
  const activeError = getFamilyError(activeTab, snapshot);
  const activeStatus = getFamilyStatus({
    pageLoadState: loadState,
    familyLoadState: activeLoadState,
    count: activeCount,
  });
  const totalCount =
    snapshot.providers.length +
    snapshot.connectors.length +
    snapshot.tools.length +
    snapshot.plugins.length +
    snapshot.launchPresets.length;
  const readyFamilies = TABS.filter(
    (tab) =>
      getFamilyStatus({
        pageLoadState: loadState,
        familyLoadState: getFamilyLoadState(tab.key, snapshot),
        count: getFamilyCount(tab.key, snapshot),
      }).tone === "online"
  ).length;
  const overallStatus = getOverallStatus(loadState, snapshot);
  const generatedAt = formatTimestamp(snapshot.generatedAt);

  return (
    <SettingsLayout
      sidebar={
        <>
          <SettingsSidebar activeView="capabilities" />
          <SettingsSidebarSection title="Capability families">
            {TABS.map((tab) => {
              const count = getFamilyCount(tab.key, snapshot);
              const status = getFamilyStatus({
                pageLoadState: loadState,
                familyLoadState: getFamilyLoadState(tab.key, snapshot),
                count,
              });

              return (
                <CapabilitiesTabButton
                  key={tab.key}
                  tab={tab}
                  active={activeTab === tab.key}
                  count={loadState === "loading" ? 0 : count}
                  status={status}
                  onClick={() => setActiveTab(tab.key)}
                />
              );
            })}
          </SettingsSidebarSection>

          <SettingsSidebarSection title="Quick jumps">
            <SettingsSidebarLink href="#overview">Overview</SettingsSidebarLink>
            <SettingsSidebarLink href="#state">State</SettingsSidebarLink>
            <SettingsSidebarLink href="#selected-family">
              Selected family
            </SettingsSidebarLink>
          </SettingsSidebarSection>
        </>
      }
    >
      <div
        id="overview"
        className="mb-6 rounded-[20px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)]/70 px-5 py-5 shadow-sm"
      >
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              Settings / Capabilities
            </div>
            <SettingsPageTitle>Capabilities</SettingsPageTitle>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Inspect providers, connectors, tools, plugins, and launch presets
              in the same settings-cluster grammar as the main settings page.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SettingsStatusIndicator
              status={overallStatus.tone}
              label={overallStatus.label}
            />
            <span className="rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              {generatedAt}
            </span>
            <span className="rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              {formatCount(totalCount, "row")}
            </span>
          </div>
        </div>
      </div>

      <div className="mb-8 grid gap-3 md:grid-cols-3">
        <SettingsHeroStat
          label="Families ready"
          value={`${readyFamilies}/${TABS.length}`}
          detail="Families with loaded rows and no live request errors."
          status={overallStatus}
        />
        <SettingsHeroStat
          label="Total rows"
          value={formatCount(totalCount, "row")}
          detail="Combined rows across providers, connectors, tools, plugins, and launch presets."
          status={
            totalCount > 0
              ? { tone: "online", label: "Populated" }
              : { tone: "degraded", label: "Empty" }
          }
        />
        <SettingsHeroStat
          label="Last snapshot"
          value={generatedAt}
          detail="Fetched from /api/shell/capabilities with no-store semantics."
          status={overallStatus}
        />
      </div>

      <div id="state" className="scroll-mt-24">
        <SettingsSectionTitle>Snapshot state</SettingsSectionTitle>
      </div>
      <SettingsGroup className="mb-8">
        <SettingsRow
          title="Catalog"
          description={
            loadState === "loading"
              ? "Fetching capabilities snapshot."
              : loadState === "error"
                ? "The capabilities endpoint could not be reached."
                : snapshot.catalog
                  ? "Catalog payload present and available as a fallback source."
                  : "No catalog payload was returned; live family endpoints are the source of truth."
          }
          control={
            <SettingsStatusIndicator
              status={
                loadState === "error"
                  ? "offline"
                  : snapshot.catalogLoadState === "error"
                    ? "degraded"
                    : "online"
              }
              label={
                loadState === "loading"
                  ? "Loading"
                  : loadState === "error"
                    ? "Failed"
                    : snapshot.catalogLoadState === "error"
                      ? "Partial"
                      : "Ready"
              }
            />
          }
        />
        <SettingsRow
          title="Family coverage"
          description={`${readyFamilies} ready · ${TABS.length - readyFamilies} not ready`}
          control={
            <span className="text-[12px] text-muted-foreground">
              {loadState === "loading" ? "Waiting for data" : formatCount(totalCount, "row")}
            </span>
          }
        />
        <SettingsRow
          title="Active family"
          description={`${activeMeta.label} · ${activeMeta.description}`}
          control={
            <SettingsStatusIndicator
              status={activeStatus.tone}
              label={activeStatus.label}
            />
          }
        />
      </SettingsGroup>

      <div id="selected-family" className="scroll-mt-24 space-y-3">
        <SettingsSectionTitle>Selected family</SettingsSectionTitle>
        <CapabilitySurface
          title={activeMeta.label}
          description={activeMeta.description}
          countLabel={
            loadState === "loading"
              ? "Loading"
              : formatCount(activeCount, activeTab === "launchPresets" ? "preset" : "row")
          }
          status={activeStatus}
          pageLoadState={loadState}
          familyLoadState={activeLoadState}
          isEmpty={activeCount === 0}
          emptyMessage={getFamilyEmptyMessage(activeTab)}
          errorMessage={
            loadState === "error"
              ? "Failed to load the capabilities endpoint."
              : activeError
          }
        >
          {renderFamilyTable(activeTab, snapshot)}
        </CapabilitySurface>
      </div>
    </SettingsLayout>
  );
}
