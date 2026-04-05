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
      className="inline-flex h-6 items-center justify-center gap-1.5 rounded-[4px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-2.5 text-[12px] font-medium text-[color:var(--shell-control-muted)] transition-colors hover:bg-[color:var(--shell-control-hover)] hover:text-foreground"
    >
      {label}
      <ArrowRight className="h-3.5 w-3.5" />
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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3 py-3">
      <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">Route scope</Badge>
            {scope?.projectId ? (
              <Badge tone="neutral">project {resolvedProjectLabel}</Badge>
            ) : null}
            {scope?.intakeSessionId ? (
              <Badge tone="info">intake {resolvedIntakeLabel}</Badge>
            ) : null}
          </div>
          <div className="text-[12px] leading-5 text-muted-foreground">{description}</div>
      </div>
      <div className="flex flex-wrap gap-1.5">
          {showProjectLink && scope?.projectId ? (
            <ScopeActionLink
              href={buildExecutionProjectScopeHref(scope.projectId, scope)}
              label="Open execution project"
            />
          ) : null}
          {showIntakeLink && scope?.intakeSessionId ? (
            <ScopeActionLink
              href={buildExecutionIntakeScopeHref(scope.intakeSessionId, scope)}
              label="Open intake session"
            />
          ) : null}
          {showDashboardLink ? (
            <ScopeActionLink
              href={buildDashboardScopeHref(scope)}
              label="Open scoped dashboard"
            />
          ) : null}
          {showPortfolioLink ? (
            <ScopeActionLink
              href={buildPortfolioScopeHref(scope)}
              label="Open scoped portfolio"
            />
          ) : null}
          {showInboxLink ? (
            <ScopeActionLink
              href={buildInboxScopeHref(scope)}
              label="Open scoped inbox"
            />
          ) : null}
          {showSettingsLink ? (
            <ScopeActionLink
              href={settingsHref || buildSettingsScopeHref(scope)}
              label="Open scoped settings"
            />
          ) : null}
          <ScopeActionLink href={clearHref} label="Clear scope" />
      </div>
    </div>
  );
}
