"use client";

import type { ShellPreferences } from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import { cn } from "@founderos/ui/lib/utils";
import {
  CheckCheck,
  Inbox,
  ShieldAlert,
  SkipForward,
  X,
} from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { useCallback, useMemo, useState } from "react";

import {
  ShellActionStateLabel,
  ShellEmptyState,
  ShellFilterChipButton,
  ShellHero,
  ShellPage,
  ShellSearchSectionCard,
  ShellPillButton,
  ShellStatusBanner,
} from "@/components/shell/shell-screen-primitives";
import {
  ShellRecordActionBar,
  ShellRecordMeta,
} from "@/components/shell/shell-record-primitives";
import { SkeletonList } from "@/components/shell/shell-skeleton";
import {
  attentionPlaneTone,
  buildShellAttentionRecords,
  matchesAttentionRouteScope,
  type ApprovalAttentionRecord as ApprovalQueueRecord,
  type DiscoveryAttentionRecord as DiscoveryQueueRecord,
  type IssueAttentionRecord as IssueQueueRecord,
  type RuntimeAttentionRecord as RuntimeQueueRecord,
  type ShellAttentionRecord as InboxRecord,
} from "@/lib/attention-records";
import {
  runAttentionAction,
  type AttentionActionResult,
} from "@/lib/attention-action-model";
import { fetchShellInboxSnapshot } from "@/lib/shell-snapshot-client";
import { runExecutionAttentionMutation } from "@/lib/review-execution-actions";
import { getShellPollInterval, useShellPreferences } from "@/lib/shell-preferences";
import { useShellRouteMutationRunner } from "@/lib/use-shell-route-mutation-runner";
import { useShellSnapshotRefreshNonce } from "@/lib/use-shell-snapshot-refresh-nonce";
import {
  hasShellRouteScope as hasRouteScope,
  type ShellRouteScope,
} from "@/lib/route-scope";
import {
  type ShellInboxSnapshot,
} from "@/lib/inbox";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";
import { truncate } from "@/lib/format-utils";

type QueueFilter =
  | "all"
  | "discovery"
  | "execution"
  | "issues"
  | "approvals"
  | "permissions";
type InboxRouteScope = ShellRouteScope;
type InboxMutationResult = AttentionActionResult;

function relativeTime(value?: string | null) {
  if (!value) return "";
  const ms = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function matchesFilter(record: InboxRecord, filter: QueueFilter) {
  switch (filter) {
    case "discovery":
      return record.plane === "discovery";
    case "execution":
      return record.plane === "execution";
    case "issues":
      return record.type === "issue";
    case "approvals":
      return record.type === "approval";
    case "permissions":
      return record.type === "runtime";
    default:
      return true;
  }
}

function typeBadgeLabel(record: InboxRecord) {
  switch (record.type) {
    case "discovery":
      return record.item.subject_kind || "authoring";
    case "issue":
      return "issue";
    case "approval":
      return "approval";
    case "runtime":
      return "runtime";
  }
}

function subtitleText(record: InboxRecord): string {
  switch (record.type) {
    case "discovery":
      return record.item.idea_id ? `idea_${record.item.idea_id}` : "";
    case "issue":
      return [
        record.issue.project_name,
        record.issue.severity,
      ]
        .filter(Boolean)
        .join(" \u00b7 ");
    case "approval":
      return record.approval.project_name || "";
    case "runtime":
      return record.source.project?.name || record.runtime.project_id || "";
  }
}

function recordTimestamp(record: InboxRecord): string {
  return record.sortAt;
}

function toneBorderClass(record: InboxRecord): string {
  if (record.tone === "danger") return "border-l-red-500";
  if (record.tone === "warning") return "border-l-amber-500";
  if (record.tone === "info") return "border-l-indigo-500";
  return "border-l-transparent";
}

const EMPTY_INBOX_SNAPSHOT: ShellInboxSnapshot = {
  generatedAt: "",
  discoveryFeed: {
    items: [],
    summary: {
      open_count: 0,
      resolved_count: 0,
      stale_count: 0,
      action_required_count: 0,
      kinds: {},
      subject_kinds: {},
    },
  },
  projects: [],
  intakeSessions: [],
  approvals: [],
  issues: [],
  runtimes: [],
  chains: [],
  errors: [],
  loadState: "ready",
};

function useInboxState(
  refreshNonce: number,
  initialPreferences?: ShellPreferences,
  initialSnapshot?: ShellInboxSnapshot | null
) {
  const { preferences } = useShellPreferences(initialPreferences);
  const pollInterval = getShellPollInterval("inbox", preferences.refreshProfile);
  const loadSnapshot = useCallback(() => fetchShellInboxSnapshot(), []);
  const selectLoadState = useCallback(
    (snapshot: ShellInboxSnapshot) => snapshot.loadState,
    []
  );
  const { loadState, snapshot } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_INBOX_SNAPSHOT,
    initialSnapshot,
    refreshNonce,
    pollIntervalMs: pollInterval,
    loadSnapshot,
    selectLoadState,
  });

  return {
    discoveryFeed: snapshot.discoveryFeed,
    projects: snapshot.projects,
    intakeSessions: snapshot.intakeSessions,
    approvals: snapshot.approvals,
    issues: snapshot.issues,
    runtimes: snapshot.runtimes,
    chains: snapshot.chains,
    errors: snapshot.errors,
    loadState,
  };
}

function InboxNotificationRow({
  record,
  actions,
}: {
  record: InboxRecord;
  actions: React.ReactNode;
}) {
  const isUnread = record.attention > 0;
  const time = relativeTime(recordTimestamp(record));
  const subtitle = subtitleText(record);

  return (
    <div
      className={cn(
        "group relative grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-start gap-x-2.5 border-b border-border/50 border-l-2 px-3.5 py-2.5 transition-[background-color,border-color] duration-100 hover:bg-[color:var(--shell-control-hover)]",
        toneBorderClass(record),
        record.tone === "danger" && "hover:border-l-red-400",
        record.tone === "warning" && "hover:border-l-amber-400",
        record.tone === "info" && "hover:border-l-indigo-400"
      )}
    >
      <div className="mt-1.5 flex-none">
        {isUnread ? (
          <span className="block h-2 w-2 rounded-full bg-indigo-500" />
        ) : (
          <span className="block h-2 w-2 rounded-full bg-border" />
        )}
      </div>

      <div className="flex flex-none items-center gap-1">
        <Badge tone={attentionPlaneTone(record.plane)} className="text-[10px] leading-none">
          {record.plane}
        </Badge>
        <Badge tone={record.tone} className="text-[10px] leading-none">
          {typeBadgeLabel(record)}
        </Badge>
      </div>

      <div className="min-w-0 space-y-0.5">
        <Link href={record.href} className="block">
          <span
            className={cn(
              "block truncate text-[13px] font-medium leading-5",
              isUnread ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {record.title}
          </span>
        </Link>
        {subtitle ? (
          <p className="text-[12px] leading-4 text-muted-foreground">
            {truncate(subtitle, 120)}
          </p>
        ) : null}
        <ShellRecordMeta className="gap-x-2 text-[11px] leading-4">
          <span>{record.status}</span>
          <span>{time}</span>
        </ShellRecordMeta>
      </div>

      <ShellRecordActionBar className="flex-none justify-self-end gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {actions}
      </ShellRecordActionBar>
    </div>
  );
}

function DiscoveryRowActions({
  record,
  busyActionKey,
  onAccept,
  onIgnore,
  onResolve,
}: {
  record: DiscoveryQueueRecord;
  busyActionKey: string;
  onAccept: (record: DiscoveryQueueRecord) => Promise<void>;
  onIgnore: (record: DiscoveryQueueRecord) => Promise<void>;
  onResolve: (record: DiscoveryQueueRecord) => Promise<void>;
}) {
  const acceptActionKey = `${record.key}:accept`;
  const ignoreActionKey = `${record.key}:ignore`;
  const resolveActionKey = `${record.key}:resolve`;

  return (
    <>
      {record.item.interrupt?.config.allow_accept ? (
        <ShellPillButton
          type="button"
          tone="primary"
          onClick={() => void onAccept(record)}
          disabled={busyActionKey.length > 0}
        >
          <ShellActionStateLabel
            busy={busyActionKey === acceptActionKey}
            idleLabel="Accept"
            busyLabel="Accept"
            icon={<CheckCheck className="h-3.5 w-3.5" />}
          />
        </ShellPillButton>
      ) : null}
      {record.item.interrupt?.config.allow_ignore ? (
        <ShellPillButton
          type="button"
          tone="outline"
          onClick={() => void onIgnore(record)}
          disabled={busyActionKey.length > 0}
        >
          <ShellActionStateLabel
            busy={busyActionKey === ignoreActionKey}
            idleLabel="Ignore"
            busyLabel="Ignore"
            icon={<SkipForward className="h-3.5 w-3.5" />}
          />
        </ShellPillButton>
      ) : null}
      <ShellPillButton
        type="button"
        tone="outline"
        onClick={() => void onResolve(record)}
        disabled={busyActionKey.length > 0}
      >
        <ShellActionStateLabel
          busy={busyActionKey === resolveActionKey}
          idleLabel="Resolve"
          busyLabel="Resolve"
          icon={<CheckCheck className="h-3.5 w-3.5" />}
        />
      </ShellPillButton>
    </>
  );
}

function IssueRowActions({
  record,
  busyActionKey,
  onResolve,
}: {
  record: IssueQueueRecord;
  busyActionKey: string;
  onResolve: (record: IssueQueueRecord) => Promise<void>;
}) {
  const resolveActionKey = `${record.key}:resolve`;
  return (
    <ShellPillButton
      type="button"
      tone="outline"
      onClick={() => void onResolve(record)}
      disabled={busyActionKey.length > 0}
    >
      <ShellActionStateLabel
        busy={busyActionKey === resolveActionKey}
        idleLabel="Resolve"
        busyLabel="Resolve"
        icon={<CheckCheck className="h-3.5 w-3.5" />}
      />
    </ShellPillButton>
  );
}

function ApprovalRowActions({
  record,
  busyActionKey,
  onApprove,
  onReject,
}: {
  record: ApprovalQueueRecord;
  busyActionKey: string;
  onApprove: (record: ApprovalQueueRecord) => Promise<void>;
  onReject: (record: ApprovalQueueRecord) => Promise<void>;
}) {
  const approveActionKey = `${record.key}:approve`;
  const rejectActionKey = `${record.key}:reject`;
  return (
    <>
      <ShellPillButton
        type="button"
        tone="primary"
        onClick={() => void onApprove(record)}
        disabled={busyActionKey.length > 0}
      >
        <ShellActionStateLabel
          busy={busyActionKey === approveActionKey}
          idleLabel="Approve"
          busyLabel="Approve"
          icon={<CheckCheck className="h-3.5 w-3.5" />}
        />
      </ShellPillButton>
      <ShellPillButton
        type="button"
        tone="outline"
        onClick={() => void onReject(record)}
        disabled={busyActionKey.length > 0}
      >
        <ShellActionStateLabel
          busy={busyActionKey === rejectActionKey}
          idleLabel="Reject"
          busyLabel="Reject"
          icon={<X className="h-3.5 w-3.5" />}
        />
      </ShellPillButton>
    </>
  );
}

function RuntimeRowActions({
  record,
  busyActionKey,
  onAllow,
  onDeny,
}: {
  record: RuntimeQueueRecord;
  busyActionKey: string;
  onAllow: (record: RuntimeQueueRecord) => Promise<void>;
  onDeny: (record: RuntimeQueueRecord) => Promise<void>;
}) {
  const allowActionKey = `${record.key}:allow`;
  const denyActionKey = `${record.key}:deny`;
  return (
    <>
      <ShellPillButton
        type="button"
        tone="primary"
        onClick={() => void onAllow(record)}
        disabled={busyActionKey.length > 0}
      >
        <ShellActionStateLabel
          busy={busyActionKey === allowActionKey}
          idleLabel="Allow"
          busyLabel="Allow"
          icon={<ShieldAlert className="h-3.5 w-3.5" />}
        />
      </ShellPillButton>
      <ShellPillButton
        type="button"
        tone="outline"
        onClick={() => void onDeny(record)}
        disabled={busyActionKey.length > 0}
      >
        <ShellActionStateLabel
          busy={busyActionKey === denyActionKey}
          idleLabel="Deny"
          busyLabel="Deny"
          icon={<X className="h-3.5 w-3.5" />}
        />
      </ShellPillButton>
    </>
  );
}

export function InboxWorkspace({
  initialSnapshot,
  initialPreferences,
  routeScope = { projectId: "", intakeSessionId: "" },
}: {
  initialSnapshot?: ShellInboxSnapshot | null;
  initialPreferences?: ShellPreferences;
  routeScope?: InboxRouteScope;
}) {
  const {
    busyActionKey,
    errorMessage,
    refreshNonce,
    runMutation,
    statusMessage,
  } = useShellRouteMutationRunner<InboxMutationResult>();
  const routeScopeKey = `${routeScope.projectId}:${routeScope.intakeSessionId}`;
  const [filterState, setFilterState] = useState<{
    routeScopeKey: string;
    query: string;
    filter: QueueFilter;
  }>({
    routeScopeKey,
    query: "",
    filter: "all",
  });
  const snapshotRefreshNonce = useShellSnapshotRefreshNonce({
    baseRefreshNonce: refreshNonce,
    invalidation: {
      planes: ["discovery", "execution"],
      scope: routeScope,
    },
    invalidationOptions: {
      ignoreSources: ["inbox"],
      since: initialSnapshot?.generatedAt ?? null,
    },
  });
  const {
    chains,
    discoveryFeed,
    projects,
    intakeSessions,
    approvals,
    issues,
    runtimes,
    loadState,
  } =
    useInboxState(snapshotRefreshNonce, initialPreferences, initialSnapshot);
  const query =
    filterState.routeScopeKey === routeScopeKey ? filterState.query : "";
  const filter =
    filterState.routeScopeKey === routeScopeKey ? filterState.filter : "all";

  const records = useMemo(
    () =>
      buildShellAttentionRecords({
        discoveryFeed,
        projects,
        intakeSessions,
        approvals,
        issues,
        runtimes,
        chains,
        routeScope: null,
      }),
    [approvals, chains, discoveryFeed, intakeSessions, issues, projects, runtimes]
  );
  const scopedRecords = useMemo(
    () => records.filter((record) => matchesAttentionRouteScope(record, routeScope)),
    [records, routeScope]
  );

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return scopedRecords.filter((record) => {
      if (!matchesFilter(record, filter)) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      return record.searchText.includes(normalizedQuery);
    });
  }, [filter, query, scopedRecords]);

  const counts = useMemo(
    () => ({
      all: scopedRecords.length,
      discovery: scopedRecords.filter((record) => record.plane === "discovery").length,
      execution: scopedRecords.filter((record) => record.plane === "execution").length,
      issues: scopedRecords.filter((record) => record.type === "issue").length,
      approvals: scopedRecords.filter((record) => record.type === "approval").length,
      permissions: scopedRecords.filter((record) => record.type === "runtime").length,
    }),
    [scopedRecords]
  );
  const scopedDiscoveryCount = useMemo(
    () => scopedRecords.filter((record) => record.type === "discovery").length,
    [scopedRecords]
  );
  const scopedIssueCount = useMemo(
    () => scopedRecords.filter((record) => record.type === "issue").length,
    [scopedRecords]
  );
  const scopedApprovalCount = useMemo(
    () => scopedRecords.filter((record) => record.type === "approval").length,
    [scopedRecords]
  );
  const scopedRuntimeCount = useMemo(
    () => scopedRecords.filter((record) => record.type === "runtime").length,
    [scopedRecords]
  );

  async function handleResolveDiscovery(record: DiscoveryQueueRecord) {
    await runMutation(`${record.key}:resolve`, () =>
      runAttentionAction({
        plane: "discovery",
        action: "resolve",
        item: record.item,
        routeScope,
        source: "inbox",
      })
    );
  }

  async function handleAcceptDiscovery(record: DiscoveryQueueRecord) {
    await runMutation(`${record.key}:accept`, () =>
      runAttentionAction({
        plane: "discovery",
        action: "accept",
        item: record.item,
        routeScope,
        source: "inbox",
      })
    );
  }

  async function handleIgnoreDiscovery(record: DiscoveryQueueRecord) {
    await runMutation(`${record.key}:ignore`, () =>
      runAttentionAction({
        plane: "discovery",
        action: "ignore",
        item: record.item,
        routeScope,
        source: "inbox",
      })
    );
  }

  async function handleResolveIssue(record: IssueQueueRecord) {
    await runExecutionAttentionMutation({
      action: "resolve-issue",
      actionKey: `${record.key}:resolve`,
      record,
      routeScope,
      runMutation,
      source: "inbox",
    });
  }

  async function handleApprove(record: ApprovalQueueRecord) {
    await runExecutionAttentionMutation({
      action: "approve",
      actionKey: `${record.key}:approve`,
      record,
      routeScope,
      runMutation,
      source: "inbox",
    });
  }

  async function handleReject(record: ApprovalQueueRecord) {
    await runExecutionAttentionMutation({
      action: "reject",
      actionKey: `${record.key}:reject`,
      record,
      routeScope,
      runMutation,
      source: "inbox",
    });
  }

  async function handleAllow(record: RuntimeQueueRecord) {
    await runExecutionAttentionMutation({
      action: "allow",
      actionKey: `${record.key}:allow`,
      record,
      routeScope,
      runMutation,
      source: "inbox",
    });
  }

  async function handleDeny(record: RuntimeQueueRecord) {
    await runExecutionAttentionMutation({
      action: "deny",
      actionKey: `${record.key}:deny`,
      record,
      routeScope,
      runMutation,
      source: "inbox",
    });
  }

  const filters: Array<{
    key: QueueFilter;
    label: string;
    count: number;
  }> = [
    { key: "all", label: "All", count: counts.all },
    { key: "discovery", label: "Discovery", count: counts.discovery },
    { key: "execution", label: "Execution", count: counts.execution },
    { key: "issues", label: "Issues", count: counts.issues },
    { key: "approvals", label: "Approvals", count: counts.approvals },
    { key: "permissions", label: "Permissions", count: counts.permissions },
  ];

  const sortedRecords = useMemo(
    () =>
      [...filteredRecords].sort(
        (a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime()
      ),
    [filteredRecords]
  );

  return (
    <ShellPage className="max-w-[1100px]">
      <ShellHero
        title="Inbox"
        description="Triage discovery, execution, issues, approvals, and tool permissions in one queue."
        meta={
          <>
            <span>{counts.all} total</span>
            <span>{counts.discovery} discovery</span>
            <span>{counts.execution} execution</span>
            <span>{counts.approvals + counts.permissions} review gates</span>
          </>
        }
      />

      {statusMessage ? <ShellStatusBanner tone="success">{statusMessage}</ShellStatusBanner> : null}

      {errorMessage ? <ShellStatusBanner tone="danger">{errorMessage}</ShellStatusBanner> : null}

      <ShellSearchSectionCard
        title="Queue"
        description="Search and filter the current inbox slice."
        actions={<Badge tone="info">{sortedRecords.length}</Badge>}
        searchValue={query}
        onSearchChange={(event) =>
          setFilterState({
            routeScopeKey,
            query: event.target.value,
            filter,
          })
        }
        searchPlaceholder="Search notifications"
        beforeSearch={
          <div className="flex flex-wrap items-center gap-2">
            {filters
              .filter((option) => option.key === "all" || option.count > 0 || filter === option.key)
              .map((option) => (
                <ShellFilterChipButton
                  key={option.key}
                  onClick={() =>
                    setFilterState({
                      routeScopeKey,
                      query,
                      filter: option.key,
                    })
                  }
                  label={option.label}
                  count={option.count}
                  active={filter === option.key}
                />
              ))}
          </div>
        }
        afterSearch={
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
            <span>{sortedRecords.length} visible</span>
            <span>{scopedDiscoveryCount} discovery</span>
            <span>{scopedIssueCount} issues</span>
            <span>{scopedApprovalCount} approvals</span>
            <span>{scopedRuntimeCount} permissions</span>
          </div>
        }
        contentClassName="space-y-0"
      >
        <div className="overflow-hidden rounded-[10px] border border-border/60 bg-background">
          {loadState === "loading" && records.length === 0 ? (
            <SkeletonList rows={6} />
          ) : null}

          {sortedRecords.map((record) => {
            if (record.type === "discovery") {
              return (
              <InboxNotificationRow
                key={record.key}
                record={record}
                actions={
                  <DiscoveryRowActions
                    record={record}
                      busyActionKey={busyActionKey}
                      onAccept={handleAcceptDiscovery}
                      onIgnore={handleIgnoreDiscovery}
                      onResolve={handleResolveDiscovery}
                    />
                  }
                />
              );
            }

            if (record.type === "issue") {
              return (
              <InboxNotificationRow
                key={record.key}
                record={record}
                actions={
                  <IssueRowActions
                    record={record}
                      busyActionKey={busyActionKey}
                      onResolve={handleResolveIssue}
                    />
                  }
                />
              );
            }

            if (record.type === "approval") {
              return (
              <InboxNotificationRow
                key={record.key}
                record={record}
                actions={
                  <ApprovalRowActions
                    record={record}
                      busyActionKey={busyActionKey}
                      onApprove={handleApprove}
                      onReject={handleReject}
                    />
                  }
                />
              );
            }

            return (
            <InboxNotificationRow
              key={record.key}
              record={record}
              actions={
                <RuntimeRowActions
                  record={record}
                    busyActionKey={busyActionKey}
                    onAllow={handleAllow}
                    onDeny={handleDeny}
                  />
                }
              />
            );
          })}

          {loadState !== "loading" && sortedRecords.length === 0 ? (
            <ShellEmptyState
              centered
              className="py-14"
              icon={<Inbox className="h-5 w-5" />}
              title={hasRouteScope(routeScope) ? undefined : "All clear"}
              description={
                hasRouteScope(routeScope)
                  ? "No notifications match the current scope."
                  : "You\u2019re all caught up."
              }
            />
          ) : null}
        </div>
      </ShellSearchSectionCard>
    </ShellPage>
  );
}
