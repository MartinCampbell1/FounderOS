"use client";

import { cn } from "@founderos/ui/lib/utils";
import Link from "next/link";
import type * as React from "react";

/* ── Overview stat row (compact inline stats) ────────────── */

export function OverviewStatRow({
  items,
  className,
}: {
  items: Array<{
    label: string;
    value: string | number;
    href?: string;
  }>;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-5", className)}>
      {items.map((item) => {
        const content = (
          <div className="space-y-1">
            <div className="text-[24px] font-semibold tabular-nums tracking-[-0.02em] text-foreground">
              {item.value}
            </div>
            <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground transition-colors group-hover:text-foreground">
              {item.label}
            </div>
          </div>
        );
        return item.href ? (
          <Link
            key={item.label}
            href={item.href}
            className="group rounded-[8px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3 py-2.5 shadow-none transition-colors hover:bg-[color:var(--shell-control-hover)] hover:border-primary/15"
          >
            {content}
          </Link>
        ) : (
          <div
            key={item.label}
            className="rounded-[8px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3 py-2.5 shadow-none"
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}

/* ── Connection status (simple inline) ───────────────────── */

export function ConnectionStatus({
  items,
  className,
}: {
  items: Array<{
    name: string;
    status: "online" | "offline" | "degraded";
    detail?: string;
  }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-2 rounded-[8px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3 py-2.5",
        className
      )}
    >
      {items.map((item) => (
        <div
          key={item.name}
          className="flex items-center gap-2 rounded-[6px] border border-transparent px-2 py-1 transition-colors hover:bg-[color:var(--shell-control-hover)]"
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full shrink-0",
              item.status === "online" && "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]",
              item.status === "offline" && "bg-muted-foreground/30",
              item.status === "degraded" && "bg-amber-400"
            )}
          />
          <span className="text-[12px] font-medium text-foreground">{item.name}</span>
          {item.detail ? (
            <span className="text-[11px] text-muted-foreground">
              {item.detail}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/* ── Empty section (clean empty state) ───────────────────── */

export function OverviewEmptySection({
  title,
  description,
  icon,
  className,
}: {
  title?: string;
  description: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[8px] border border-dashed border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4 py-10 text-center",
        className
      )}
    >
      {icon ? (
        <div className="mb-2 text-muted-foreground/40">{icon}</div>
      ) : null}
      {title ? (
        <div className="text-[13px] font-medium text-foreground">{title}</div>
      ) : null}
      <div className="mt-1.5 max-w-md text-[12px] leading-5 text-muted-foreground">
        {description}
      </div>
    </div>
  );
}

/* ── Simple table row ────────────────────────────────────── */

export function OverviewListItem({
  icon,
  title,
  subtitle,
  trailing,
  href,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  href?: string;
  className?: string;
}) {
  const content = (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      {icon ? (
        <div className="shrink-0 text-muted-foreground">{icon}</div>
      ) : null}
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="truncate text-[13px] font-medium text-foreground">{title}</div>
        {subtitle ? (
          <div className="truncate text-[12px] leading-5 text-muted-foreground">{subtitle}</div>
        ) : null}
      </div>
      {trailing ? (
        <div className="shrink-0 text-[12px] text-muted-foreground">
          {trailing}
        </div>
      ) : null}
    </div>
  );

  const cls = cn(
    "flex min-h-11 items-center rounded-[8px] px-3 py-2.5 transition-colors",
    href && "hover:bg-[color:var(--shell-control-hover)]",
    className
  );

  if (href) {
    return (
      <Link href={href} className={cls}>
        {content}
      </Link>
    );
  }

  return <div className={cls}>{content}</div>;
}

/* ── Section divider ─────────────────────────────────────── */

export function OverviewSectionHeader({
  title,
  action,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-[color:var(--shell-control-border)] pb-2.5",
        className
      )}
    >
      <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-foreground">{title}</h3>
      {action}
    </div>
  );
}
