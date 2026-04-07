"use client";

import type {
  ExecutionBriefHandoff,
  ShellPreferences,
} from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import { ArrowRightLeft, Clock3, FolderKanban, Rocket } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import {
  ShellEmptyState,
  ShellHero,
  ShellHeroSearchField,
  ShellListLink,
  ShellLoadingState,
  ShellMetricCard,
  ShellPage,
  ShellRefreshButton,
  ShellSectionCard,
  ShellStatusBanner,
} from "@/components/shell/shell-screen-primitives";
import type { ShellExecutionHandoffsSnapshot } from "@/lib/execution-handoffs-model";
import { emptyShellExecutionHandoffsSnapshot } from "@/lib/execution-handoffs-model";
import {
  buildExecutionHandoffScopeHref,
  buildInboxScopeHref,
  type ShellRouteScope,
} from "@/lib/route-scope";
import {
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import { fetchShellExecutionHandoffsSnapshot } from "@/lib/shell-snapshot-client";
import { useShellManualRefresh } from "@/lib/use-shell-manual-refresh";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";

const EMPTY_HANDOFFS_SNAPSHOT = emptyShellExecutionHandoffsSnapshot();

function briefTitle(brief: Record<string, unknown>) {
  if (typeof brief.title === "string" && brief.title.trim().length > 0) {
    return brief.title;
  }
  return "Untitled brief";
}

function launchIntentTone(intent: string | null | undefined) {
  if (intent === "launch") return "success" as const;
  if (intent === "create") return "info" as const;
  return "neutral" as const;
}

function launchIntentLabel(intent: string | null | undefined) {
  if (intent === "launch") return "Launch";
  if (intent === "create") return "Create";
  return "Draft";
}

function formatRelativeTime(value: string) {
  const diffMs = Math.max(0, Date.now() - new Date(value).getTime());
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return `${Math.floor(diffHours / 24)}d ago`;
}

function formatExpiry(expiresAt: string) {
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  if (diffMs <= 0) return "expired";

  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 60) return `expires in ${Math.max(1, diffMinutes)}m`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `expires in ${diffHours}h`;

  return `expires in ${Math.floor(diffHours / 24)}d`;
}

function expiresSoon(expiresAt: string) {
  return new Date(expiresAt).getTime() - Date.now() <= 1000 * 60 * 10;
}

function countLaunchIntent(
  handoffs: ExecutionBriefHandoff[],
  intent: "launch" | "create"
) {
  return handoffs.filter((handoff) => handoff.launch_intent === intent).length;
}

function matchesQuery(handoff: ExecutionBriefHandoff, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const tags = Array.isArray(handoff.brief.tags)
    ? handoff.brief.tags
        .filter((tag): tag is string => typeof tag === "string")
        .join(" ")
    : "";

  return [
    briefTitle(handoff.brief),
    handoff.source_session_id ?? "",
    handoff.source_plane,
    handoff.default_project_name ?? "",
    handoff.recommended_launch_preset_id ?? "",
    tags,
  ].some((field) => field.toLowerCase().includes(normalized));
}

function HandoffCard({
  handoff,
  routeScope,
}: {
  handoff: ExecutionBriefHandoff;
  routeScope: ShellRouteScope;
}) {
  const title = briefTitle(handoff.brief);
  const href = buildExecutionHandoffScopeHref(handoff.id, routeScope);
  const briefTags = Array.isArray(handoff.brief.tags)
    ? handoff.brief.tags.filter((tag): tag is string => typeof tag === "string")
    : [];
  const expiryLabel = formatExpiry(handoff.expires_at);

  return (
    <ShellListLink href={href} className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="truncate text-[14px] font-medium text-foreground">{title}</div>
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
            <span>Source: {handoff.source_session_id ?? handoff.source_plane}</span>
            <span>&middot;</span>
            <span>Created {formatRelativeTime(handoff.created_at)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={launchIntentTone(handoff.launch_intent)}>
            {launchIntentLabel(handoff.launch_intent)}
          </Badge>
          <Badge tone={expiresSoon(handoff.expires_at) ? "warning" : "neutral"}>
            {expiryLabel}
          </Badge>
        </div>
      </div>

      <div className="grid gap-2 text-[12px] text-muted-foreground md:grid-cols-2">
        <span>
          Project draft: {handoff.default_project_name ?? briefTitle(handoff.brief)}
        </span>
        <span>
          Preset: {handoff.recommended_launch_preset_id ?? "not specified"}
        </span>
      </div>

      {briefTags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {briefTags.slice(0, 4).map((tag) => (
            <Badge key={tag} tone="neutral">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}
    </ShellListLink>
  );
}

export function ExecutionHandoffsWorkspace({
  initialPreferences,
  initialSnapshot,
  routeScope = { projectId: "", intakeSessionId: "" },
}: {
  initialPreferences?: ShellPreferences;
  initialSnapshot?: ShellExecutionHandoffsSnapshot | null;
  routeScope?: ShellRouteScope;
}) {
  const { preferences } = useShellPreferences(initialPreferences);
  const pollIntervalMs = getShellPollInterval(
    "execution_projects",
    preferences.refreshProfile
  );
  const { isRefreshing, refresh, refreshNonce } = useShellManualRefresh();
  const [query, setQuery] = useState("");

  const loadSnapshot = useCallback(() => fetchShellExecutionHandoffsSnapshot(), []);
  const selectLoadState = useCallback(
    (snapshot: ShellExecutionHandoffsSnapshot) => snapshot.handoffsLoadState,
    []
  );

  const { loadState, snapshot } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_HANDOFFS_SNAPSHOT,
    initialSnapshot,
    refreshNonce,
    pollIntervalMs,
    loadSnapshot,
    selectLoadState,
  });

  const filteredHandoffs = useMemo(
    () => snapshot.handoffs.filter((handoff) => matchesQuery(handoff, query)),
    [query, snapshot.handoffs]
  );

  const expiringSoonCount = useMemo(
    () => snapshot.handoffs.filter((handoff) => expiresSoon(handoff.expires_at)).length,
    [snapshot.handoffs]
  );

  return (
    <ShellPage>
      <ShellHero
        title="Handoffs"
        description="Discovery briefs that are ready to cross the shell boundary into execution."
        meta={
          <>
            <span>{snapshot.handoffs.length} active brief{snapshot.handoffs.length === 1 ? "" : "s"}</span>
            <span>Store-backed queue with auto-expiring handoffs</span>
          </>
        }
        actions={
          <ShellRefreshButton
            busy={isRefreshing || loadState === "loading"}
            onClick={refresh}
            compact
          />
        }
      />

      {snapshot.handoffsError ? (
        <ShellStatusBanner tone="danger">{snapshot.handoffsError}</ShellStatusBanner>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4">
          <ShellMetricCard
            label="Active handoffs"
            value={String(snapshot.handoffs.length)}
            detail="Briefs available for project creation or create-and-launch."
          />
        </div>
        <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4">
          <ShellMetricCard
            label="Launch-ready"
            value={String(countLaunchIntent(snapshot.handoffs, "launch"))}
            detail="Handoffs asking execution to start immediately."
          />
        </div>
        <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4">
          <ShellMetricCard
            label="Expiring soon"
            value={String(expiringSoonCount)}
            detail="Briefs with less than ten minutes left in the local handoff store."
          />
        </div>
      </div>

      <ShellSectionCard
        title="Execution queue"
        description="Review the brief title, source context, and launch intent before opening a handoff."
        contentClassName="space-y-3"
      >
        <ShellHeroSearchField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search handoffs by title, source, project name, or tag..."
        />

        {loadState === "loading" && snapshot.handoffs.length === 0 ? (
          <ShellLoadingState description="Loading handoff queue..." />
        ) : null}

        {filteredHandoffs.length > 0 ? (
          <div className="grid gap-3">
            {filteredHandoffs.map((handoff) => (
              <HandoffCard
                key={handoff.id}
                handoff={handoff}
                routeScope={routeScope}
              />
            ))}
          </div>
        ) : null}

        {loadState !== "loading" && filteredHandoffs.length === 0 ? (
          <ShellEmptyState
            centered
            icon={<ArrowRightLeft className="h-5 w-5" />}
            title={snapshot.handoffs.length > 0 ? "No matching handoffs" : "No active handoffs"}
            description={
              snapshot.handoffs.length > 0 ? (
                "No handoffs match the current search."
              ) : (
                <>
                  Handoffs appear here when discovery opens an execution brief. Until then, triage
                  candidates in{" "}
                  <Link
                    href={buildInboxScopeHref(routeScope)}
                    className="font-medium text-accent hover:text-foreground"
                  >
                    Inbox
                  </Link>
                  .
                </>
              )
            }
            action={
              snapshot.handoffs.length > 0
                ? {
                    label: "Clear search",
                    onClick: () => setQuery(""),
                  }
                : undefined
            }
            className="py-12"
          />
        ) : null}
      </ShellSectionCard>

      <ShellSectionCard
        title="Operator notes"
        description="Handoffs stay lightweight on purpose so execution keeps the authoritative launch flow."
        contentClassName="grid gap-3 md:grid-cols-3"
      >
        <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-4">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-foreground">
            <Rocket className="h-4 w-4 text-emerald-400" />
            Launch intent
          </div>
          <p className="text-[12px] leading-6 text-muted-foreground">
            `Launch` handoffs can create and start a project immediately. `Create` handoffs stage
            the project without starting the runtime.
          </p>
        </div>
        <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-4">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-foreground">
            <Clock3 className="h-4 w-4 text-amber-400" />
            Store expiry
          </div>
          <p className="text-[12px] leading-6 text-muted-foreground">
            Handoffs expire automatically after thirty minutes, so open or copy the brief while it
            is still active in the local queue.
          </p>
        </div>
        <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-4">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-foreground">
            <FolderKanban className="h-4 w-4 text-sky-400" />
            Route continuity
          </div>
          <p className="text-[12px] leading-6 text-muted-foreground">
            Each handoff keeps its shell scope, so returning to the execution queue preserves the
            same project and intake context.
          </p>
        </div>
      </ShellSectionCard>
    </ShellPage>
  );
}
