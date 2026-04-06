"use client";

import { Button } from "@founderos/ui/components/button";
import { Badge } from "@founderos/ui/components/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@founderos/ui/components/card";
import { cn } from "@founderos/ui/lib/utils";
import { ArrowRight, Inbox, Loader2, RefreshCcw, Search } from "lucide-react";
import Link from "next/link";
import type * as React from "react";

import { ShellRecordSection } from "@/components/shell/shell-record-primitives";

export function ShellPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "shell-content-area mx-auto flex w-full max-w-[1680px] flex-col gap-4",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ShellHero({
  title,
  description,
  meta,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="shell-page-title">{title}</h2>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      {description ? (
        <p className="text-[13px] leading-6 text-muted-foreground">{description}</p>
      ) : null}
      {meta ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1 text-[12px] text-muted-foreground">
          {meta}
        </div>
      ) : null}
    </div>
  );
}

export function ShellMetricCard({
  label,
  value,
  detail,
  href,
  hrefLabel,
  className,
}: {
  label: string;
  value: string;
  detail?: string;
  href?: string;
  hrefLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1 py-3", className)}>
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className="text-[18px] font-medium text-foreground">{value}</div>
      {detail ? <div className="text-[12px] text-muted-foreground">{detail}</div> : null}
      {href && hrefLabel ? <ShellActionLink href={href} label={hrefLabel} /> : null}
    </div>
  );
}

export function ShellSectionCard({
  title,
  description,
  children,
  icon,
  actions,
  headerChildren,
  className,
  headerClassName,
  contentClassName,
  titleClassName,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  headerChildren?: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  titleClassName?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className={cn("space-y-1", headerClassName)}>
        <div className="flex items-center justify-between gap-3">
          <div className={cn("flex items-center gap-2")}>
            {icon}
            <h3 className={cn("text-[15px] font-medium text-foreground", titleClassName)}>{title}</h3>
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
        {description ? <p className="text-[13px] text-muted-foreground">{description}</p> : null}
        {headerChildren ? <div className="space-y-3">{headerChildren}</div> : null}
      </div>
      <div className={contentClassName}>{children}</div>
    </div>
  );
}

export function ShellSubsection({
  title,
  children,
  actions,
  className,
  titleClassName,
  bodyClassName,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  titleClassName?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className={cn("text-sm font-medium text-foreground", titleClassName)}>{title}</div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

export function ShellSearchSectionCard({
  title,
  description,
  children,
  icon,
  actions,
  beforeSearch,
  afterSearch,
  searchValue,
  onSearchChange,
  onSearchKeyDown,
  searchPlaceholder,
  searchClassName,
  searchInputClassName,
  searchAccessory,
  searchInputRef,
  className,
  headerClassName,
  contentClassName,
  titleClassName,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  beforeSearch?: React.ReactNode;
  afterSearch?: React.ReactNode;
  searchValue: string;
  onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSearchKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  searchPlaceholder: string;
  searchClassName?: string;
  searchInputClassName?: string;
  searchAccessory?: React.ReactNode;
  searchInputRef?: React.Ref<HTMLInputElement>;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  titleClassName?: string;
}) {
  return (
    <ShellSectionCard
      title={title}
      description={description}
      icon={icon}
      actions={actions}
      className={className}
      headerClassName={cn("gap-4 pb-4", headerClassName)}
      contentClassName={contentClassName}
      titleClassName={titleClassName}
      headerChildren={
        <>
          {beforeSearch ? <div className="space-y-3">{beforeSearch}</div> : null}
          <ShellSearchField
            value={searchValue}
            onChange={onSearchChange}
            onKeyDown={onSearchKeyDown}
            placeholder={searchPlaceholder}
            className={searchClassName}
            inputClassName={searchInputClassName}
            accessory={searchAccessory}
            inputRef={searchInputRef}
          />
          {afterSearch ? <div className="space-y-3">{afterSearch}</div> : null}
        </>
      }
    >
      {children}
    </ShellSectionCard>
  );
}

export function ShellDetailCard({
  title,
  children,
  eyebrow,
  actions,
  className,
  titleClassName,
  bodyClassName,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  titleClassName?: string;
  bodyClassName?: string;
}) {
  const hasHeader = Boolean(title || eyebrow || actions);

  return (
    <div
      className={cn(
        "rounded-lg border border-border p-4",
        className
      )}
    >
      {hasHeader ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            {eyebrow ? <div className="flex flex-wrap items-center gap-2">{eyebrow}</div> : null}
            {title ? (
              <div className={cn("text-sm font-semibold text-foreground", titleClassName)}>
                {title}
              </div>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn(hasHeader ? "mt-3" : undefined, bodyClassName)}>{children}</div>
    </div>
  );
}

export function ShellDetailLinkCard({
  href,
  title,
  children,
  eyebrow,
  actions,
  className,
  titleClassName,
  bodyClassName,
}: {
  href: string;
  title?: React.ReactNode;
  children: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  titleClassName?: string;
  bodyClassName?: string;
}) {
  const hasHeader = Boolean(title || eyebrow || actions);

  return (
    <Link
      href={href}
      className={cn(
        "block rounded-[10px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-3.5 transition-colors hover:border-primary/30 hover:bg-[color:var(--shell-control-hover)]",
        className
      )}
    >
      {hasHeader ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            {eyebrow ? <div className="flex flex-wrap items-center gap-2">{eyebrow}</div> : null}
            {title ? (
              <div className={cn("text-sm font-semibold text-foreground", titleClassName)}>
                {title}
              </div>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn(hasHeader ? "mt-3" : undefined, bodyClassName)}>{children}</div>
    </Link>
  );
}

export function ShellMonospaceValue({
  children,
  size = "sm",
  tone = "default",
  className,
}: {
  children: React.ReactNode;
  size?: "sm" | "xs";
  tone?: "default" | "muted";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "font-mono",
        size === "xs" ? "text-xs" : "text-sm",
        tone === "muted" ? "text-muted-foreground" : "text-foreground",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ShellTextList({
  items,
  className,
  itemClassName,
}: {
  items: React.ReactNode[];
  className?: string;
  itemClassName?: string;
}) {
  return (
    <div className={cn("space-y-2 text-sm leading-7 text-muted-foreground", className)}>
      {items.map((item, index) => (
        <div key={index} className={itemClassName}>
          {item}
        </div>
      ))}
    </div>
  );
}

export function ShellFactList({
  items,
  className,
  itemClassName,
  labelClassName,
  valueClassName,
  detailClassName,
}: {
  items: Array<{
    key?: React.Key;
    label: React.ReactNode;
    value: React.ReactNode;
    detail?: React.ReactNode;
  }>;
  className?: string;
  itemClassName?: string;
  labelClassName?: string;
  valueClassName?: string;
  detailClassName?: string;
}) {
  return (
    <div className={cn("divide-y divide-border rounded-lg border border-border", className)}>
      {items.map((item, index) => (
        <div
          key={item.key ?? index}
          className={cn("px-4 py-3", itemClassName)}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className={cn("text-[11px] font-medium uppercase tracking-wider text-muted-foreground", labelClassName)}>
                {item.label}
              </div>
              <div
                className={cn(
                  "mt-0.5 text-[14px] font-medium text-foreground",
                  valueClassName
                )}
              >
                {item.value}
              </div>
            </div>
          </div>
          {item.detail ? (
            <div className={cn("mt-1 text-[12px] text-muted-foreground", detailClassName)}>
              {item.detail}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function ShellFactTileGrid({
  items,
  className,
  columnsClassName = "md:grid-cols-3",
  itemClassName,
  labelClassName,
  valueClassName,
  detailClassName,
}: {
  items: Array<{
    key?: React.Key;
    label: React.ReactNode;
    value: React.ReactNode;
    detail?: React.ReactNode;
  }>;
  className?: string;
  columnsClassName?: string;
  itemClassName?: string;
  labelClassName?: string;
  valueClassName?: string;
  detailClassName?: string;
}) {
  return (
    <div className={cn("grid gap-3", columnsClassName, className)}>
      {items.map((item, index) => (
        <ShellDetailCard
          key={item.key ?? index}
          className={cn("bg-background/70", itemClassName)}
        >
          <div
            className={cn(
              "text-[11px] uppercase tracking-[0.14em] text-muted-foreground",
              labelClassName
            )}
          >
            {item.label}
          </div>
          <div className={cn("mt-2 text-sm font-semibold text-foreground", valueClassName)}>
            {item.value}
          </div>
          {item.detail ? (
            <div className={cn("mt-2 text-xs leading-6 text-muted-foreground", detailClassName)}>
              {item.detail}
            </div>
          ) : null}
        </ShellDetailCard>
      ))}
    </div>
  );
}

export function ShellPreviewListCard({
  title,
  icon,
  items,
  className,
}: {
  title: React.ReactNode;
  icon?: React.ReactNode;
  items: Array<{
    key?: React.Key;
    badge?: React.ReactNode;
    title: React.ReactNode;
    detail?: React.ReactNode;
    meta?: React.ReactNode;
  }>;
  className?: string;
}) {
  return (
    <ShellRecordSection
      title={
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          {icon ? <span className="shrink-0">{icon}</span> : null}
          <span>{title}</span>
        </div>
      }
      className={cn("bg-background/70", className)}
    >
      <div className="mt-3 space-y-2">
        {items.map((item, index) => (
          <div
            key={item.key ?? index}
            className="rounded-[8px] border border-[color:var(--shell-control-border)] bg-background/80 px-3 py-2.5"
          >
            {item.badge ? <div className="flex flex-wrap items-center gap-2">{item.badge}</div> : null}
            <div className={cn(item.badge ? "mt-2" : undefined, "text-sm text-foreground")}>
              {item.title}
            </div>
            {item.detail ? (
              <div className="mt-1 text-xs leading-6 text-muted-foreground">{item.detail}</div>
            ) : null}
            {item.meta ? (
              <div className="mt-1 text-[11px] leading-5 text-muted-foreground">{item.meta}</div>
            ) : null}
          </div>
        ))}
      </div>
    </ShellRecordSection>
  );
}

export function ShellSubtlePanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-4",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ShellStatusBanner({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  children: React.ReactNode;
  className?: string;
}) {
  // Hide warning banners — raw backend errors should not be shown to users
  if (tone === "warning") return null;

  return (
    <div
      className={cn(
        "rounded-md border px-3.5 py-2.5 text-[13px] leading-relaxed",
        tone === "danger" && "border-red-200/60 bg-red-50/50 text-red-700 dark:border-red-500/15 dark:bg-red-500/5 dark:text-red-300",
        tone === "success" && "border-emerald-200/60 bg-emerald-50/50 text-emerald-700 dark:border-emerald-500/15 dark:bg-emerald-500/5 dark:text-emerald-300",
        tone === "info" && "border-border bg-muted/30 text-muted-foreground",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ShellEmptyState({
  title,
  description,
  icon,
  action,
  className,
  centered = false,
}: {
  title?: React.ReactNode;
  description: React.ReactNode;
  icon?: React.ReactNode;
  action?: { label: string; onClick: () => void };
  className?: string;
  centered?: boolean;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center gap-3 pt-20 pb-12 text-center",
        className
      )}
    >
      {icon ? (
        <div className="mb-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
          {icon}
        </div>
      ) : (
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
          <Inbox className="h-5 w-5" />
        </div>
      )}
      {title ? (
        <div className="text-[15px] font-semibold tracking-tight text-foreground" style={{ fontFamily: "var(--font-heading, var(--font-sans))" }}>{title}</div>
      ) : null}
      <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-2 inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-[13px] font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

export function ShellSelectionEmptyState({
  title,
  description,
  icon,
  className,
  minHeightClassName = "min-h-[320px]",
}: {
  title: React.ReactNode;
  description: React.ReactNode;
  icon: React.ReactNode;
  className?: string;
  minHeightClassName?: string;
}) {
  return (
    <ShellEmptyState
      centered
      title={title}
      description={description}
      icon={
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border/70 bg-muted">
          {icon}
        </div>
      }
      className={cn("w-full", minHeightClassName, className)}
    />
  );
}

export function ShellSelectionPanel({
  panelTitle,
  panelDescription,
  title,
  description,
  icon,
  actions,
  className,
  contentClassName,
  emptyClassName,
  emptyMinHeightClassName = "min-h-[360px]",
}: {
  panelTitle: React.ReactNode;
  panelDescription?: React.ReactNode;
  title: React.ReactNode;
  description: React.ReactNode;
  icon: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  emptyClassName?: string;
  emptyMinHeightClassName?: string;
}) {
  return (
    <ShellSectionCard
      title={panelTitle}
      description={panelDescription}
      actions={actions}
      className={className}
      contentClassName={cn(
        "flex h-full min-h-[500px] flex-col items-center justify-center gap-4 py-10 text-center",
        contentClassName
      )}
    >
      <ShellSelectionEmptyState
        title={title}
        description={description}
        icon={icon}
        className={emptyClassName}
        minHeightClassName={emptyMinHeightClassName}
      />
    </ShellSectionCard>
  );
}

export function ShellLoadingState({
  title,
  description = "Loading...",
  className,
  centered = false,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  centered?: boolean;
}) {
  if (centered) {
    return (
      <div
        className={cn(
          "rounded-[12px] border border-[color:var(--shell-control-border)] bg-background/70 px-4 py-6",
          "flex flex-col items-center justify-center gap-4 text-center",
          className
        )}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border/70 bg-muted">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
        <div className="space-y-2">
          {title ? (
            <div className="text-sm font-medium text-foreground">{title}</div>
          ) : null}
          <div className="text-sm leading-6 text-muted-foreground">{description}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-[12px] border border-[color:var(--shell-control-border)] bg-background/70 px-4 py-6",
        className
      )}
    >
      <div className={cn("flex gap-3", title ? "items-start" : "items-center")}>
        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-accent" />
        <div className="space-y-1">
          {title ? (
            <div className="text-sm font-medium text-foreground">{title}</div>
          ) : null}
          <div className="text-sm leading-6 text-muted-foreground">{description}</div>
        </div>
      </div>
    </div>
  );
}

export function ShellListLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-4 transition-colors hover:border-primary/25 hover:bg-[color:var(--shell-control-hover)]",
        className
      )}
    >
      {children}
    </Link>
  );
}

export function ShellActionLink({
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
        "inline-flex items-center gap-1.5 text-[12px] font-medium text-accent transition-colors hover:text-foreground",
        className
      )}
    >
      {label}
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

export function ShellSearchField({
  value,
  onChange,
  onKeyDown,
  placeholder,
  className,
  inputClassName,
  accessory,
  inputRef,
}: {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder: string;
  className?: string;
  inputClassName?: string;
  accessory?: React.ReactNode;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <label className={cn("relative block min-w-0", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
      <input
        ref={inputRef}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={cn(
          "h-8 w-full rounded-md border border-border bg-transparent pl-9 pr-3 text-[13px] text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-ring focus:ring-2 focus:ring-ring/20",
          accessory ? "pr-20" : undefined,
          inputClassName
        )}
      />
      {accessory ? (
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
          {accessory}
        </span>
      ) : null}
    </label>
  );
}

export function ShellHeroSearchField({
  className,
  ...props
}: React.ComponentProps<typeof ShellSearchField>) {
  return <ShellSearchField {...props} className={cn("w-full max-w-md", className)} />;
}

export function ShellInputField({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-9 w-full rounded-[8px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3.5 text-[13px] text-foreground outline-none transition-[border-color,box-shadow,background-color] placeholder:text-[color:var(--shell-control-muted)] focus:border-primary/60 focus:shadow-[0_0_0_1px_var(--ring)] disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
    />
  );
}

export function ShellSelectField({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-9 w-full rounded-[8px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3.5 text-[13px] text-foreground outline-none transition-[border-color,box-shadow,background-color] focus:border-primary/60 focus:shadow-[0_0_0_1px_var(--ring)] disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
    >
      {children}
    </select>
  );
}

export function ShellKeyboardHint({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-[4px] border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-[0_1px_0_1px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_0_1px_rgba(255,255,255,0.04)]",
        className
      )}
    >
      {children}
    </span>
  );
}

export function ShellShortcutCombo({
  keys,
  label,
  className,
  keyClassName,
  labelClassName,
}: {
  keys: React.ReactNode[];
  label?: React.ReactNode;
  className?: string;
  keyClassName?: string;
  labelClassName?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {keys.map((key, index) => (
        <ShellKeyboardHint
          key={`${index}:${typeof key === "string" ? key : "key"}`}
          className={keyClassName}
        >
          {key}
        </ShellKeyboardHint>
      ))}
      {label ? <span className={labelClassName}>{label}</span> : null}
    </div>
  );
}

export function ShellShortcutLegend({
  items,
  className,
  itemClassName,
  labelClassName,
}: {
  items: Array<{
    keys: React.ReactNode[];
    label: React.ReactNode;
  }>;
  className?: string;
  itemClassName?: string;
  labelClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground",
        className
      )}
    >
      {items.map((item, index) => (
        <ShellShortcutCombo
          key={`${index}:${typeof item.label === "string" ? item.label : "label"}`}
          keys={item.keys}
          label={item.label}
          className={itemClassName}
          labelClassName={labelClassName}
        />
      ))}
    </div>
  );
}

export function ShellScopeBadgeRow({
  projectId,
  intakeSessionId,
  description,
  action,
  className,
  badgeTone = "neutral",
  descriptionClassName,
}: {
  projectId?: string | null;
  intakeSessionId?: string | null;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  badgeTone?: "neutral" | "info";
  descriptionClassName?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {projectId ? <Badge tone={badgeTone}>project {projectId}</Badge> : null}
      {intakeSessionId ? <Badge tone="info">intake {intakeSessionId}</Badge> : null}
      {description ? (
        <span className={cn("text-[11px] text-muted-foreground", descriptionClassName)}>
          {description}
        </span>
      ) : null}
      {action}
    </div>
  );
}

export function ShellInlineStatus({
  label,
  icon,
  busy = false,
  className,
}: {
  label: React.ReactNode;
  icon?: React.ReactNode;
  busy?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex items-center gap-2 text-sm text-muted-foreground", className)}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin text-accent" /> : icon}
      <span>{label}</span>
    </div>
  );
}

export function ShellActionStateLabel({
  busy,
  idleLabel,
  busyLabel = "Working...",
  icon,
  spinnerClassName,
}: {
  busy: boolean;
  idleLabel: React.ReactNode;
  busyLabel?: React.ReactNode;
  icon?: React.ReactNode;
  spinnerClassName?: string;
}) {
  return (
    <>
      {busy ? (
        <Loader2 className={cn("h-4 w-4 animate-spin", spinnerClassName)} />
      ) : (
        icon
      )}
      <span>{busy ? busyLabel : idleLabel}</span>
    </>
  );
}

export function ShellPillCount({
  count,
  active = false,
  className,
}: {
  count: React.ReactNode;
  active?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 text-[10px] leading-none",
        active
          ? "bg-foreground/10 text-foreground"
          : "bg-[color:var(--shell-panel-muted)] text-[color:var(--shell-control-muted)]",
        className
      )}
    >
      {count}
    </span>
  );
}

export function ShellPillButton({
  tone = "outline",
  active = false,
  compact = false,
  className,
  children,
  size,
  variant,
  ...props
}: React.ComponentProps<typeof Button> & {
  tone?: "primary" | "outline" | "ghost";
  active?: boolean;
  compact?: boolean;
}) {
  const resolvedVariant =
    variant ?? (tone === "primary" ? "default" : tone === "ghost" ? "ghost" : "outline");

  return (
    <Button
      {...props}
      size={size ?? "sm"}
      variant={resolvedVariant}
      className={cn(
        compact
          ? "h-7 rounded-[8px] px-3 text-[11px] shadow-none"
          : "h-8 rounded-full px-3 text-[11px] shadow-none",
        tone === "primary" ? "bg-foreground text-background hover:bg-foreground/90" : undefined,
        active && tone !== "primary"
          ? "border-primary/35 bg-[color:var(--shell-nav-active)] text-foreground hover:bg-[color:var(--shell-nav-active)]"
          : undefined,
        className
      )}
    >
      {children}
    </Button>
  );
}

export function ShellRefreshButton({
  busy = false,
  label = "Refresh snapshot",
  icon,
  iconClassName,
  compact = false,
  disabled,
  ...props
}: Omit<React.ComponentProps<typeof ShellPillButton>, "children" | "tone"> & {
  busy?: boolean;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  iconClassName?: string;
}) {
  return (
    <ShellPillButton
      {...props}
      tone="outline"
      compact={compact}
      disabled={disabled || busy}
    >
      <ShellActionStateLabel
        busy={busy}
        idleLabel={label}
        busyLabel={label}
        icon={
          icon ?? (
            <RefreshCcw
              className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4", iconClassName)}
            />
          )
        }
      />
    </ShellPillButton>
  );
}

export function ShellToolbarSurface({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[10px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)]/95 p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ShellToolbarValue({
  label,
  children,
  className,
  labelClassName,
  valueClassName,
}: {
  label?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
}) {
  return (
    <ShellToolbarSurface className={className}>
      {label ? (
        <div
          className={cn(
            "text-xs uppercase tracking-[0.14em] text-muted-foreground",
            labelClassName
          )}
        >
          {label}
        </div>
      ) : null}
      <ShellMonospaceValue className={cn(label ? "mt-2" : undefined, valueClassName)}>
        {children}
      </ShellMonospaceValue>
    </ShellToolbarSurface>
  );
}

export function ShellCodeBlock({
  children,
  className,
  codeClassName,
}: {
  children: React.ReactNode;
  className?: string;
  codeClassName?: string;
}) {
  return (
    <ShellToolbarSurface
      className={cn("mt-3 bg-[color:var(--shell-panel-muted)]/36", className)}
    >
      <code
        className={cn(
          "block overflow-x-auto whitespace-pre-wrap break-all font-mono text-[12px] leading-6 text-foreground",
          codeClassName
        )}
      >
        {children}
      </code>
    </ShellToolbarSurface>
  );
}

export function ShellQueueSectionCard({
  title,
  actions,
  searchValue,
  onSearchChange,
  onSearchKeyDown,
  searchPlaceholder,
  searchClassName,
  searchInputClassName,
  searchAccessory,
  searchInputRef,
  hint,
  summary,
  chips,
  children,
  className,
  contentClassName,
  toolbarClassName,
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
  searchValue: string;
  onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSearchKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  searchPlaceholder: string;
  searchClassName?: string;
  searchInputClassName?: string;
  searchAccessory?: React.ReactNode;
  searchInputRef?: React.Ref<HTMLInputElement>;
  hint?: React.ReactNode;
  summary?: React.ReactNode;
  chips?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  toolbarClassName?: string;
}) {
  return (
    <ShellSectionCard
      title={title}
      actions={actions}
      className={className}
      contentClassName={cn("space-y-4 pt-0", contentClassName)}
    >
      <ShellToolbarSurface className={toolbarClassName}>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <ShellSearchField
              value={searchValue}
              onChange={onSearchChange}
              onKeyDown={onSearchKeyDown}
              placeholder={searchPlaceholder}
              className={cn("w-full lg:max-w-[520px]", searchClassName)}
              inputClassName={searchInputClassName}
              accessory={searchAccessory}
              inputRef={searchInputRef}
            />
            {hint || summary ? (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                {hint ? <ShellKeyboardHint>{hint}</ShellKeyboardHint> : null}
                {summary ? <span>{summary}</span> : null}
              </div>
            ) : null}
          </div>
          {chips ? <div className="flex flex-wrap gap-2">{chips}</div> : null}
        </div>
      </ShellToolbarSurface>
      {children}
    </ShellSectionCard>
  );
}

type ShellActionLinkCardItem = {
  href: string;
  label: string;
  key?: string;
};

export function ShellActionLinkCard({
  title,
  description,
  items,
  className,
  contentClassName,
}: {
  title: string;
  description?: React.ReactNode;
  items: ShellActionLinkCardItem[];
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className={cn("space-y-3", contentClassName)}>
        {items.map((item) => (
          <ShellActionLink
            key={item.key ?? `${item.href}:${item.label}`}
            href={item.href}
            label={item.label}
          />
        ))}
      </CardContent>
    </Card>
  );
}

type ShellLinkTileGridItem = {
  href: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  key?: string;
};

export function ShellLinkTileGrid({
  items,
  className,
  linkClassName,
}: {
  items: ShellLinkTileGridItem[];
  className?: string;
  linkClassName?: string;
}) {
  return (
    <section className={cn("grid gap-4 md:grid-cols-3", className)}>
      {items.map((item) => (
        <ShellListLink
          key={item.key ?? `${item.href}:${String(item.label)}`}
          href={item.href}
          className={cn("p-4", linkClassName)}
        >
          <div className="flex items-center gap-2">
            {item.icon}
            {item.label}
          </div>
        </ShellListLink>
      ))}
    </section>
  );
}

type ShellSummaryItem = {
  key?: string;
  icon?: React.ReactNode;
  label?: React.ReactNode;
  count?: React.ReactNode;
  detail: React.ReactNode;
  panelClassName?: string;
};

export function ShellSummaryRow({
  icon,
  label,
  count,
  detail,
  panelClassName,
}: ShellSummaryItem) {
  return (
    <ShellSubtlePanel
      className={cn(
        "flex items-start gap-3 p-3 text-sm leading-7 text-muted-foreground",
        panelClassName
      )}
    >
      {icon ? (
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-muted">
          {icon}
        </div>
      ) : null}
      <div className="min-w-0">
        {label ? (
          <div className="font-medium text-foreground">
            {label}
            {count !== undefined ? (
              <>
                {" "}
                <span className="text-muted-foreground">({count})</span>
              </>
            ) : null}
          </div>
        ) : null}
        <div className={label ? "mt-1" : undefined}>{detail}</div>
      </div>
    </ShellSubtlePanel>
  );
}

export function ShellSummaryCard({
  title,
  description,
  items,
  className,
  contentClassName,
}: {
  title: string;
  description?: React.ReactNode;
  items: ShellSummaryItem[];
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className={cn("space-y-3", contentClassName)}>
        {items.map((item, index) => (
          <ShellSummaryRow key={item.key ?? `${item.label ?? "item"}:${index}`} {...item} />
        ))}
      </CardContent>
    </Card>
  );
}

type ShellSectionSummaryItem = {
  key?: string;
  title: React.ReactNode;
  body: React.ReactNode;
  className?: string;
};

export function ShellSectionSummaryCard({
  title,
  description,
  items,
  className,
  contentClassName,
}: {
  title: string;
  description?: React.ReactNode;
  items: ShellSectionSummaryItem[];
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className={cn("space-y-3 text-sm leading-7 text-muted-foreground", contentClassName)}>
        {items.map((item, index) => (
          <ShellRecordSection
            key={item.key ?? `${String(item.title)}:${index}`}
            title={item.title}
            className={item.className}
          >
            {item.body}
          </ShellRecordSection>
        ))}
      </CardContent>
    </Card>
  );
}

export function ShellSelectionSummary({
  title = "Selection snapshot",
  summary,
  detail,
  className,
}: {
  title?: React.ReactNode;
  summary: React.ReactNode;
  detail?: React.ReactNode;
  className?: string;
}) {
  return (
    <ShellRecordSection title={title} className={className}>
      <div>{summary}</div>
      {detail ? <div className="mt-1.5">{detail}</div> : null}
    </ShellRecordSection>
  );
}

export function ShellRefreshStateCard({
  description,
  busy,
  busyLabel,
  idleLabel,
  icon,
  intervalSeconds,
  guidance,
  statusTitle = "Queue refresh",
  className,
  contentClassName,
}: {
  description: React.ReactNode;
  busy: boolean;
  busyLabel: string;
  idleLabel: string;
  icon?: React.ReactNode;
  intervalSeconds: number;
  guidance: React.ReactNode;
  statusTitle?: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <ShellSectionCard
      title="Refresh state"
      description={description}
      className={className}
      contentClassName={cn("space-y-3 text-sm text-muted-foreground", contentClassName)}
    >
      <ShellRecordSection title={statusTitle} className="bg-background/70">
        <div className="space-y-2">
          <ShellInlineStatus
            busy={busy}
            icon={icon}
            label={busy ? busyLabel : idleLabel}
          />
          <div>
            Auto-refresh interval {intervalSeconds}s for the current operator profile.
          </div>
          <div>{guidance}</div>
        </div>
      </ShellRecordSection>
    </ShellSectionCard>
  );
}

export function ShellComposerTextarea({
  value,
  onChange,
  onKeyDown,
  placeholder,
  className,
  textareaRef,
  disabled,
}: {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  className?: string;
  textareaRef?: React.Ref<HTMLTextAreaElement>;
  disabled?: boolean;
}) {
  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(
        "min-h-[132px] w-full rounded-[10px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3.5 py-3 text-[13px] leading-7 text-foreground outline-none transition-[border-color,box-shadow,background-color] placeholder:text-[color:var(--shell-control-muted)] focus:border-primary/60 focus:shadow-[0_0_0_1px_var(--ring)] disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
    />
  );
}

export function ShellOptionButton({
  title,
  description,
  badges,
  trailing,
  onClick,
  onMouseEnter,
  disabled,
  active,
  buttonRef,
  className,
}: {
  title: React.ReactNode;
  description: React.ReactNode;
  badges?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick: () => void;
  onMouseEnter?: () => void;
  disabled?: boolean;
  active?: boolean;
  buttonRef?: React.Ref<HTMLButtonElement>;
  className?: string;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      disabled={disabled}
      data-command-selected={active ? "true" : "false"}
      className={cn(
        "w-full rounded-[10px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3.5 py-3 text-left transition-colors hover:border-primary/25 hover:bg-[color:var(--shell-control-hover)] disabled:cursor-not-allowed disabled:opacity-60",
        active
          ? "border-primary/35 bg-[color:var(--shell-nav-active)]"
          : undefined,
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {badges ? <div className="mb-2 flex flex-wrap gap-1.5">{badges}</div> : null}
          <div className="text-[13px] font-medium leading-5 text-foreground">{title}</div>
          <div className="mt-1.5 text-[13px] leading-6 text-muted-foreground">{description}</div>
        </div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
    </button>
  );
}

const filterChipClassName =
  "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium transition-all duration-150";

const filterChipCountClassName =
  "rounded px-1.5 py-0.5 text-[11px] tabular-nums leading-none";

export function ShellFilterChipLink({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count?: number;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        filterChipClassName,
        active
          ? "border-foreground/15 bg-foreground/[0.06] text-foreground"
          : "border-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      )}
    >
      <span>{label}</span>
      {typeof count === "number" ? (
        <span
          className={cn(
            filterChipCountClassName,
            active
              ? "bg-foreground/10 text-foreground"
              : "bg-muted text-muted-foreground"
          )}
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}

export function ShellFilterChipButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        filterChipClassName,
        active
          ? "border-foreground/15 bg-foreground/[0.06] text-foreground"
          : "border-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      )}
    >
      <span>{label}</span>
      {typeof count === "number" ? (
        <span
          className={cn(
            filterChipCountClassName,
            active
              ? "bg-foreground/10 text-foreground"
              : "bg-muted text-muted-foreground"
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
