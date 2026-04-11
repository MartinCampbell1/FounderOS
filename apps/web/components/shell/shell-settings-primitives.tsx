"use client";

import { cn } from "@founderos/ui/lib/utils";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type * as React from "react";

const settingsSurfaceClass =
  "rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)]";

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
      <aside className="hidden w-[208px] shrink-0 border-r border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)]/40 px-2.5 py-4 md:block">
        {sidebar}
      </aside>
      <div className="min-w-0 flex-1 px-6 py-5 md:px-8 lg:px-10">
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
        <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </div>
      ) : null}
      <nav className="space-y-1">{children}</nav>
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
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-8 items-center gap-2 rounded-[8px] px-2.5 text-[13px] font-medium tracking-[-0.01em] transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-0",
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
      className="mb-3 inline-flex items-center gap-1.5 rounded-[8px] px-2 py-1.5 text-[13px] font-medium text-muted-foreground transition-[background-color,color] hover:bg-[color:var(--shell-control-hover)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-0"
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
    <h1 className="mb-4 text-[20px] font-semibold tracking-[-0.02em] text-foreground sm:text-[22px]">
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
    <h2
      className={cn(
        "mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground",
        className
      )}
    >
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
        settingsSurfaceClass,
        "divide-y divide-[color:var(--shell-control-border)] overflow-hidden",
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
        "group flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-[color:var(--shell-control-hover)] sm:flex-row sm:items-center sm:justify-between sm:gap-6",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium tracking-[-0.01em] text-foreground">
          {title}
        </div>
        {description ? (
          <div className="mt-0.5 text-[12px] leading-5 text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>
      {control ? (
        <div className="shrink-0 self-start sm:self-center">{control}</div>
      ) : null}
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
      className="h-8 min-w-[132px] cursor-pointer rounded-[8px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-2.5 pr-8 text-[13px] font-medium leading-none text-foreground outline-none transition-[background-color,border-color,box-shadow] hover:bg-[color:var(--shell-control-hover)] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-0"
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
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-[color:var(--shell-control-border)] transition-[background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-0",
        checked
          ? "border-primary/35 bg-primary"
          : "bg-[color:var(--shell-control-bg)] hover:bg-[color:var(--shell-control-hover)]"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 rounded-full border border-border/60 bg-card transition-transform",
          checked ? "translate-x-[20px]" : "translate-x-[3px]"
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
        "group flex items-center justify-between gap-4 rounded-[10px] px-4 py-3 transition-[background-color,border-color,color] hover:bg-[color:var(--shell-control-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-0",
        className
      )}
    >
      <div className="min-w-0">
        <div className="text-[13px] font-medium tracking-[-0.01em] text-foreground">
          {title}
        </div>
        {description ? (
          <div className="mt-0.5 text-[12px] leading-5 text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
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
    <div className="inline-flex items-center gap-2 text-[12px] font-medium leading-none">
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          status === "online" && "bg-emerald-500",
          status === "offline" && "bg-red-400",
          status === "degraded" && "bg-amber-400"
        )}
      />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
