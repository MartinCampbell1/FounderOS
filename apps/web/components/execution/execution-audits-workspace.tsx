"use client";

import type { ShellPreferences } from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import {
  AlertTriangle,
  Clock3,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  ShellEmptyState,
  ShellHero,
  ShellHeroSearchField,
  ShellListLink,
  ShellMetricCard,
  ShellPage,
  ShellPillButton,
  ShellRefreshButton,
  ShellSectionCard,
  ShellStatusBanner,
} from "@/components/shell/shell-screen-primitives";
import type {
  ShellExecutionAuditListRecord,
  ShellExecutionAuditsSnapshot,
} from "@/lib/execution-audits-model";
import { emptyShellExecutionAuditsSnapshot } from "@/lib/execution-audits-model";
import {
  buildExecutionAuditScopeHref,
  type ShellRouteScope,
} from "@/lib/route-scope";
import {
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import { fetchShellExecutionAuditsSnapshot } from "@/lib/shell-snapshot-client";
import { useShellManualRefresh } from "@/lib/use-shell-manual-refresh";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";

const EMPTY_AUDITS_SNAPSHOT = emptyShellExecutionAuditsSnapshot();

type AuditFilter = "all" | "open" | "resolved";

function statusTone(status: string) {
  if (status === "open") return "danger" as const;
  if (status === "resolved") return "success" as const;
  return "neutral" as const;
}

function actionTone(action: string) {
  if (action === "quarantine" || action === "escalate") return "danger" as const;
  if (action === "retry") return "warning" as const;
  return "neutral" as const;
}

function relativeTime(value?: string | null, fallback = "No timestamp yet") {
  if (!value) return fallback;

  const diffMs = Math.max(0, Date.now() - new Date(value).getTime());
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return `${Math.floor(diffHours / 24)}d ago`;
}

function sanitizeAuditError(error: string | null) {
  if (!error) return null;

  const normalized = error.toLowerCase();
  if (
    normalized.includes("fetch failed") ||
    normalized.includes("timed out") ||
    normalized.includes("network")
  ) {
    return "Autopilot audit data is unavailable right now. Check the upstream connection in Settings, then refresh this audit queue.";
  }

  return error;
}

function matchesQuery(audit: ShellExecutionAuditListRecord, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    audit.id,
    audit.project_id,
    audit.orchestrator_session_id,
    audit.source_kind,
    audit.source_name,
    audit.source_id,
    audit.action,
    audit.summary,
    audit.status,
    audit.runtime_agent_ids.join(" "),
    audit.findings.join(" "),
  ].some((field) => field.toLowerCase().includes(normalized));
}

function resolutionOutcome(audit: ShellExecutionAuditListRecord) {
  const value = audit.resolution?.outcome;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function AuditCard({
  audit,
  routeScope,
}: {
  audit: ShellExecutionAuditListRecord;
  routeScope: ShellRouteScope;
}) {
  const href = buildExecutionAuditScopeHref(audit.id, routeScope);
  const outcome = resolutionOutcome(audit);

  return (
    <ShellListLink href={href} className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="truncate text-[14px] font-medium text-foreground">
            {audit.summary || audit.source_name || audit.id}
          </div>
          <div className="text-[12px] leading-5 text-muted-foreground">
            {audit.source_kind}
            {audit.source_name ? ` · ${audit.source_name}` : ""}
            {audit.source_id ? ` · ${audit.source_id}` : ""}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(audit.status)}>{audit.status}</Badge>
          <Badge tone={actionTone(audit.action)}>{audit.action}</Badge>
          {outcome ? <Badge tone="success">{outcome}</Badge> : null}
        </div>
      </div>

      <div className="grid gap-2 text-[12px] text-muted-foreground md:grid-cols-2">
        <span>{audit.findings.length} findings</span>
        <span>{audit.runtime_agent_ids.length} runtime agents</span>
        <span>updated {relativeTime(audit.updated_at)}</span>
        <span>
          {audit.linkedRunIds.length > 0
            ? `${audit.linkedRunIds.length} linked action runs`
            : "No linked action runs"}
        </span>
        {audit.project_id ? (
          <span className="md:col-span-2">
            Project {audit.project_id} · drill into the audit detail for the blocked artifact and release path.
          </span>
        ) : null}
        {audit.orchestrator_session_id ? (
          <span className="md:col-span-2 break-all">
            Session {audit.orchestrator_session_id}
          </span>
        ) : null}
      </div>

      {audit.findings.length > 0 ? (
        <div className="space-y-1 text-[12px] leading-5 text-muted-foreground">
          {audit.findings.slice(0, 2).map((finding) => (
            <div key={finding} className="line-clamp-2">
              {finding}
            </div>
          ))}
        </div>
      ) : null}
    </ShellListLink>
  );
}

function AuditSection({
  title,
  description,
  audits,
  routeScope,
}: {
  title: string;
  description: string;
  audits: ShellExecutionAuditListRecord[];
  routeScope: ShellRouteScope;
}) {
  if (audits.length === 0) {
    return null;
  }

  return (
    <ShellSectionCard
      title={`${title} (${audits.length})`}
      description={description}
      contentClassName="grid gap-3"
    >
      {audits.map((audit) => (
        <AuditCard key={audit.id} audit={audit} routeScope={routeScope} />
      ))}
    </ShellSectionCard>
  );
}

export function ExecutionAuditsWorkspace({
  initialPreferences,
  initialSnapshot,
  routeScope = { projectId: "", intakeSessionId: "" },
}: {
  initialPreferences?: ShellPreferences;
  initialSnapshot?: ShellExecutionAuditsSnapshot | null;
  routeScope?: ShellRouteScope;
}) {
  const { preferences } = useShellPreferences(initialPreferences);
  const pollIntervalMs = getShellPollInterval(
    "execution_review",
    preferences.refreshProfile
  );
  const { isRefreshing, refresh, refreshNonce } = useShellManualRefresh();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AuditFilter>("all");

  const loadSnapshot = useCallback(() => fetchShellExecutionAuditsSnapshot(), []);
  const selectLoadState = useCallback(
    (snapshot: ShellExecutionAuditsSnapshot) => snapshot.auditsLoadState,
    []
  );

  const { loadState, snapshot } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_AUDITS_SNAPSHOT,
    initialSnapshot,
    refreshNonce,
    pollIntervalMs,
    loadSnapshot,
    selectLoadState,
  });

  const error = useMemo(
    () => sanitizeAuditError(snapshot.auditsError),
    [snapshot.auditsError]
  );

  const filteredAudits = useMemo(
    () =>
      snapshot.audits.filter((audit) => {
        if (!matchesQuery(audit, query)) {
          return false;
        }
        if (filter === "open") {
          return audit.open;
        }
        if (filter === "resolved") {
          return !audit.open;
        }
        return true;
      }),
    [filter, query, snapshot.audits]
  );

  const openAudits = useMemo(
    () => filteredAudits.filter((audit) => audit.open),
    [filteredAudits]
  );
  const resolvedAudits = useMemo(
    () => filteredAudits.filter((audit) => !audit.open),
    [filteredAudits]
  );

  const impactedProjectCount = useMemo(
    () => new Set(snapshot.audits.map((audit) => audit.project_id).filter(Boolean)).size,
    [snapshot.audits]
  );
  const openCount = useMemo(
    () => snapshot.audits.filter((audit) => audit.open).length,
    [snapshot.audits]
  );
  const resolvedCount = snapshot.audits.length - openCount;

  return (
    <ShellPage>
      <ShellHero
        title="Audits"
        description="Shadow-audit quarantines surfaced from execution-plane action runs, with one queue for blocked runtime artifacts and explicit review drill-ins."
        meta={
          <>
            <span>{snapshot.audits.length} tracked audits</span>
            <span>{openCount} still blocking downstream use</span>
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

      {error ? <ShellStatusBanner tone="danger">{error}</ShellStatusBanner> : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4">
          <ShellMetricCard
            label="Open quarantines"
            value={String(openCount)}
            detail="Audits still blocking a runtime artifact or downstream handoff."
          />
        </div>
        <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4">
          <ShellMetricCard
            label="Resolved"
            value={String(resolvedCount)}
            detail="Audits already reviewed and explicitly released or closed."
          />
        </div>
        <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4">
          <ShellMetricCard
            label="Projects impacted"
            value={String(impactedProjectCount)}
            detail="Unique execution projects touched by audit quarantine pressure."
          />
        </div>
        <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4">
          <ShellMetricCard
            label="Findings surfaced"
            value={String(snapshot.audits.reduce((sum, audit) => sum + audit.findings.length, 0))}
            detail="Individual audit findings available for operator review."
          />
        </div>
      </div>

      <ShellSectionCard
        title="Audit queue"
        description="Search by project, session, source, finding, or audit id, then drill into the blocked artifact and resolution context."
        contentClassName="space-y-4"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <ShellHeroSearchField
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by project, source, session, finding, or audit id..."
          />
          <div className="flex flex-wrap gap-2">
            {([
              {
                key: "all",
                label: "All",
                icon: <ShieldAlert className="h-3.5 w-3.5" />,
              },
              {
                key: "open",
                label: "Open",
                icon: <AlertTriangle className="h-3.5 w-3.5" />,
              },
              {
                key: "resolved",
                label: "Resolved",
                icon: <ShieldCheck className="h-3.5 w-3.5" />,
              },
            ] as const).map((option) => (
              <ShellPillButton
                key={option.key}
                type="button"
                tone="outline"
                compact
                active={filter === option.key}
                onClick={() => setFilter(option.key)}
              >
                <span className="flex items-center gap-1.5">
                  {option.icon}
                  {option.label}
                </span>
              </ShellPillButton>
            ))}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <AuditSection
              title="Open quarantines"
              description="Runtime outputs that are still blocked from downstream use and need explicit operator review."
              audits={openAudits}
              routeScope={routeScope}
            />
          </div>
          <div className="space-y-4">
            <AuditSection
              title="Resolved audits"
              description="Previously quarantined outputs that were explicitly reviewed and released or closed."
              audits={resolvedAudits}
              routeScope={routeScope}
            />
          </div>
        </div>

        {filteredAudits.length === 0 && loadState !== "loading" ? (
          <ShellEmptyState
            centered
            icon={<ShieldAlert className="h-5 w-5" />}
            title={snapshot.audits.length > 0 ? "No matching audits" : "No shadow audits yet"}
            description={
              snapshot.audits.length > 0
                ? "No shadow-audit records match the current search and filter."
                : error
                  ? "Audit data will reappear once Autopilot reconnects."
                  : "Shadow audits show up here when runtime outputs are quarantined before downstream use."
            }
            action={
              snapshot.audits.length > 0
                ? {
                    label: "Clear filters",
                    onClick: () => {
                      setFilter("all");
                      setQuery("");
                    },
                  }
                : undefined
            }
            className="py-12"
          />
        ) : null}
      </ShellSectionCard>

      <ShellSectionCard
        title="How to read this"
        description="Audits are not generic warnings; they are pre-consumption quarantines around runtime artifacts that would otherwise flow downstream."
        contentClassName="grid gap-3 md:grid-cols-3"
      >
        <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-4">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-foreground">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Open
          </div>
          <p className="text-[12px] leading-6 text-muted-foreground">
            Open audits are actively blocking a runtime artifact or handoff path until someone reviews the quarantined content.
          </p>
        </div>
        <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-4">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-foreground">
            <Clock3 className="h-4 w-4 text-sky-400" />
            Linked runs
          </div>
          <p className="text-[12px] leading-6 text-muted-foreground">
            Each audit stays tied to one or more execution-plane action runs so operators can trace where the quarantined output came from.
          </p>
        </div>
        <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-4">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Resolved
          </div>
          <p className="text-[12px] leading-6 text-muted-foreground">
            Resolution is explicit. The detail route keeps the review note and outcome visible instead of silently clearing the quarantine.
          </p>
        </div>
      </ShellSectionCard>
    </ShellPage>
  );
}
