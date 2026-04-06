"use client";

import type { ShellPreferences } from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import {
  CheckCheck,
  ShieldAlert,
} from "lucide-react";
import { useCallback, useMemo } from "react";

import {
  type ApprovalAttentionRecord,
  type IssueAttentionRecord,
  type RuntimeAttentionRecord,
} from "@/lib/attention-records";
import {
  matchesAttentionRouteScope,
} from "@/lib/attention-records";
import {
  type AttentionActionResult,
} from "@/lib/attention-action-model";
import type { ShellExecutionReviewSnapshot } from "@/lib/execution-review";
import {
  buildExecutionReviewRollupFromAttentionRecords,
  matchesExecutionReviewFilter,
  type ExecutionReviewFilter,
} from "@/lib/execution-review-model";
import type { ReviewBatchEffect } from "@/lib/review-batch-actions";
import {
  runExecutionAttentionMutation,
  runExecutionReviewBatchMutation,
} from "@/lib/review-execution-actions";
import {
  defaultRememberedReviewPass,
  resolveRememberedReviewPass,
  resolveReviewMemoryBucket,
  reviewPassFromExecutionReviewFilter,
  updateRememberedReviewPass,
} from "@/lib/review-memory";
import { safeFormatDate } from "@/lib/format-utils";
import { fetchShellExecutionReviewSnapshot } from "@/lib/shell-snapshot-client";
import {
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import { useShellRouteMutationRunner } from "@/lib/use-shell-route-mutation-runner";
import { useShellSnapshotRefreshNonce } from "@/lib/use-shell-snapshot-refresh-nonce";
import {
  type ShellRouteScope,
} from "@/lib/route-scope";
import { useScopedQuery } from "@/lib/use-scoped-query";
import { useScopedSelection } from "@/lib/use-scoped-selection";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";
import {
  ShellActionStateLabel,
  ShellEmptyState,
  ShellInlineStatus,
  ShellLoadingState,
  ShellPage,
  ShellPillButton,
  ShellStatusBanner,
} from "@/components/shell/shell-screen-primitives";

type ExecutionReviewRouteScope = ShellRouteScope;

const EMPTY_EXECUTION_REVIEW_SNAPSHOT: ShellExecutionReviewSnapshot = {
  generatedAt: "",
  records: [],
  stats: {
    totalCount: 0,
    issueCount: 0,
    approvalCount: 0,
    runtimeCount: 0,
    intakeOriginCount: 0,
    chainLinkedCount: 0,
    orphanCount: 0,
    criticalIssueCount: 0,
  },
  error: null,
  loadState: "ready",
};

function formatDate(value?: string | null) {
  return safeFormatDate(value, "n/a");
}

function severityTone(severity: string): "danger" | "warning" | "info" | "neutral" {
  if (severity === "critical") return "danger";
  if (severity === "high" || severity === "warning") return "warning";
  if (severity === "medium" || severity === "info") return "info";
  return "neutral";
}

function useExecutionReviewState(
  refreshNonce: number,
  initialPreferences?: ShellPreferences,
  initialSnapshot?: ShellExecutionReviewSnapshot | null
) {
  const { preferences } = useShellPreferences(initialPreferences);
  const pollInterval = getShellPollInterval(
    "execution_review",
    preferences.refreshProfile
  );
  const loadSnapshot = useCallback(() => fetchShellExecutionReviewSnapshot(), []);
  const selectLoadState = useCallback(
    (snapshot: ShellExecutionReviewSnapshot) => snapshot.loadState,
    []
  );
  const { loadState, snapshot } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_EXECUTION_REVIEW_SNAPSHOT,
    initialSnapshot,
    refreshNonce,
    pollIntervalMs: pollInterval,
    loadSnapshot,
    selectLoadState,
  });

  return {
    error: snapshot.error,
    loadState,
    records: snapshot.records,
    stats: snapshot.stats,
  };
}

export function ExecutionReviewWorkspace({
  initialSnapshot,
  initialPreferences,
  initialFilter = "all",
  routeScope = { projectId: "", intakeSessionId: "" },
}: {
  initialSnapshot?: ShellExecutionReviewSnapshot | null;
  initialPreferences?: ShellPreferences;
  initialFilter?: ExecutionReviewFilter;
  routeScope?: ExecutionReviewRouteScope;
}) {
  const {
    busyActionKey,
    errorMessage,
    isPending,
    refreshNonce,
    runMutation,
    statusMessage,
  } = useShellRouteMutationRunner<AttentionActionResult | ReviewBatchEffect>();
  const routeViewKey = `${routeScope.projectId}:${routeScope.intakeSessionId}:${initialFilter}`;
  const { normalizedQuery } = useScopedQuery(routeViewKey);
  const snapshotRefreshNonce = useShellSnapshotRefreshNonce({
    baseRefreshNonce: refreshNonce,
    invalidation: {
      planes: ["execution"],
      scope: routeScope,
    },
    invalidationOptions: {
      ignoreSources: ["execution-review"],
      since: initialSnapshot?.generatedAt ?? null,
    },
  });
  const { error, loadState, records } = useExecutionReviewState(
    snapshotRefreshNonce,
    initialPreferences,
    initialSnapshot
  );
  const { preferences, updatePreferences } = useShellPreferences(initialPreferences);
  const filter = initialFilter;
  const scopedRecords = useMemo(
    () => records.filter((record) => matchesAttentionRouteScope(record, routeScope)),
    [records, routeScope]
  );
  const scopedStats = useMemo(
    () => buildExecutionReviewRollupFromAttentionRecords(scopedRecords),
    [scopedRecords]
  );
  const filteredRecords = useMemo(() => {
    return scopedRecords.filter((record) => {
      if (!matchesExecutionReviewFilter(record, filter)) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      return record.searchText.includes(normalizedQuery);
    });
  }, [filter, normalizedQuery, scopedRecords]);
  const filteredIssueRecords = useMemo(
    () =>
      filteredRecords.filter(
        (record): record is IssueAttentionRecord => record.type === "issue"
      ),
    [filteredRecords]
  );
  const filteredApprovalRecords = useMemo(
    () =>
      filteredRecords.filter(
        (record): record is ApprovalAttentionRecord => record.type === "approval"
      ),
    [filteredRecords]
  );
  const filteredRuntimeRecords = useMemo(
    () =>
      filteredRecords.filter(
        (record): record is RuntimeAttentionRecord => record.type === "runtime"
      ),
    [filteredRecords]
  );
  const selectionViewKey = `${routeViewKey}:${normalizedQuery}`;
  const {
    clearProcessedSelection,
  } = useScopedSelection(selectionViewKey);
  const derivedScopedIntakeSessionId = useMemo(
    () =>
      routeScope.intakeSessionId ||
      (routeScope.projectId
        ? scopedRecords.find(
            (record) => record.source.projectId === routeScope.projectId
          )?.source.intakeSession?.id ?? ""
        : ""),
    [routeScope.intakeSessionId, routeScope.projectId, scopedRecords]
  );
  const reviewMemoryBucket = useMemo(
    () =>
      resolveReviewMemoryBucket({
        scope: {
          projectId: routeScope.projectId,
          intakeSessionId: derivedScopedIntakeSessionId,
        },
        executionChainKinds: scopedRecords.map((record) => record.source.chainKind),
      }),
    [derivedScopedIntakeSessionId, routeScope.projectId, scopedRecords]
  );
  const currentReviewPass = useMemo(
    () => reviewPassFromExecutionReviewFilter(filter),
    [filter]
  );
  const rememberedReviewPass = useMemo(
    () => resolveRememberedReviewPass(preferences, reviewMemoryBucket),
    [preferences, reviewMemoryBucket]
  );
  const defaultReviewPass = useMemo(
    () => defaultRememberedReviewPass(reviewMemoryBucket),
    [reviewMemoryBucket]
  );

  // Keep memory callbacks alive for preference sync
  void rememberedReviewPass;
  void defaultReviewPass;
  void currentReviewPass;

  const handleRememberCurrentFilter = useCallback(() => {
    updatePreferences({
      reviewMemory: updateRememberedReviewPass(
        preferences.reviewMemory,
        reviewMemoryBucket,
        currentReviewPass
      ),
    });
  }, [
    currentReviewPass,
    preferences.reviewMemory,
    reviewMemoryBucket,
    updatePreferences,
  ]);
  void handleRememberCurrentFilter;

  async function handleResolveIssue(record: IssueAttentionRecord) {
    await runExecutionAttentionMutation({
      action: "resolve-issue",
      actionKey: `${record.key}:resolve`,
      record,
      routeScope,
      runMutation,
      source: "execution-review",
    });
  }

  async function handleApprove(record: ApprovalAttentionRecord) {
    await runExecutionAttentionMutation({
      action: "approve",
      actionKey: `${record.key}:approve`,
      record,
      routeScope,
      runMutation,
      source: "execution-review",
    });
  }

  async function handleReject(record: ApprovalAttentionRecord) {
    await runExecutionAttentionMutation({
      action: "reject",
      actionKey: `${record.key}:reject`,
      record,
      routeScope,
      runMutation,
      source: "execution-review",
    });
  }

  async function handleAllow(record: RuntimeAttentionRecord) {
    await runExecutionAttentionMutation({
      action: "allow",
      actionKey: `${record.key}:allow`,
      record,
      routeScope,
      runMutation,
      source: "execution-review",
    });
  }

  async function handleDeny(record: RuntimeAttentionRecord) {
    await runExecutionAttentionMutation({
      action: "deny",
      actionKey: `${record.key}:deny`,
      record,
      routeScope,
      runMutation,
      source: "execution-review",
    });
  }

  async function handleBatchResolveIssues() {
    await runExecutionReviewBatchMutation({
      action: "resolve-issue",
      actionKey: "batch:execution-resolve-issue",
      records: filteredIssueRecords,
      routeScope,
      runMutation,
      source: "execution-review",
      onProcessedKeys: clearProcessedSelection,
    });
  }
  void handleBatchResolveIssues;

  async function handleBatchApprove() {
    await runExecutionReviewBatchMutation({
      action: "approve",
      actionKey: "batch:execution-approve",
      records: filteredApprovalRecords,
      routeScope,
      runMutation,
      source: "execution-review",
      onProcessedKeys: clearProcessedSelection,
    });
  }
  void handleBatchApprove;

  async function handleBatchReject() {
    await runExecutionReviewBatchMutation({
      action: "reject",
      actionKey: "batch:execution-reject",
      records: filteredApprovalRecords,
      routeScope,
      runMutation,
      source: "execution-review",
      onProcessedKeys: clearProcessedSelection,
    });
  }
  void handleBatchReject;

  async function handleBatchAllow() {
    await runExecutionReviewBatchMutation({
      action: "allow",
      actionKey: "batch:execution-allow",
      records: filteredRuntimeRecords,
      routeScope,
      runMutation,
      source: "execution-review",
      onProcessedKeys: clearProcessedSelection,
    });
  }
  void handleBatchAllow;

  async function handleBatchDeny() {
    await runExecutionReviewBatchMutation({
      action: "deny",
      actionKey: "batch:execution-deny",
      records: filteredRuntimeRecords,
      routeScope,
      runMutation,
      source: "execution-review",
      onProcessedKeys: clearProcessedSelection,
    });
  }
  void handleBatchDeny;

  return (
    <ShellPage>
      {statusMessage ? (
        <ShellStatusBanner tone="success">{statusMessage}</ShellStatusBanner>
      ) : null}

      {errorMessage ? (
        <ShellStatusBanner tone="danger">{errorMessage}</ShellStatusBanner>
      ) : null}

      {error ? (
        <ShellStatusBanner tone="warning">{error}</ShellStatusBanner>
      ) : null}

      {loadState === "loading" && filteredRecords.length === 0 ? (
        <ShellLoadingState description="Loading control plane..." className="py-10" />
      ) : null}

      {/* Issues */}
      {(!initialFilter || initialFilter === "all" || initialFilter === "issues") ? <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-medium text-foreground">Issues</h3>
          <Badge tone="neutral">{scopedStats.issueCount}</Badge>
        </div>

        {filteredIssueRecords.length === 0 ? (
          <ShellEmptyState description="No open issues" className="py-4" />
        ) : (
          <div className="divide-y divide-border rounded-lg border">
            {filteredIssueRecords.map((record) => {
              const busy = busyActionKey === `${record.key}:resolve`;
              return (
                <div
                  key={record.key}
                  className="flex items-center gap-3 px-4 py-2.5 text-[13px]"
                >
                  <Badge tone={severityTone(record.issue.severity)}>
                    {record.issue.severity}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-foreground">
                    {record.issue.title}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {record.issue.project_name}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {formatDate(record.issue.created_at)}
                  </span>
                  <ShellPillButton
                    type="button"
                    tone="outline"
                    compact
                    disabled={busyActionKey.length > 0}
                    onClick={() => void handleResolveIssue(record)}
                  >
                    <ShellActionStateLabel
                      busy={busy}
                      idleLabel="Resolve"
                      busyLabel="Resolving"
                      icon={<CheckCheck className="h-3.5 w-3.5" />}
                    />
                  </ShellPillButton>
                </div>
              );
            })}
          </div>
        )}
      </section> : null}

      {/* Approvals */}
      {(!initialFilter || initialFilter === "all" || initialFilter === "approvals") ? <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-medium text-foreground">Approvals</h3>
          <Badge tone="neutral">{scopedStats.approvalCount}</Badge>
        </div>

        {filteredApprovalRecords.length === 0 ? (
          <ShellEmptyState description="No pending approvals" className="py-4" />
        ) : (
          <div className="divide-y divide-border rounded-lg border">
            {filteredApprovalRecords.map((record) => {
              const busyApprove = busyActionKey === `${record.key}:approve`;
              const busyReject = busyActionKey === `${record.key}:reject`;
              return (
                <div
                  key={record.key}
                  className="flex items-center gap-3 px-4 py-2.5 text-[13px]"
                >
                  <Badge tone="info">{record.approval.action}</Badge>
                  <span className="min-w-0 flex-1 truncate text-foreground">
                    {record.approval.reason || record.title}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {record.approval.project_name}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {record.approval.requested_by}
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <ShellPillButton
                      type="button"
                      tone="primary"
                      compact
                      disabled={busyActionKey.length > 0}
                      onClick={() => void handleApprove(record)}
                    >
                      <ShellActionStateLabel
                        busy={busyApprove}
                        idleLabel="Approve"
                        busyLabel="Approving"
                        icon={<CheckCheck className="h-3.5 w-3.5" />}
                      />
                    </ShellPillButton>
                    <ShellPillButton
                      type="button"
                      tone="outline"
                      compact
                      disabled={busyActionKey.length > 0}
                      onClick={() => void handleReject(record)}
                    >
                      <ShellActionStateLabel
                        busy={busyReject}
                        idleLabel="Reject"
                        busyLabel="Rejecting"
                        icon={<ShieldAlert className="h-3.5 w-3.5" />}
                      />
                    </ShellPillButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section> : null}

      {/* Tool Permissions */}
      {(!initialFilter || initialFilter === "all" || initialFilter === "runtimes") ? <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-medium text-foreground">Tool permissions</h3>
          <Badge tone="neutral">{scopedStats.runtimeCount}</Badge>
        </div>

        {filteredRuntimeRecords.length === 0 ? (
          <ShellEmptyState description="No pending permissions" className="py-4" />
        ) : (
          <div className="divide-y divide-border rounded-lg border">
            {filteredRuntimeRecords.map((record) => {
              const busyAllow = busyActionKey === `${record.key}:allow`;
              const busyDeny = busyActionKey === `${record.key}:deny`;
              return (
                <div
                  key={record.key}
                  className="flex items-center gap-3 px-4 py-2.5 text-[13px]"
                >
                  <Badge tone="neutral">{record.runtime.tool_name}</Badge>
                  <span className="min-w-0 flex-1 truncate text-foreground">
                    {record.runtime.pending_stage}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {record.source.project?.name ?? record.runtime.project_id}
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <ShellPillButton
                      type="button"
                      tone="primary"
                      compact
                      disabled={busyActionKey.length > 0}
                      onClick={() => void handleAllow(record)}
                    >
                      <ShellActionStateLabel
                        busy={busyAllow}
                        idleLabel="Allow"
                        busyLabel="Allowing"
                        icon={<CheckCheck className="h-3.5 w-3.5" />}
                      />
                    </ShellPillButton>
                    <ShellPillButton
                      type="button"
                      tone="outline"
                      compact
                      disabled={busyActionKey.length > 0}
                      onClick={() => void handleDeny(record)}
                    >
                      <ShellActionStateLabel
                        busy={busyDeny}
                        idleLabel="Deny"
                        busyLabel="Denying"
                        icon={<ShieldAlert className="h-3.5 w-3.5" />}
                      />
                    </ShellPillButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section> : null}

      {isPending ? (
        <ShellInlineStatus busy label="Refreshing..." />
      ) : null}
    </ShellPage>
  );
}
