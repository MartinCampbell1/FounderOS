"use client";

import { cn } from "@founderos/ui/lib/utils";
import { useEffect, useState } from "react";

import { ShellPage } from "@/components/shell/shell-screen-primitives";
import type {
  ShellCapabilitiesSnapshot,
  CapabilityProvider,
  CapabilityConnector,
  CapabilityTool,
  CapabilityPlugin,
  CapabilityLaunchPreset,
} from "@/lib/capabilities";
import { emptyCapabilitiesSnapshot } from "@/lib/capabilities";

type TabKey = "providers" | "connectors" | "tools" | "plugins" | "launchPresets";

const TABS: { key: TabKey; label: string }[] = [
  { key: "providers", label: "Providers" },
  { key: "connectors", label: "Connectors" },
  { key: "tools", label: "Tools" },
  { key: "plugins", label: "Plugins" },
  { key: "launchPresets", label: "Launch Presets" },
];

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        active ? "bg-emerald-500" : "bg-muted-foreground/40"
      )}
    />
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <tr>
      <td
        colSpan={10}
        className="px-4 py-6 text-center text-[13px] text-muted-foreground"
      >
        {message}
      </td>
    </tr>
  );
}

function TableHeader({ columns }: { columns: string[] }) {
  return (
    <thead>
      <tr className="border-b border-border">
        {columns.map((col) => (
          <th
            key={col}
            className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {col}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function ProvidersTable({ providers }: { providers: CapabilityProvider[] }) {
  return (
    <table className="w-full text-[13px]">
      <TableHeader columns={["Provider", "Status", "Models"]} />
      <tbody>
        {providers.length === 0 ? (
          <EmptyRow message="No providers found." />
        ) : (
          providers.map((p) => {
            const id = p.id ?? p.name ?? "—";
            const active = p.status === "active" || p.status === "enabled";
            const models = Array.isArray(p.models) ? p.models.join(", ") : "—";
            return (
              <tr key={id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium text-foreground">{id}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <StatusDot active={active} />
                    <span className="text-muted-foreground">
                      {p.status ?? "unknown"}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{models}</td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}

function ConnectorsTable({ connectors }: { connectors: CapabilityConnector[] }) {
  return (
    <table className="w-full text-[13px]">
      <TableHeader columns={["Name", "Type", "Status"]} />
      <tbody>
        {connectors.length === 0 ? (
          <EmptyRow message="No connectors found." />
        ) : (
          connectors.map((c, i) => {
            const name = c.name ?? c.id ?? String(i);
            const active =
              c.status === "connected" ||
              c.status === "active" ||
              c.status === "enabled";
            return (
              <tr key={name} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium text-foreground">{name}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.type ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <StatusDot active={active} />
                    <span className="text-muted-foreground">
                      {c.status ?? "unknown"}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}

function ToolsTable({ tools }: { tools: CapabilityTool[] }) {
  return (
    <table className="w-full text-[13px]">
      <TableHeader columns={["Tool name", "Provider", "Description"]} />
      <tbody>
        {tools.length === 0 ? (
          <EmptyRow message="No tools found." />
        ) : (
          tools.map((t, i) => {
            const name = t.name ?? String(i);
            return (
              <tr key={name} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium text-foreground">{name}</td>
                <td className="px-4 py-3 text-muted-foreground">{t.provider ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{t.description ?? "—"}</td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}

function PluginsTable({ plugins }: { plugins: CapabilityPlugin[] }) {
  return (
    <table className="w-full text-[13px]">
      <TableHeader columns={["Plugin", "Status", "Commands"]} />
      <tbody>
        {plugins.length === 0 ? (
          <EmptyRow message="No plugins found." />
        ) : (
          plugins.map((p, i) => {
            const name = p.name ?? p.id ?? String(i);
            const active = p.status === "enabled" || p.status === "active";
            const commands = Array.isArray(p.commands) ? p.commands.join(", ") : "—";
            return (
              <tr key={name} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium text-foreground">{name}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <StatusDot active={active} />
                    <span className="text-muted-foreground">
                      {p.status ?? "unknown"}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{commands}</td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}

function LaunchPresetsTable({ launchPresets }: { launchPresets: CapabilityLaunchPreset[] }) {
  return (
    <table className="w-full text-[13px]">
      <TableHeader columns={["Preset", "Description"]} />
      <tbody>
        {launchPresets.length === 0 ? (
          <EmptyRow message="No launch presets found." />
        ) : (
          launchPresets.map((p) => {
            const name = p.label ?? p.id;
            return (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium text-foreground">{name}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.description ?? "—"}</td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}

export default function SettingsCapabilitiesPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("providers");
  const [snapshot, setSnapshot] = useState<ShellCapabilitiesSnapshot>(
    emptyCapabilitiesSnapshot()
  );
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");

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

  return (
    <ShellPage>
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-3 py-2 text-[13px] font-medium transition-colors",
              activeTab === tab.key
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        {loadState === "loading" ? (
          <div className="flex items-center justify-center py-12 text-[13px] text-muted-foreground">
            Loading capabilities…
          </div>
        ) : loadState === "error" ? (
          <div className="flex items-center justify-center py-12 text-[13px] text-muted-foreground">
            Failed to load capabilities.
          </div>
        ) : (
          <>
            {activeTab === "providers" && (
              <ProvidersTable providers={snapshot.providers} />
            )}
            {activeTab === "connectors" && (
              <ConnectorsTable connectors={snapshot.connectors} />
            )}
            {activeTab === "tools" && (
              <ToolsTable tools={snapshot.tools} />
            )}
            {activeTab === "plugins" && (
              <PluginsTable plugins={snapshot.plugins} />
            )}
            {activeTab === "launchPresets" && (
              <LaunchPresetsTable launchPresets={snapshot.launchPresets} />
            )}
          </>
        )}
      </div>
    </ShellPage>
  );
}
