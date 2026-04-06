"use client";

import { cn } from "@founderos/ui/lib/utils";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type * as React from "react";

/* ── Settings Layout ─────────────────────────────────────── */

export function SettingsLayout({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100vh-44px)]">
      <aside className="hidden w-[220px] shrink-0 border-r border-border px-3 py-5 md:block">
        {sidebar}
      </aside>
      <div className="min-w-0 flex-1 px-8 py-6 md:px-12 lg:px-16">
        <div className="mx-auto max-w-2xl">{children}</div>
      </div>
    </div>
  );
}

/* ── Settings Sidebar ────────────────────────────────────── */

export function SettingsSidebarSection({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      {title ? (
        <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
      ) : null}
      <nav className="space-y-0.5">{children}</nav>
    </div>
  );
}

export function SettingsSidebarLink({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-8 items-center gap-2 rounded-md px-2 text-[13px] font-medium transition-colors",
        active
          ? "bg-[color:var(--shell-nav-active)] text-foreground"
          : "text-muted-foreground hover:bg-[color:var(--shell-control-hover)] hover:text-foreground"
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </Link>
  );
}

export function SettingsSidebarBackLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="mb-4 flex items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronRight className="h-3.5 w-3.5 rotate-180" />
      <span>{children}</span>
    </Link>
  );
}

/* ── Settings Content ────────────────────────────────────── */

export function SettingsPageTitle({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <h1 className="mb-6 text-[22px] font-medium text-foreground">
      {children}
    </h1>
  );
}

export function SettingsSectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={cn("mb-3 text-[16px] font-medium text-foreground", className)}>
      {children}
    </h2>
  );
}

/* ── Settings Group (rounded container with divided rows) ── */

export function SettingsGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "divide-y divide-border overflow-hidden rounded-lg border border-border",
        className
      )}
    >
      {children}
    </div>
  );
}

/* ── Settings Row ────────────────────────────────────────── */

export function SettingsRow({
  title,
  description,
  control,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  control?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-6 px-4 py-3.5",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium text-foreground">{title}</div>
        {description ? (
          <div className="mt-0.5 text-[13px] text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>
      {control ? <div className="shrink-0">{control}</div> : null}
    </div>
  );
}

/* ── Settings Select (dropdown-style control) ────────────── */

export function SettingsSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border border-border bg-background px-3 text-[13px] font-medium text-foreground outline-none transition-colors hover:border-muted-foreground/30 focus:ring-2 focus:ring-ring/50"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

/* ── Settings Toggle ─────────────────────────────────────── */

export function SettingsToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        checked ? "bg-primary" : "bg-muted-foreground/25"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-card shadow-sm transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-[3px]"
        )}
      />
    </button>
  );
}

/* ── Settings Link Row (with chevron) ────────────────────── */

export function SettingsLinkRow({
  href,
  title,
  description,
  className,
}: {
  href: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-[color:var(--shell-control-hover)]",
        className
      )}
    >
      <div className="min-w-0">
        <div className="text-[14px] font-medium text-foreground">{title}</div>
        {description ? (
          <div className="mt-0.5 text-[13px] text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

/* ── Status Indicator ────────────────────────────────────── */

export function SettingsStatusIndicator({
  status,
  label,
}: {
  status: "online" | "offline" | "degraded";
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          status === "online" && "bg-emerald-500",
          status === "offline" && "bg-red-400",
          status === "degraded" && "bg-amber-400"
        )}
      />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
