"use client";

import { Badge } from "@founderos/ui/components/badge";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import {
  buildDashboardScopeHref,
  buildExecutionIntakeScopeHref,
  buildExecutionProjectScopeHref,
  buildInboxScopeHref,
  buildPortfolioScopeHref,
  buildSettingsScopeHref,
  hasShellRouteScope,
  type ShellRouteScope,
} from "@/lib/route-scope";

type ShellRouteScopeBannerProps = {
  scope?: ShellRouteScope | null;
  projectLabel?: string | null;
  intakeLabel?: string | null;
  description: string;
  clearHref: string;
  settingsHref?: string;
  showProjectLink?: boolean;
  showIntakeLink?: boolean;
  showDashboardLink?: boolean;
  showPortfolioLink?: boolean;
  showInboxLink?: boolean;
  showSettingsLink?: boolean;
};

function ScopeActionLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-5 items-center gap-1 rounded-[4px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-2 text-[11px] font-medium tracking-[-0.01em] text-[color:var(--shell-control-muted)] transition-colors hover:bg-[color:var(--shell-control-hover)] hover:text-foreground"
    >
      {label}
      <ArrowRight className="h-3 w-3 opacity-70" />
    </Link>
  );
}

export function ShellRouteScopeBanner({
  scope,
  projectLabel,
  intakeLabel,
  description,
  clearHref,
  settingsHref,
  showProjectLink = true,
  showIntakeLink = true,
  showDashboardLink = true,
  showPortfolioLink = true,
  showInboxLink = true,
  showSettingsLink = true,
}: ShellRouteScopeBannerProps) {
  if (!hasShellRouteScope(scope)) {
    return null;
  }

  const resolvedProjectLabel = (projectLabel || scope?.projectId || "").trim();
  const resolvedIntakeLabel = (intakeLabel || scope?.intakeSessionId || "").trim();

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-[6px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3 py-2.5">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral">Route scope</Badge>
          {scope?.projectId ? (
            <Badge tone="neutral">project {resolvedProjectLabel}</Badge>
          ) : null}
          {scope?.intakeSessionId ? (
            <Badge tone="info">intake {resolvedIntakeLabel}</Badge>
          ) : null}
        </div>
        <div className="max-w-[64ch] text-[12px] leading-5 text-muted-foreground">
          {description}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1">
        {showProjectLink && scope?.projectId ? (
          <ScopeActionLink
            href={buildExecutionProjectScopeHref(scope.projectId, scope)}
            label="Project"
          />
        ) : null}
        {showIntakeLink && scope?.intakeSessionId ? (
          <ScopeActionLink
            href={buildExecutionIntakeScopeHref(scope.intakeSessionId, scope)}
            label="Intake"
          />
        ) : null}
        {showDashboardLink ? (
          <ScopeActionLink
            href={buildDashboardScopeHref(scope)}
            label="Dashboard"
          />
        ) : null}
        {showPortfolioLink ? (
          <ScopeActionLink
            href={buildPortfolioScopeHref(scope)}
            label="Portfolio"
          />
        ) : null}
        {showInboxLink ? (
          <ScopeActionLink href={buildInboxScopeHref(scope)} label="Inbox" />
        ) : null}
        {showSettingsLink ? (
          <ScopeActionLink
            href={settingsHref || buildSettingsScopeHref(scope)}
            label="Settings"
          />
        ) : null}
        <ScopeActionLink href={clearHref} label="Clear scope" />
      </div>
    </div>
  );
}
