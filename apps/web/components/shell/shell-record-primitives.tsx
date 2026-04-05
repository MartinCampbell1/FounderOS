"use client";

import { Button } from "@founderos/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@founderos/ui/components/card";
import { cn } from "@founderos/ui/lib/utils";
import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import type * as React from "react";

export function ShellRecordCard({
  children,
  className,
  selected = false,
}: {
  children: React.ReactNode;
  className?: string;
  selected?: boolean;
}) {
  return (
    <Card
      className={cn(
        "overflow-hidden rounded-[10px] border-[color:var(--shell-control-border)] bg-card shadow-[0_1px_2px_rgba(0,0,0,0.05)]",
        selected
          ? "border-primary/50 shadow-[0_0_0_1px_rgba(94,106,210,0.18)]"
          : undefined,
        className
      )}
    >
      {children}
    </Card>
  );
}

export function ShellRecordHeader({
  badges,
  title,
  description,
  accessory,
  className,
  titleClassName,
  descriptionClassName,
}: {
  badges?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  accessory?: React.ReactNode;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}) {
  return (
    <CardHeader
      className={cn(
        "gap-3 border-b border-[color:var(--shell-control-border)] p-4",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2.5">
          {badges ? <div className="flex flex-wrap gap-1.5">{badges}</div> : null}
          <div className="space-y-1.5">
            <CardTitle className={cn("text-[15px] leading-5", titleClassName)}>
              {title}
            </CardTitle>
            {description ? (
              <CardDescription
                className={cn(
                  "max-w-4xl text-[13px] leading-6 text-foreground/74",
                  descriptionClassName
                )}
              >
                {description}
              </CardDescription>
            ) : null}
          </div>
        </div>
        {accessory ? <div className="shrink-0">{accessory}</div> : null}
      </div>
    </CardHeader>
  );
}

export function ShellRecordBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <CardContent className={cn("space-y-3 p-4 pt-3", className)}>{children}</CardContent>;
}

export function ShellRecordSection({
  title,
  children,
  className,
  titleClassName,
  tone = "neutral",
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  titleClassName?: string;
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-[8px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-3",
        tone === "info"
          ? "border-sky-400/20 bg-sky-500/[0.05]"
          : undefined,
        tone === "success"
          ? "border-emerald-400/20 bg-emerald-500/[0.05]"
          : undefined,
        tone === "warning"
          ? "border-amber-400/20 bg-amber-500/[0.05]"
          : undefined,
        tone === "danger"
          ? "border-rose-400/20 bg-rose-500/[0.05]"
          : undefined,
        className
      )}
    >
      {title ? (
        <div className={cn("text-[12px] font-medium text-foreground", titleClassName)}>
          {title}
        </div>
      ) : null}
      <div className={title ? "mt-2" : undefined}>{children}</div>
    </div>
  );
}

export function ShellRecordAccessory({
  label,
  value,
  detail,
  className,
  align = "right",
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  detail?: React.ReactNode;
  className?: string;
  align?: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "min-w-[132px] rounded-[8px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3 py-2.5",
        align === "right" ? "text-right" : "text-left",
        className
      )}
    >
      <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
      <div className="mt-1.5 text-[13px] font-medium leading-5 text-foreground">{value}</div>
      {detail ? (
        <div className="mt-1 text-[11px] leading-4 text-muted-foreground">{detail}</div>
      ) : null}
    </div>
  );
}

export function ShellRecordMeta({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-x-3 gap-y-1 text-[12px] leading-5 text-muted-foreground",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ShellRecordActionBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-wrap gap-2", className)}>{children}</div>;
}

export function ShellRecordSelectionButton({
  selected,
  disabled,
  onClick,
  label = "Select record",
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      aria-label={label}
      aria-pressed={selected}
      className={cn(
        "h-6 w-6 rounded-[4px] px-0",
        selected
          ? "border-primary/50 bg-[color:var(--shell-nav-active)] text-foreground hover:bg-[color:var(--shell-nav-active)]"
          : "text-transparent"
      )}
      onClick={onClick}
      disabled={disabled}
    >
      <Check className="h-3.5 w-3.5" />
    </Button>
  );
}

export function ShellRecordLinkButton({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-6 items-center justify-center gap-1.5 rounded-[4px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-2.5 text-[12px] font-medium text-[color:var(--shell-control-muted)] transition-colors hover:bg-[color:var(--shell-control-hover)] hover:text-foreground",
        className
      )}
    >
      {label}
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}
