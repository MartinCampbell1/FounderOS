"use client";

import type {
  ShellPreferences,
  ShellReviewMemoryBucket,
} from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import {
  AlertTriangle,
  ClipboardCheck,
  CheckCheck,
  GitBranch,
  Search,
  ShieldAlert,
} from "lucide-react";
import { useCallback, useMemo } from "react";

import { ReviewMemorySection } from "@/components/review/review-memory-panel";
import {
  ShellActionStateLabel,
  ShellEmptyState,
  ShellFilterChipLink,
  ShellHero,
  ShellPage,
  ShellPillButton,
  ShellPillCount,
  ShellSectionCard,
  ShellStatusBanner,
} from "@/components/shell/shell-screen-primitives";
import { SkeletonList } from "@/components/shell/shell-skeleton";
import {
  ShellRecordActionBar,
  ShellRecordBody,
  ShellRecordCard,
  ShellRecordHeader,
  ShellRecordLinkButton,
  ShellRecordMeta,
  ShellRecordSection,
  ShellRecordSelectionButton,
} from "@/components/shell/shell-record-primitives";
import {
  matchesAttentionRouteScope,
  type ApprovalAttentionRecord,
  type IssueAttentionRecord,
  type RuntimeAttentionRecord,
  type ShellExecutionAttentionRecord,
} from "@/lib/attention-records";
import type { AttentionActionResult } from "@/lib/attention-action-model";
import {
  matchesShellChainRouteScope,
} from "@/lib/chain-graph";
import {
  type DiscoveryMutationEffect,
} from "@/lib/discovery-mutations";
import {
  buildDiscoveryReviewStatsFromRecords,
} from "@/lib/discovery-review-model";
import type { ShellDiscoveryReviewRecord } from "@/lib/discovery-review";
import {
  buildExecutionReviewRollupFromAttentionRecords,
} from "@/lib/execution-review-model";
import type { ReviewBatchEffect } from "@/lib/review-batch-actions";
import {
  runDiscoveryReviewBatchMutation,
  runDiscoveryReviewMutation,
} from "@/lib/review-discovery-actions";
import {
  runExecutionAttentionMutation,
  runExecutionReviewBatchMutation,
} from "@/lib/review-execution-actions";
import {
  runReviewPresetAction,
  type ReviewPresetEffect,
} from "@/lib/review-preset-actions";
import {
  countReviewPresetMatches,
  reviewPresetDefinitions,
  type ShellReviewPreset,
} from "@/lib/review-presets";
import {
  defaultRememberedReviewPass,
  describeReviewPassPreference,
  resolveRememberedReviewPass,
  resolveReviewMemoryBucket,
  reviewMemoryBucketLabel,
  updateRememberedReviewPass,
} from "@/lib/review-memory";
import {
  matchesReviewCenterDiscoveryLane,
  matchesReviewCenterExecutionLane,
  type ShellReviewCenterLane,
  type ShellReviewCenterSnapshot,
} from "@/lib/review-center";
import {
  fetchShellReviewCenterSnapshot,
} from "@/lib/shell-snapshot-client";
import {
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import { useShellRouteMutationRunner } from "@/lib/use-shell-route-mutation-runner";
import { useShellSnapshotRefreshNonce } from "@/lib/use-shell-snapshot-refresh-nonce";
import {
  buildReviewScopeHref,
  hasShellRouteScope,
  type ShellRouteScope,
} from "@/lib/route-scope";
import { useScopedQuery } from "@/lib/use-scoped-query";
import { useScopedSelection } from "@/lib/use-scoped-selection";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";

const EMPTY_REVIEW_CENTER_SNAPSHOT: ShellReviewCenterSnapshot = {
  generatedAt: "",
  discovery: {
    generatedAt: "",
    records: [],
    stats: {
      totalCount: 0,
      authoringCount: 0,
      traceReviewCount: 0,
      handoffReadyCount: 0,
      executionFollowthroughCount: 0,
      linkedCount: 0,
      replayLinkedCount: 0,
    },
    error: null,
    loadState: "ready",
  },
  execution: {
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
  },
  stats: {
    totalCount: 0,
    discoveryCount: 0,
    executionCount: 0,
    authoringCount: 0,
    traceReviewCount: 0,
    handoffReadyCount: 0,
    executionFollowthroughCount: 0,
    issueCount: 0,
    approvalCount: 0,
    runtimeCount: 0,
    decisionCount: 0,
    criticalIssueCount: 0,
    linkedDiscoveryCount: 0,
    linkedExecutionCount: 0,
    intakeOriginCount: 0,
  },
  errors: [],
  loadState: "ready",
};

function discoveryKindTone(kind: ShellDiscoveryReviewRecord["kind"]) {
  if (kind === "authoring") return "warning" as const;
  if (kind === "trace-review") return "info" as const;
  if (kind === "handoff-ready") return "success" as const;
  return "neutral" as const;
}

function discoveryKindLabel(kind: ShellDiscoveryReviewRecord["kind"]) {
  if (kind === "trace-review") return "trace review";
  if (kind === "handoff-ready") return "handoff ready";
  if (kind === "execution-followthrough") return "follow-through";
  return "authoring";
}

function executionTypeLabel(record: ShellExecutionAttentionRecord) {
  if (record.type === "issue") return "issue";
  if (record.type === "approval") return "approval";
  return "tool permission";
}

function ReviewBatchPanel({
  busyActionKey,
  selectedCount,
  selectedDiscoveryCount,
  selectedExecutionCount,
  selectedIssueCount,
  selectedApprovalCount,
  selectedRuntimeCount,
  selectedCriticalIssueCount,
  selectedHandoffCount,
  visibleDiscoveryCount,
  visibleExecutionCount,
  visibleCount,
  visibleCriticalIssueCount,
  visibleHandoffCount,
  onBatchAllow,
  onBatchApprove,
  onBatchConfirmDiscovery,
  onBatchDeny,
  onBatchReject,
  onBatchReopenDiscovery,
  onBatchResolveIssues,
  onClearSelection,
  onSelectCriticalIssues,
  onSelectDiscoveryVisible,
  onSelectExecutionVisible,
  onSelectHandoffReady,
  onSelectVisible,
}: {
  busyActionKey: string;
  selectedCount: number;
  selectedDiscoveryCount: number;
  selectedExecutionCount: number;
  selectedIssueCount: number;
  selectedApprovalCount: number;
  selectedRuntimeCount: number;
  selectedCriticalIssueCount: number;
  selectedHandoffCount: number;
  visibleDiscoveryCount: number;
  visibleExecutionCount: number;
  visibleCount: number;
  visibleCriticalIssueCount: number;
  visibleHandoffCount: number;
  onBatchAllow: () => Promise<void>;
  onBatchApprove: () => Promise<void>;
  onBatchConfirmDiscovery: () => Promise<void>;
  onBatchDeny: () => Promise<void>;
  onBatchReject: () => Promise<void>;
  onBatchReopenDiscovery: () => Promise<void>;
  onBatchResolveIssues: () => Promise<void>;
  onClearSelection: () => void;
  onSelectCriticalIssues: () => void;
  onSelectDiscoveryVisible: () => void;
  onSelectExecutionVisible: () => void;
  onSelectHandoffReady: () => void;
  onSelectVisible: () => void;
}) {
  const batchBusy = busyActionKey.startsWith("batch:");

  return (
    <ShellSectionCard
      title="Batch triage"
      contentClassName="space-y-4"
    >
        <ShellRecordActionBar>
          <ShellPillButton
            type="button"
            tone="outline"
            onClick={onSelectVisible}
            disabled={batchBusy || visibleCount === 0}
          >
            <span>Select visible</span>
            <ShellPillCount
              count={visibleCount}
              active={selectedCount > 0 && selectedCount === visibleCount}
            />
          </ShellPillButton>
          <ShellPillButton
            type="button"
            tone="outline"
            active={selectedCount > 0 && selectedCount === selectedDiscoveryCount}
            onClick={onSelectDiscoveryVisible}
            disabled={batchBusy || visibleDiscoveryCount === 0}
          >
            <span>Discovery only</span>
            <ShellPillCount
              count={visibleDiscoveryCount}
              active={selectedCount > 0 && selectedCount === selectedDiscoveryCount}
            />
          </ShellPillButton>
          <ShellPillButton
            type="button"
            tone="outline"
            active={selectedCount > 0 && selectedCount === selectedExecutionCount}
            onClick={onSelectExecutionVisible}
            disabled={batchBusy || visibleExecutionCount === 0}
          >
            <span>Execution only</span>
            <ShellPillCount
              count={visibleExecutionCount}
              active={selectedCount > 0 && selectedCount === selectedExecutionCount}
            />
          </ShellPillButton>
          <ShellPillButton
            type="button"
            tone="outline"
            active={selectedHandoffCount > 0 && selectedCount === selectedHandoffCount}
            onClick={onSelectHandoffReady}
            disabled={batchBusy || visibleHandoffCount === 0}
          >
            <span>Handoff ready</span>
            <ShellPillCount
              count={visibleHandoffCount}
              active={selectedHandoffCount > 0 && selectedCount === selectedHandoffCount}
            />
          </ShellPillButton>
          <ShellPillButton
            type="button"
            tone="outline"
            active={selectedCriticalIssueCount > 0 && selectedCount === selectedCriticalIssueCount}
            onClick={onSelectCriticalIssues}
            disabled={batchBusy || visibleCriticalIssueCount === 0}
          >
            <span>Critical issues</span>
            <ShellPillCount
              count={visibleCriticalIssueCount}
              active={selectedCriticalIssueCount > 0 && selectedCount === selectedCriticalIssueCount}
            />
          </ShellPillButton>
          <ShellPillButton
            type="button"
            tone="ghost"
            onClick={onClearSelection}
            disabled={batchBusy || selectedCount === 0}
          >
            <span>Clear</span>
            <ShellPillCount count={selectedCount} />
          </ShellPillButton>
        </ShellRecordActionBar>

        <ShellRecordActionBar>
          <ShellPillButton
            type="button"
            tone="primary"
            onClick={() => void onBatchConfirmDiscovery()}
            disabled={busyActionKey.length > 0 || selectedDiscoveryCount === 0}
          >
            <ShellActionStateLabel
              busy={busyActionKey === "batch:discovery-confirm"}
              idleLabel="Confirm selected"
              busyLabel="Confirm selected"
              icon={<ClipboardCheck className="h-4 w-4" />}
            />
          </ShellPillButton>
          <ShellPillButton
            type="button"
            tone="outline"
            onClick={() => void onBatchReopenDiscovery()}
            disabled={busyActionKey.length > 0 || selectedDiscoveryCount === 0}
          >
            <ShellActionStateLabel
              busy={busyActionKey === "batch:discovery-reopen"}
              idleLabel="Reopen selected"
              busyLabel="Reopen selected"
              icon={<AlertTriangle className="h-4 w-4" />}
            />
          </ShellPillButton>
          <ShellPillButton
            type="button"
            tone="outline"
            onClick={() => void onBatchResolveIssues()}
            disabled={busyActionKey.length > 0 || selectedIssueCount === 0}
          >
            <ShellActionStateLabel
              busy={busyActionKey === "batch:execution-resolve-issue"}
              idleLabel="Resolve issues"
              busyLabel="Resolve issues"
              icon={<CheckCheck className="h-4 w-4" />}
            />
          </ShellPillButton>
          <ShellPillButton
            type="button"
            tone="primary"
            onClick={() => void onBatchApprove()}
            disabled={busyActionKey.length > 0 || selectedApprovalCount === 0}
          >
            <ShellActionStateLabel
              busy={busyActionKey === "batch:execution-approve"}
              idleLabel="Approve selected"
              busyLabel="Approve selected"
              icon={<CheckCheck className="h-4 w-4" />}
            />
          </ShellPillButton>
          <ShellPillButton
            type="button"
            tone="outline"
            onClick={() => void onBatchReject()}
            disabled={busyActionKey.length > 0 || selectedApprovalCount === 0}
          >
            <ShellActionStateLabel
              busy={busyActionKey === "batch:execution-reject"}
              idleLabel="Reject selected"
              busyLabel="Reject selected"
              icon={<ShieldAlert className="h-4 w-4" />}
            />
          </ShellPillButton>
          <ShellPillButton
            type="button"
            tone="primary"
            onClick={() => void onBatchAllow()}
            disabled={busyActionKey.length > 0 || selectedRuntimeCount === 0}
          >
            <ShellActionStateLabel
              busy={busyActionKey === "batch:execution-allow"}
              idleLabel="Allow selected"
              busyLabel="Allow selected"
              icon={<CheckCheck className="h-4 w-4" />}
            />
          </ShellPillButton>
          <ShellPillButton
            type="button"
            tone="outline"
            onClick={() => void onBatchDeny()}
            disabled={busyActionKey.length > 0 || selectedRuntimeCount === 0}
          >
            <ShellActionStateLabel
              busy={busyActionKey === "batch:execution-deny"}
              idleLabel="Deny selected"
              busyLabel="Deny selected"
              icon={<ShieldAlert className="h-4 w-4" />}
            />
          </ShellPillButton>
        </ShellRecordActionBar>
    </ShellSectionCard>
  );
}

function ReviewPresetPanel({
  activePreset,
  busyActionKey,
  lane,
  memoryBucket,
  rememberedPassLabel,
  rememberCurrentPassLabel,
  isCurrentPassRemembered,
  isMemoryAtDefault,
  presetCounts,
  routeScope,
  onRememberCurrentPass,
  onResetRememberedPass,
  onRunPreset,
}: {
  activePreset: ShellReviewPreset | null;
  busyActionKey: string;
  lane: ShellReviewCenterLane;
  memoryBucket: ShellReviewMemoryBucket;
  rememberedPassLabel: string;
  rememberCurrentPassLabel: string;
  isCurrentPassRemembered: boolean;
  isMemoryAtDefault: boolean;
  presetCounts: Record<ShellReviewPreset, number>;
  routeScope: ShellRouteScope;
  onRememberCurrentPass: () => void;
  onResetRememberedPass: () => void;
  onRunPreset: (preset: ShellReviewPreset) => Promise<void>;
}) {
  return (
    <ShellSectionCard
      title="Preset playbooks"
      contentClassName="space-y-4"
    >
        <ReviewMemorySection
          memoryTargetLabel={reviewMemoryBucketLabel(memoryBucket)}
          rememberedLabel={rememberedPassLabel}
          rememberLabel={rememberCurrentPassLabel}
          activeRememberLabel="Current pass remembered"
          remembered={isCurrentPassRemembered}
          busy={busyActionKey.length > 0}
          resetDisabled={isMemoryAtDefault}
          onRemember={onRememberCurrentPass}
          onReset={onResetRememberedPass}
        />

        <div className="grid gap-3">
          {reviewPresetDefinitions().map((preset) => {
            const isActive = activePreset === preset.key;
            const actionBusy = busyActionKey === `preset:${preset.key}`;
            return (
              <ShellRecordSection key={preset.key}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {isActive ? <Badge tone="info">active</Badge> : null}
                      <Badge tone={presetCounts[preset.key] > 0 ? "warning" : "neutral"}>
                        {presetCounts[preset.key]} visible
                      </Badge>
                    </div>
                    <div className="text-sm font-semibold text-foreground">{preset.label}</div>
                    <ShellRecordActionBar>
                      {preset.steps.map((step) => (
                        <Badge key={step} tone="neutral">
                          {step}
                        </Badge>
                      ))}
                    </ShellRecordActionBar>
                  </div>
                  <ShellRecordActionBar>
                    <ShellRecordLinkButton
                      href={buildReviewScopeHref(routeScope, lane === "all" ? null : lane, preset.key)}
                      label="Open preset"
                    />
                    {isActive ? (
                      <ShellPillButton
                        type="button"
                        tone="primary"
                        onClick={() => void onRunPreset(preset.key)}
                        disabled={actionBusy || presetCounts[preset.key] === 0}
                      >
                        <ShellActionStateLabel
                          busy={actionBusy}
                          idleLabel="Run preset"
                          busyLabel="Run preset"
                          icon={<CheckCheck className="h-4 w-4" />}
                        />
                      </ShellPillButton>
                    ) : null}
                  </ShellRecordActionBar>
                </div>
              </ShellRecordSection>
            );
          })}
        </div>

        {activePreset ? (
          <ShellRecordLinkButton
            href={buildReviewScopeHref(routeScope, lane === "all" ? null : lane, null)}
            label="Clear preset"
          />
        ) : null}
    </ShellSectionCard>
  );
}

function DiscoveryReviewCard({
  record,
  routeScope,
  selected,
  busyActionKey,
  onConfirm,
  onToggleSelected,
  onReopen,
  onOpenHandoff,
}: {
  record: ShellDiscoveryReviewRecord;
  routeScope: ShellRouteScope;
  selected: boolean;
  busyActionKey: string;
  onConfirm: (record: ShellDiscoveryReviewRecord) => Promise<void>;
  onToggleSelected: (recordKey: string) => void;
  onReopen: (record: ShellDiscoveryReviewRecord) => Promise<void>;
  onOpenHandoff: (record: ShellDiscoveryReviewRecord) => Promise<void>;
}) {
  const confirmActionKey = `${record.key}:confirm`;
  const reopenActionKey = `${record.key}:reopen`;
  const handoffActionKey = `${record.key}:handoff`;
  const canOpenHandoff =
    record.kind === "handoff-ready" &&
    Boolean(record.dossier.execution_brief_candidate);

  return (
    <ShellRecordCard selected={selected}>
      <ShellRecordHeader
        badges={
          <>
            <Badge tone="info">discovery</Badge>
            <Badge tone={discoveryKindTone(record.kind)}>
              {discoveryKindLabel(record.kind)}
            </Badge>
            <Badge tone="neutral">{record.dossier.idea.latest_stage}</Badge>
            {record.chain ? <Badge tone="info">chain-linked</Badge> : null}
          </>
        }
        title={record.dossier.idea.title}
        description={record.reason}
        accessory={
          <ShellRecordSelectionButton
            selected={selected}
            onClick={() => onToggleSelected(record.key)}
            disabled={busyActionKey.length > 0}
          />
        }
      />
      <ShellRecordBody>
        <ShellRecordMeta>
          <span>stage {record.dossier.idea.latest_stage}</span>
          {record.trace ? <span>{record.trace.stepCount} trace steps</span> : null}
          {record.trace?.linkedSessionIds.length ? (
            <span>{record.trace.linkedSessionIds.length} linked sessions</span>
          ) : null}
          {record.chain?.briefId ? <span>brief {record.chain.briefId}</span> : null}
        </ShellRecordMeta>
        <ShellRecordActionBar>
          <ShellPillButton
            type="button"
            tone="primary"
            onClick={() => void onConfirm(record)}
            disabled={busyActionKey.length > 0}
          >
            <ShellActionStateLabel
              busy={busyActionKey === confirmActionKey}
              idleLabel="Confirm"
              busyLabel="Confirm"
              icon={<ClipboardCheck className="h-4 w-4" />}
            />
          </ShellPillButton>
          <ShellPillButton
            type="button"
            tone="outline"
            onClick={() => void onReopen(record)}
            disabled={busyActionKey.length > 0}
          >
            <ShellActionStateLabel
              busy={busyActionKey === reopenActionKey}
              idleLabel="Reopen"
              busyLabel="Reopen"
              icon={<AlertTriangle className="h-4 w-4" />}
            />
          </ShellPillButton>
          {canOpenHandoff ? (
            <ShellPillButton
              type="button"
              tone="outline"
              onClick={() => void onOpenHandoff(record)}
              disabled={busyActionKey.length > 0}
            >
              <ShellActionStateLabel
                busy={busyActionKey === handoffActionKey}
                idleLabel="Open handoff"
                busyLabel="Open handoff"
                icon={<GitBranch className="h-4 w-4" />}
              />
            </ShellPillButton>
          ) : null}
        </ShellRecordActionBar>
      </ShellRecordBody>
    </ShellRecordCard>
  );
}

function ExecutionReviewCard({
  record,
  routeScope,
  selected,
  busyActionKey,
  onResolveIssue,
  onApprove,
  onReject,
  onAllow,
  onDeny,
  onToggleSelected,
}: {
  record: ShellExecutionAttentionRecord;
  routeScope: ShellRouteScope;
  selected: boolean;
  busyActionKey: string;
  onResolveIssue: (record: IssueAttentionRecord) => Promise<void>;
  onApprove: (record: ApprovalAttentionRecord) => Promise<void>;
  onReject: (record: ApprovalAttentionRecord) => Promise<void>;
  onAllow: (record: RuntimeAttentionRecord) => Promise<void>;
  onDeny: (record: RuntimeAttentionRecord) => Promise<void>;
  onToggleSelected: (recordKey: string) => void;
}) {
  const resolveActionKey = `${record.key}:resolve`;
  const approveActionKey = `${record.key}:approve`;
  const rejectActionKey = `${record.key}:reject`;
  const allowActionKey = `${record.key}:allow`;
  const denyActionKey = `${record.key}:deny`;

  return (
    <ShellRecordCard selected={selected}>
      <ShellRecordHeader
        badges={
          <>
            <Badge tone="warning">execution</Badge>
            <Badge tone={record.tone}>{executionTypeLabel(record)}</Badge>
            {record.source.chainKind !== "unlinked" ? (
              <Badge tone="info">{record.source.chainKind}</Badge>
            ) : null}
            {record.source.sourceKind === "intake_session" ? (
              <Badge tone="info">intake origin</Badge>
            ) : null}
          </>
        }
        title={record.title}
        description={record.detail}
        accessory={
          <ShellRecordSelectionButton
            selected={selected}
            onClick={() => onToggleSelected(record.key)}
            disabled={busyActionKey.length > 0}
          />
        }
      />
      <ShellRecordBody>
        <ShellRecordMeta>
          <span>{record.source.project?.name || "unscoped project"}</span>
          {record.source.intakeSession ? (
            <span>{record.source.intakeSession.title}</span>
          ) : null}
          {record.source.discoveryIdeaTitle ? (
            <span>{record.source.discoveryIdeaTitle}</span>
          ) : null}
          <span>{record.source.sourceKind}</span>
        </ShellRecordMeta>
        <ShellRecordActionBar>
          {record.type === "issue" ? (
            <ShellPillButton
              type="button"
              tone="outline"
              onClick={() => void onResolveIssue(record)}
              disabled={busyActionKey.length > 0}
            >
              <ShellActionStateLabel
                busy={busyActionKey === resolveActionKey}
                idleLabel="Resolve issue"
                busyLabel="Resolve issue"
                icon={<CheckCheck className="h-4 w-4" />}
              />
            </ShellPillButton>
          ) : null}
          {record.type === "approval" ? (
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
                  icon={<CheckCheck className="h-4 w-4" />}
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
                  icon={<ShieldAlert className="h-4 w-4" />}
                />
              </ShellPillButton>
            </>
          ) : null}
          {record.type === "runtime" ? (
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
                  icon={<CheckCheck className="h-4 w-4" />}
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
                  icon={<ShieldAlert className="h-4 w-4" />}
                />
              </ShellPillButton>
            </>
          ) : null}
        </ShellRecordActionBar>
      </ShellRecordBody>
    </ShellRecordCard>
  );
}

export function ReviewWorkspace({
  initialSnapshot,
  initialPreferences,
  initialLane = "all",
  initialPreset = null,
  routeScope = { projectId: "", intakeSessionId: "" },
}: {
  initialSnapshot?: ShellReviewCenterSnapshot | null;
  initialPreferences?: ShellPreferences;
  initialLane?: ShellReviewCenterLane;
  initialPreset?: ShellReviewPreset | null;
  routeScope?: ShellRouteScope;
}) {
  const {
    busyActionKey,
    errorMessage,
    refreshNonce,
    runMutation,
    statusMessage,
  } = useShellRouteMutationRunner<
    AttentionActionResult | DiscoveryMutationEffect | ReviewBatchEffect | ReviewPresetEffect
  >({
    planes: ["discovery", "execution"],
    scope: routeScope,
    source: "review-center",
    reason: "review-center-mutation",
  }, {
    fallbackErrorMessage: "Review action failed.",
  });
  const snapshotRefreshNonce = useShellSnapshotRefreshNonce({
    baseRefreshNonce: refreshNonce,
    invalidation: {
      planes: ["discovery", "execution"],
      scope: routeScope,
    },
    invalidationOptions: {
      ignoreSources: ["review-center"],
      since: initialSnapshot?.generatedAt ?? null,
    },
  });
  const { preferences, updatePreferences } = useShellPreferences(initialPreferences);
  const pollInterval = getShellPollInterval(
    "review_center",
    preferences.refreshProfile
  );
  const loadSnapshot = useCallback(() => fetchShellReviewCenterSnapshot(), []);
  const selectLoadState = useCallback(
    (nextSnapshot: ShellReviewCenterSnapshot) => nextSnapshot.loadState,
    []
  );
  const { loadState, snapshot } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_REVIEW_CENTER_SNAPSHOT,
    initialSnapshot,
    refreshNonce: snapshotRefreshNonce,
    pollIntervalMs: pollInterval,
    loadSnapshot,
    selectLoadState,
  });
  const routeViewKey = `${routeScope.projectId}:${routeScope.intakeSessionId}:${initialLane}:${initialPreset || "none"}`;
  const scopeActive = hasShellRouteScope(routeScope);
  const { normalizedQuery, query, setQuery } = useScopedQuery(routeViewKey);
  const lane = initialLane;
  const preset = initialPreset;
  const availableChains = useMemo(
    () =>
      snapshot.discovery.records
        .map((record) => record.chain)
        .filter((record): record is NonNullable<typeof record> => Boolean(record)),
    [snapshot.discovery.records]
  );
  const scopedDiscoveryRecords = useMemo(
    () =>
      scopeActive
        ? snapshot.discovery.records.filter(
            (record) =>
              Boolean(record.chain) &&
              matchesShellChainRouteScope(record.chain!, routeScope)
          )
        : snapshot.discovery.records,
    [routeScope, scopeActive, snapshot.discovery.records]
  );
  const scopedExecutionRecords = useMemo(
    () =>
      snapshot.execution.records.filter((record) =>
        matchesAttentionRouteScope(record, routeScope)
      ),
    [routeScope, snapshot.execution.records]
  );
  const reviewMemoryBucket = useMemo(
    () =>
      resolveReviewMemoryBucket({
        scope: routeScope,
        chainRecords: availableChains,
        executionChainKinds: scopedExecutionRecords.map(
          (record) => record.source.chainKind
        ),
      }),
    [availableChains, routeScope, scopedExecutionRecords]
  );
  const rememberedReviewPass = useMemo(
    () => resolveRememberedReviewPass(preferences, reviewMemoryBucket),
    [preferences, reviewMemoryBucket]
  );
  const defaultReviewPass = useMemo(
    () => defaultRememberedReviewPass(reviewMemoryBucket),
    [reviewMemoryBucket]
  );
  const scopedDiscoveryStats = useMemo(
    () => buildDiscoveryReviewStatsFromRecords(scopedDiscoveryRecords),
    [scopedDiscoveryRecords]
  );
  const scopedExecutionStats = useMemo(
    () => buildExecutionReviewRollupFromAttentionRecords(scopedExecutionRecords),
    [scopedExecutionRecords]
  );
  const filteredDiscoveryRecords = useMemo(
    () =>
      scopedDiscoveryRecords.filter((record) => {
        if (!matchesReviewCenterDiscoveryLane(record, lane)) {
          return false;
        }
        if (!normalizedQuery) {
          return true;
        }
        return record.searchText.includes(normalizedQuery);
      }),
    [lane, normalizedQuery, scopedDiscoveryRecords]
  );
  const filteredExecutionRecords = useMemo(
    () =>
      scopedExecutionRecords.filter((record) => {
        if (!matchesReviewCenterExecutionLane(record, lane)) {
          return false;
        }
        if (!normalizedQuery) {
          return true;
        }
        return record.searchText.includes(normalizedQuery);
      }),
    [lane, normalizedQuery, scopedExecutionRecords]
  );
  const filteredIssueRecords = useMemo(
    () =>
      filteredExecutionRecords.filter(
        (record): record is IssueAttentionRecord => record.type === "issue"
      ),
    [filteredExecutionRecords]
  );
  const filteredApprovalRecords = useMemo(
    () =>
      filteredExecutionRecords.filter(
        (record): record is ApprovalAttentionRecord => record.type === "approval"
      ),
    [filteredExecutionRecords]
  );
  const filteredRuntimeRecords = useMemo(
    () =>
      filteredExecutionRecords.filter(
        (record): record is RuntimeAttentionRecord => record.type === "runtime"
      ),
    [filteredExecutionRecords]
  );
  const filteredHandoffReadyRecords = useMemo(
    () =>
      filteredDiscoveryRecords.filter(
        (record) =>
          record.kind === "handoff-ready" &&
          Boolean(record.dossier.execution_brief_candidate)
      ),
    [filteredDiscoveryRecords]
  );
  const filteredCriticalIssueRecords = useMemo(
    () =>
      filteredIssueRecords.filter(
        (record) => record.issue.severity === "critical"
      ),
    [filteredIssueRecords]
  );
  const presetCounts = useMemo(
    () => ({
      "discovery-pass": countReviewPresetMatches("discovery-pass", {
        discoveryRecords: filteredDiscoveryRecords,
        issueRecords: filteredIssueRecords,
        criticalIssueRecords: filteredCriticalIssueRecords,
        approvalRecords: filteredApprovalRecords,
        runtimeRecords: filteredRuntimeRecords,
      }),
      "critical-pass": countReviewPresetMatches("critical-pass", {
        discoveryRecords: filteredDiscoveryRecords,
        issueRecords: filteredIssueRecords,
        criticalIssueRecords: filteredCriticalIssueRecords,
        approvalRecords: filteredApprovalRecords,
        runtimeRecords: filteredRuntimeRecords,
      }),
      "decision-pass": countReviewPresetMatches("decision-pass", {
        discoveryRecords: filteredDiscoveryRecords,
        issueRecords: filteredIssueRecords,
        criticalIssueRecords: filteredCriticalIssueRecords,
        approvalRecords: filteredApprovalRecords,
        runtimeRecords: filteredRuntimeRecords,
      }),
      "chain-pass": countReviewPresetMatches("chain-pass", {
        discoveryRecords: filteredDiscoveryRecords,
        issueRecords: filteredIssueRecords,
        criticalIssueRecords: filteredCriticalIssueRecords,
        approvalRecords: filteredApprovalRecords,
        runtimeRecords: filteredRuntimeRecords,
      }),
    }),
    [
      filteredApprovalRecords,
      filteredCriticalIssueRecords,
      filteredDiscoveryRecords,
      filteredIssueRecords,
      filteredRuntimeRecords,
    ]
  );
  const isCurrentPassRemembered =
    rememberedReviewPass.lane === lane && rememberedReviewPass.preset === preset;
  const isMemoryAtDefault =
    rememberedReviewPass.lane === defaultReviewPass.lane &&
    rememberedReviewPass.preset === defaultReviewPass.preset;
  const selectionViewKey = `${routeViewKey}:${normalizedQuery}`;
  const {
    clearProcessedSelection,
    clearSelection,
    replaceSelectedKeys,
    selectedKeySet,
    toggleSelectedKey,
  } = useScopedSelection(selectionViewKey);
  const selectedDiscoveryRecords = useMemo(
    () => filteredDiscoveryRecords.filter((record) => selectedKeySet.has(record.key)),
    [filteredDiscoveryRecords, selectedKeySet]
  );
  const selectedExecutionRecords = useMemo(
    () => filteredExecutionRecords.filter((record) => selectedKeySet.has(record.key)),
    [filteredExecutionRecords, selectedKeySet]
  );
  const selectedIssueRecords = useMemo(
    () =>
      selectedExecutionRecords.filter(
        (record): record is IssueAttentionRecord => record.type === "issue"
      ),
    [selectedExecutionRecords]
  );
  const selectedApprovalRecords = useMemo(
    () =>
      selectedExecutionRecords.filter(
        (record): record is ApprovalAttentionRecord => record.type === "approval"
      ),
    [selectedExecutionRecords]
  );
  const selectedRuntimeRecords = useMemo(
    () =>
      selectedExecutionRecords.filter(
        (record): record is RuntimeAttentionRecord => record.type === "runtime"
      ),
    [selectedExecutionRecords]
  );
  const selectedCriticalIssueRecords = useMemo(
    () =>
      selectedIssueRecords.filter((record) => record.issue.severity === "critical"),
    [selectedIssueRecords]
  );
  const selectedHandoffReadyRecords = useMemo(
    () =>
      selectedDiscoveryRecords.filter(
        (record) =>
          record.kind === "handoff-ready" &&
          Boolean(record.dossier.execution_brief_candidate)
      ),
    [selectedDiscoveryRecords]
  );
  const visibleRecordKeys = useMemo(
    () => [
      ...filteredDiscoveryRecords.map((record) => record.key),
      ...filteredExecutionRecords.map((record) => record.key),
    ],
    [filteredDiscoveryRecords, filteredExecutionRecords]
  );
  const filters: Array<{
    key: ShellReviewCenterLane;
    label: string;
    count: number;
  }> = [
    {
      key: "all",
      label: "All",
      count: scopedDiscoveryStats.totalCount + scopedExecutionStats.totalCount,
    },
    { key: "discovery", label: "Discovery", count: scopedDiscoveryStats.totalCount },
    { key: "execution", label: "Execution", count: scopedExecutionStats.totalCount },
    { key: "authoring", label: "Authoring", count: scopedDiscoveryStats.authoringCount },
    { key: "handoff", label: "Handoff", count: scopedDiscoveryStats.handoffReadyCount },
    { key: "issues", label: "Issues", count: scopedExecutionStats.issueCount },
    { key: "decisions", label: "Decisions", count: scopedExecutionStats.decisionCount },
    { key: "runtimes", label: "Tool review", count: scopedExecutionStats.runtimeCount },
    { key: "critical", label: "Critical", count: scopedExecutionStats.criticalIssueCount },
    { key: "linked", label: "Linked", count: scopedDiscoveryStats.linkedCount + scopedExecutionStats.chainLinkedCount },
  ];
  const handleConfirmDiscovery = useCallback(
    async (record: ShellDiscoveryReviewRecord) => {
      await runDiscoveryReviewMutation({
        action: "confirm",
        actionKey: `${record.key}:confirm`,
        record,
        routeScope,
        runMutation,
        source: "review-center",
      });
    },
    [routeScope, runMutation]
  );
  const handleReopenDiscovery = useCallback(
    async (record: ShellDiscoveryReviewRecord) => {
      await runDiscoveryReviewMutation({
        action: "reopen",
        actionKey: `${record.key}:reopen`,
        record,
        routeScope,
        runMutation,
        source: "review-center",
      });
    },
    [routeScope, runMutation]
  );
  const handleOpenDiscoveryHandoff = useCallback(
    async (record: ShellDiscoveryReviewRecord) => {
      await runDiscoveryReviewMutation({
        action: "open-handoff",
        actionKey: `${record.key}:handoff`,
        record,
        routeScope,
        runMutation,
        source: "review-center",
      });
    },
    [routeScope, runMutation]
  );
  const handleResolveIssue = useCallback(
    async (record: IssueAttentionRecord) => {
      await runExecutionAttentionMutation({
        action: "resolve-issue",
        actionKey: `${record.key}:resolve`,
        record,
        routeScope,
        runMutation,
        source: "review-center",
      });
    },
    [routeScope, runMutation]
  );
  const handleApprove = useCallback(
    async (record: ApprovalAttentionRecord) => {
      await runExecutionAttentionMutation({
        action: "approve",
        actionKey: `${record.key}:approve`,
        record,
        routeScope,
        runMutation,
        source: "review-center",
      });
    },
    [routeScope, runMutation]
  );
  const handleReject = useCallback(
    async (record: ApprovalAttentionRecord) => {
      await runExecutionAttentionMutation({
        action: "reject",
        actionKey: `${record.key}:reject`,
        record,
        routeScope,
        runMutation,
        source: "review-center",
      });
    },
    [routeScope, runMutation]
  );
  const handleAllow = useCallback(
    async (record: RuntimeAttentionRecord) => {
      await runExecutionAttentionMutation({
        action: "allow",
        actionKey: `${record.key}:allow`,
        record,
        routeScope,
        runMutation,
        source: "review-center",
      });
    },
    [routeScope, runMutation]
  );
  const handleDeny = useCallback(
    async (record: RuntimeAttentionRecord) => {
      await runExecutionAttentionMutation({
        action: "deny",
        actionKey: `${record.key}:deny`,
        record,
        routeScope,
        runMutation,
        source: "review-center",
      });
    },
    [routeScope, runMutation]
  );
  const handleBatchConfirmDiscovery = useCallback(async () => {
    await runDiscoveryReviewBatchMutation({
      action: "confirm",
      actionKey: "batch:discovery-confirm",
      records: selectedDiscoveryRecords,
      routeScope,
      runMutation,
      source: "review-center",
      onProcessedKeys: clearProcessedSelection,
    });
  }, [clearProcessedSelection, routeScope, runMutation, selectedDiscoveryRecords]);
  const handleBatchReopenDiscovery = useCallback(async () => {
    await runDiscoveryReviewBatchMutation({
      action: "reopen",
      actionKey: "batch:discovery-reopen",
      records: selectedDiscoveryRecords,
      routeScope,
      runMutation,
      source: "review-center",
      onProcessedKeys: clearProcessedSelection,
    });
  }, [clearProcessedSelection, routeScope, runMutation, selectedDiscoveryRecords]);
  const handleBatchResolveIssues = useCallback(async () => {
    await runExecutionReviewBatchMutation({
      action: "resolve-issue",
      actionKey: "batch:execution-resolve-issue",
      records: selectedIssueRecords,
      routeScope,
      runMutation,
      source: "review-center",
      onProcessedKeys: clearProcessedSelection,
    });
  }, [clearProcessedSelection, routeScope, runMutation, selectedIssueRecords]);
  const handleBatchApprove = useCallback(async () => {
    await runExecutionReviewBatchMutation({
      action: "approve",
      actionKey: "batch:execution-approve",
      records: selectedApprovalRecords,
      routeScope,
      runMutation,
      source: "review-center",
      onProcessedKeys: clearProcessedSelection,
    });
  }, [clearProcessedSelection, routeScope, runMutation, selectedApprovalRecords]);
  const handleBatchReject = useCallback(async () => {
    await runExecutionReviewBatchMutation({
      action: "reject",
      actionKey: "batch:execution-reject",
      records: selectedApprovalRecords,
      routeScope,
      runMutation,
      source: "review-center",
      onProcessedKeys: clearProcessedSelection,
    });
  }, [clearProcessedSelection, routeScope, runMutation, selectedApprovalRecords]);
  const handleBatchAllow = useCallback(async () => {
    await runExecutionReviewBatchMutation({
      action: "allow",
      actionKey: "batch:execution-allow",
      records: selectedRuntimeRecords,
      routeScope,
      runMutation,
      source: "review-center",
      onProcessedKeys: clearProcessedSelection,
    });
  }, [clearProcessedSelection, routeScope, runMutation, selectedRuntimeRecords]);
  const handleBatchDeny = useCallback(async () => {
    await runExecutionReviewBatchMutation({
      action: "deny",
      actionKey: "batch:execution-deny",
      records: selectedRuntimeRecords,
      routeScope,
      runMutation,
      source: "review-center",
      onProcessedKeys: clearProcessedSelection,
    });
  }, [clearProcessedSelection, routeScope, runMutation, selectedRuntimeRecords]);
  const handleRunPreset = useCallback(
    async (nextPreset: ShellReviewPreset) => {
      await runMutation(
        `preset:${nextPreset}`,
        () =>
          runReviewPresetAction({
            preset: nextPreset,
            buckets: {
              discoveryRecords: filteredDiscoveryRecords,
              issueRecords: filteredIssueRecords,
              criticalIssueRecords: filteredCriticalIssueRecords,
              approvalRecords: filteredApprovalRecords,
              runtimeRecords: filteredRuntimeRecords,
            },
            routeScope,
            source: "review-center",
          }),
        {
          onSuccess: (effect) => clearProcessedSelection(effect.data.processedKeys),
        }
      );
    },
    [
      clearProcessedSelection,
      filteredApprovalRecords,
      filteredCriticalIssueRecords,
      filteredDiscoveryRecords,
      filteredIssueRecords,
      filteredRuntimeRecords,
      routeScope,
      runMutation,
    ]
  );
  const handleRememberCurrentPass = useCallback(() => {
    updatePreferences({
      reviewMemory: updateRememberedReviewPass(
        preferences.reviewMemory,
        reviewMemoryBucket,
        {
          lane,
          preset,
        }
      ),
    });
  }, [lane, preferences.reviewMemory, preset, reviewMemoryBucket, updatePreferences]);
  const handleResetRememberedPass = useCallback(() => {
    updatePreferences({
      reviewMemory: updateRememberedReviewPass(
        preferences.reviewMemory,
        reviewMemoryBucket,
        defaultReviewPass
      ),
    });
  }, [
    defaultReviewPass,
    preferences.reviewMemory,
    reviewMemoryBucket,
    updatePreferences,
  ]);

  return (
    <ShellPage>
      <ShellHero title="Review" />

      {snapshot.errors.length > 0 ? (
        <ShellStatusBanner tone="warning">{snapshot.errors.join(" ")}</ShellStatusBanner>
      ) : null}

      {statusMessage ? (
        <ShellStatusBanner tone="success">{statusMessage}</ShellStatusBanner>
      ) : null}

      {errorMessage ? (
        <ShellStatusBanner tone="danger">{errorMessage}</ShellStatusBanner>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {filters.map((option) => (
              <ShellFilterChipLink
                key={option.key}
                href={buildReviewScopeHref(
                  routeScope,
                  option.key === "all" ? null : option.key,
                  preset
                )}
                label={option.label}
                count={option.count}
                active={lane === option.key}
              />
            ))}
          </div>

          <div className="flex h-8 items-center gap-2 rounded-md border border-border px-2.5 focus-within:ring-2 focus-within:ring-primary/20">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter review items..."
              className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>

          {loadState === "loading" &&
          filteredDiscoveryRecords.length === 0 &&
          filteredExecutionRecords.length === 0 ? (
            <SkeletonList rows={6} className="py-4" />
          ) : null}

          {filteredDiscoveryRecords.length > 0 ? (
            <ShellSectionCard
              title="Discovery review pressure"
              contentClassName="space-y-4"
            >
                {filteredDiscoveryRecords.map((record) => (
                  <DiscoveryReviewCard
                    key={record.key}
                    record={record}
                    routeScope={routeScope}
                    selected={selectedKeySet.has(record.key)}
                    busyActionKey={busyActionKey}
                    onConfirm={handleConfirmDiscovery}
                    onToggleSelected={toggleSelectedKey}
                    onReopen={handleReopenDiscovery}
                    onOpenHandoff={handleOpenDiscoveryHandoff}
                  />
                ))}
            </ShellSectionCard>
          ) : null}

          {filteredExecutionRecords.length > 0 ? (
            <ShellSectionCard
              title="Execution review pressure"
              contentClassName="space-y-4"
            >
                {filteredExecutionRecords.map((record) => (
                  <ExecutionReviewCard
                    key={record.key}
                    record={record}
                    routeScope={routeScope}
                    selected={selectedKeySet.has(record.key)}
                    busyActionKey={busyActionKey}
                    onResolveIssue={handleResolveIssue}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onAllow={handleAllow}
                    onDeny={handleDeny}
                    onToggleSelected={toggleSelectedKey}
                  />
                ))}
            </ShellSectionCard>
          ) : null}

          {loadState !== "loading" &&
          filteredDiscoveryRecords.length === 0 &&
          filteredExecutionRecords.length === 0 ? (
            <ShellEmptyState
              centered
              className="py-10"
              description={
                scopeActive
                  ? "No review records match the current route scope and lane."
                  : "No review records match the current lane."
              }
            />
          ) : null}
        </div>

        <div className="space-y-4">
          <ReviewPresetPanel
            activePreset={preset}
            busyActionKey={busyActionKey}
            lane={lane}
            memoryBucket={reviewMemoryBucket}
            rememberedPassLabel={describeReviewPassPreference(rememberedReviewPass)}
            rememberCurrentPassLabel={`Remember ${reviewMemoryBucketLabel(reviewMemoryBucket)} pass`}
            isCurrentPassRemembered={isCurrentPassRemembered}
            isMemoryAtDefault={isMemoryAtDefault}
            presetCounts={presetCounts}
            routeScope={routeScope}
            onRememberCurrentPass={handleRememberCurrentPass}
            onResetRememberedPass={handleResetRememberedPass}
            onRunPreset={handleRunPreset}
          />

          <ReviewBatchPanel
            busyActionKey={busyActionKey}
            selectedCount={selectedDiscoveryRecords.length + selectedExecutionRecords.length}
            selectedDiscoveryCount={selectedDiscoveryRecords.length}
            selectedExecutionCount={selectedExecutionRecords.length}
            selectedIssueCount={selectedIssueRecords.length}
            selectedApprovalCount={selectedApprovalRecords.length}
            selectedRuntimeCount={selectedRuntimeRecords.length}
            selectedCriticalIssueCount={selectedCriticalIssueRecords.length}
            selectedHandoffCount={selectedHandoffReadyRecords.length}
            visibleDiscoveryCount={filteredDiscoveryRecords.length}
            visibleExecutionCount={filteredExecutionRecords.length}
            visibleCount={visibleRecordKeys.length}
            visibleCriticalIssueCount={filteredCriticalIssueRecords.length}
            visibleHandoffCount={filteredHandoffReadyRecords.length}
            onBatchAllow={handleBatchAllow}
            onBatchApprove={handleBatchApprove}
            onBatchConfirmDiscovery={handleBatchConfirmDiscovery}
            onBatchDeny={handleBatchDeny}
            onBatchReject={handleBatchReject}
            onBatchReopenDiscovery={handleBatchReopenDiscovery}
            onBatchResolveIssues={handleBatchResolveIssues}
            onClearSelection={clearSelection}
            onSelectCriticalIssues={() =>
              replaceSelectedKeys(filteredCriticalIssueRecords.map((record) => record.key))
            }
            onSelectDiscoveryVisible={() =>
              replaceSelectedKeys(filteredDiscoveryRecords.map((record) => record.key))
            }
            onSelectExecutionVisible={() =>
              replaceSelectedKeys(filteredExecutionRecords.map((record) => record.key))
            }
            onSelectHandoffReady={() =>
              replaceSelectedKeys(filteredHandoffReadyRecords.map((record) => record.key))
            }
            onSelectVisible={() => replaceSelectedKeys(visibleRecordKeys)}
          />

        </div>
      </section>
    </ShellPage>
  );
}
