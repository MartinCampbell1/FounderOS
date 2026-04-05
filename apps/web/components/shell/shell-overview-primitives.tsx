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
    <div className={cn("flex flex-wrap gap-6", className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <div className="text-[22px] font-medium text-foreground">
            {item.value}
          </div>
          <div className="mt-0.5 text-[12px] text-muted-foreground">
            {item.href ? (
              <Link
                href={item.href}
                className="transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ) : (
              item.label
            )}
          </div>
        </div>
      ))}
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
        "flex flex-wrap gap-4 rounded-lg border border-border px-4 py-3",
        className
      )}
    >
      {items.map((item) => (
        <div key={item.name} className="flex items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              item.status === "online" && "bg-emerald-500",
              item.status === "offline" && "bg-muted-foreground/40",
              item.status === "degraded" && "bg-amber-400"
            )}
          />
          <span className="text-[13px] text-muted-foreground">{item.name}</span>
          {item.detail ? (
            <span className="text-[12px] text-muted-foreground/70">
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
        "flex flex-col items-center justify-center py-12 text-center",
        className
      )}
    >
      {icon ? (
        <div className="mb-3 text-muted-foreground/40">{icon}</div>
      ) : null}
      {title ? (
        <div className="text-[14px] font-medium text-foreground">{title}</div>
      ) : null}
      <div className="mt-1 max-w-md text-[13px] text-muted-foreground">
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
    <>
      {icon ? (
        <div className="shrink-0 text-muted-foreground">{icon}</div>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium text-foreground">{title}</div>
        {subtitle ? (
          <div className="text-[12px] text-muted-foreground">{subtitle}</div>
        ) : null}
      </div>
      {trailing ? (
        <div className="shrink-0 text-[12px] text-muted-foreground">
          {trailing}
        </div>
      ) : null}
    </>
  );

  const cls = cn(
    "flex items-center gap-3 border-b border-border px-1 py-3 last:border-b-0",
    href && "transition-colors hover:bg-[color:var(--shell-control-hover)]",
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
        "flex items-center justify-between border-b border-border pb-2",
        className
      )}
    >
      <h3 className="text-[14px] font-medium text-foreground">{title}</h3>
      {action}
    </div>
  );
}
