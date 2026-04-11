"use client";

import { Server, Settings2, ShieldCheck } from "lucide-react";

import {
  SettingsSidebarBackLink,
  SettingsSidebarLink,
  SettingsSidebarSection,
} from "@/components/shell/shell-settings-primitives";

type SettingsSidebarView = "overview" | "accounts" | "capabilities";

export function SettingsSidebar({
  activeView,
  showDiagnostics = false,
}: {
  activeView: SettingsSidebarView;
  showDiagnostics?: boolean;
}) {
  return (
    <>
      <SettingsSidebarBackLink href="/dashboard">Back to app</SettingsSidebarBackLink>

      <SettingsSidebarSection title="Settings">
        <SettingsSidebarLink
          href="/settings"
          active={activeView === "overview"}
          icon={<Settings2 className="h-4 w-4" />}
        >
          Overview
        </SettingsSidebarLink>
        <SettingsSidebarLink
          href="/settings/accounts"
          active={activeView === "accounts"}
          icon={<ShieldCheck className="h-4 w-4" />}
        >
          Accounts
        </SettingsSidebarLink>
        <SettingsSidebarLink
          href="/settings/capabilities"
          active={activeView === "capabilities"}
          icon={<Server className="h-4 w-4" />}
        >
          Capabilities
        </SettingsSidebarLink>
      </SettingsSidebarSection>

      {showDiagnostics ? (
        <SettingsSidebarSection title="Diagnostics">
          <SettingsSidebarLink href="#overview" icon={<Settings2 className="h-4 w-4" />}>
            Overview
          </SettingsSidebarLink>
          <SettingsSidebarLink href="#connections" icon={<Server className="h-4 w-4" />}>
            Connections
          </SettingsSidebarLink>
          <SettingsSidebarLink href="#route-scope" icon={<Server className="h-4 w-4" />}>
            Route scope
          </SettingsSidebarLink>
          <SettingsSidebarLink href="#audits" icon={<Server className="h-4 w-4" />}>
            Audits
          </SettingsSidebarLink>
        </SettingsSidebarSection>
      ) : null}
    </>
  );
}
