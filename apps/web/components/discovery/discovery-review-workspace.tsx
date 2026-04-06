"use client";

import type { ShellPreferences } from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import {
  Orbit,
  PencilLine,
  ShieldAlert,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { ReviewMemoryCard } from "@/components/review/review-memory-panel";
import {
  ShellActionStateLabel,
  ShellComposerTextarea,
  ShellEmptyState,
  ShellFilterChipLink,
  ShellLoadingState,
  ShellMetricCard,
  ShellPage,
  ShellPillButton,
  ShellPillCount,
  ShellRefreshButton,
  ShellRefreshStateCard,
  ShellQueueSectionCard,
  ShellSelectionSummary,
  ShellSectionCard,
  ShellStatusBanner,
} from "@/components/shell/shell-screen-primitives";
import {
  ShellRecordAccessory,
  ShellRecordActionBar,
  ShellRecordBody,
  ShellRecordCard,
  ShellRecordHeader,
  ShellRecordLinkButton,
  ShellRecordSection,
  ShellRecordSelectionButton,
} from "@/components/shell/shell-record-primitives";
import {
  matchesShellChainRouteScope,
  resolveScopedShellChainIntakeSessionId,
  shellChainRouteScope,
} from "@/lib/chain-graph";
import {
  type DiscoveryMutationEffect,
} from "@/lib/discovery-mutations";
import {
  discoveryAuthoringGapLabel,
  discoveryAuthoringStatusTone,
} from "@/lib/discovery-authoring";
import {
  buildDiscoveryReviewStatsFromRecords,
  matchesDiscoveryReviewFilter,
  type DiscoveryReviewFilter,
} from "@/lib/discovery-review-model";
import type {
  ShellDiscoveryReviewKind,
  ShellDiscoveryReviewRecord,
  ShellDiscoveryReviewSnapshot,
} from "@/lib/discovery-review";
import type { ReviewBatchEffect } from "@/lib/review-batch-actions";
import {
  runDiscoveryReviewBatchMutation,
  runDiscoveryReviewMutation,
} from "@/lib/review-discovery-actions";
import {
  defaultRememberedReviewPass,
  describeReviewPassPreference,
  resolveRememberedReviewPass,
  resolveReviewMemoryBucket,
  reviewMemoryBucketLabel,
  reviewPassFromDiscoveryReviewFilter,
  updateRememberedReviewPass,
} from "@/lib/review-memory";
import { buildShellEntrySettingsHref } from "@/lib/shell-entry-hrefs";
import { fetchShellDiscoveryReviewSnapshot } from "@/lib/shell-snapshot-client";
import {
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import { useScopedQuery } from "@/lib/use-scoped-query";
import {
  buildDiscoveryAuthoringScopeHref,
  buildDiscoveryBoardScopeHref,
  buildDiscoveryIdeaAuthoringScopeHref,
  buildDiscoveryIdeaScopeHref,
  buildDiscoveryReplayScopeHref,
  buildDiscoveryReviewScopeHref,
  buildDiscoveryTraceIdeaScopeHref,
  buildReviewScopeHref,
  buildExecutionIntakeScopeHref,
  buildExecutionProjectScopeHref,
  buildInboxScopeHref,
  hasShellRouteScope,
  type ShellRouteScope,
} from "@/lib/route-scope";
import { shellSettingsParityTargetsFromDiscoveryReviewRecord } from "@/lib/settings-parity-targets";
import { useShellManualRefresh } from "@/lib/use-shell-manual-refresh";
import { useShellRouteMutationRunner } from "@/lib/use-shell-route-mutation-runner";
import { useShellSnapshotRefreshNonce } from "@/lib/use-shell-snapshot-refresh-nonce";
import { useScopedSelection } from "@/lib/use-scoped-selection";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";

type DiscoveryReviewRouteScope = ShellRouteScope;

const EMPTY_DISCOVERY_REVIEW_SNAPSHOT: ShellDiscoveryReviewSnapshot = {
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
};

function formatDate(value?: string | null) {
  if (!value) return "n/a";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function truncate(value: string, limit: number = 180) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= limit) {
    return compact;
  }
  return `${compact.slice(0, limit - 1).trimEnd()}...`;
}

function stageTone(stage: string) {
  if (stage === "executed") return "success" as const;
  if (stage === "handed_off") return "info" as const;
  if (stage === "simulated" || stage === "debated") return "warning" as const;
  return "neutral" as const;
}

function reviewKindLabel(kind: ShellDiscoveryReviewKind) {
  if (kind === "trace-review") return "trace review";
  if (kind === "handoff-ready") return "handoff ready";
  if (kind === "execution-followthrough") return "execution follow-through";
  return "authoring";
}

function reviewKindTone(kind: ShellDiscoveryReviewKind) {
  if (kind === "authoring") return "warning" as const;
  if (kind === "trace-review") return "info" as const;
  if (kind === "handoff-ready") return "success" as const;
  return "neutral" as const;
}

function reviewConfirmLabel(kind: ShellDiscoveryReviewKind) {
  if (kind === "trace-review") return "Confirm trace review";
  if (kind === "handoff-ready") return "Confirm handoff ready";
  if (kind === "execution-followthrough") return "Confirm follow-through";
  return "Confirm needs work";
}

function reviewReopenLabel(kind: ShellDiscoveryReviewKind) {
  if (kind === "trace-review") return "Reopen trace review";
  if (kind === "handoff-ready") return "Reopen handoff review";
  if (kind === "execution-followthrough") return "Reopen follow-through";
  return "Reopen authoring review";
}

function DiscoveryReviewBatchPanel({
  busyActionKey,
  selectedAuthoringCount,
  selectedCount,
  selectedHandoffCount,
  selectedReplayCount,
  selectedTraceCount,
  visibleAuthoringCount,
  visibleCount,
  visibleHandoffCount,
  visibleReplayCount,
  visibleTraceCount,
  onBatchConfirm,
  onBatchReopen,
  onClearSelection,
  onSelectAuthoring,
  onSelectHandoffReady,
  onSelectReplayLinked,
  onSelectTrace,
  onSelectVisible,
}: {
  busyActionKey: string;
  selectedAuthoringCount: number;
  selectedCount: number;
  selectedHandoffCount: number;
  selectedReplayCount: number;
  selectedTraceCount: number;
  visibleAuthoringCount: number;
  visibleCount: number;
  visibleHandoffCount: number;
  visibleReplayCount: number;
  visibleTraceCount: number;
  onBatchConfirm: () => Promise<void>;
  onBatchReopen: () => Promise<void>;
  onClearSelection: () => void;
  onSelectAuthoring: () => void;
  onSelectHandoffReady: () => void;
  onSelectReplayLinked: () => void;
  onSelectTrace: () => void;
  onSelectVisible: () => void;
}) {
  const batchBusy = busyActionKey.startsWith("batch:");

  return (
    <ShellSectionCard
      title="Act on the visible discovery queue"
      description="Batch triage"
      contentClassName="space-y-4"
    >
        <ShellSelectionSummary
          className="bg-background/70"
          summary={
            <>
              Selected <span className="font-semibold text-foreground">{selectedCount}</span> of{" "}
              <span className="font-semibold text-foreground">{visibleCount}</span> visible
              discovery review records.
            </>
          }
          detail={
            <>
              Authoring {selectedAuthoringCount}, trace {selectedTraceCount}, handoff-ready{" "}
              {selectedHandoffCount}, replay-linked {selectedReplayCount}.
            </>
          }
        />

        <div className="flex flex-wrap gap-2">
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
            active={selectedAuthoringCount > 0 && selectedCount === selectedAuthoringCount}
            onClick={onSelectAuthoring}
            disabled={batchBusy || visibleAuthoringCount === 0}
          >
            <span>Authoring</span>
            <ShellPillCount
              count={visibleAuthoringCount}
              active={selectedAuthoringCount > 0 && selectedCount === selectedAuthoringCount}
            />
          </ShellPillButton>
          <ShellPillButton
            type="button"
            tone="outline"
            active={selectedTraceCount > 0 && selectedCount === selectedTraceCount}
            onClick={onSelectTrace}
            disabled={batchBusy || visibleTraceCount === 0}
          >
            <span>Trace</span>
            <ShellPillCount
              count={visibleTraceCount}
              active={selectedTraceCount > 0 && selectedCount === selectedTraceCount}
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
            active={selectedReplayCount > 0 && selectedCount === selectedReplayCount}
            onClick={onSelectReplayLinked}
            disabled={batchBusy || visibleReplayCount === 0}
          >
            <span>Replay linked</span>
            <ShellPillCount
              count={visibleReplayCount}
              active={selectedReplayCount > 0 && selectedCount === selectedReplayCount}
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
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Batch actions
          </div>
          <div className="flex flex-wrap gap-2">
            <ShellPillButton
              type="button"
              tone="primary"
              onClick={() => void onBatchConfirm()}
              disabled={busyActionKey.length > 0 || selectedCount === 0}
            >
              <ShellActionStateLabel
                busy={busyActionKey === "batch:discovery-confirm"}
                idleLabel="Confirm selected"
                busyLabel="Confirm selected"
                icon={<PencilLine className="h-4 w-4" />}
              />
            </ShellPillButton>
            <ShellPillButton
              type="button"
              tone="outline"
              onClick={() => void onBatchReopen()}
              disabled={busyActionKey.length > 0 || selectedCount === 0}
            >
              <ShellActionStateLabel
                busy={busyActionKey === "batch:discovery-reopen"}
                idleLabel="Reopen selected"
                busyLabel="Reopen selected"
                icon={<ShieldAlert className="h-4 w-4" />}
              />
            </ShellPillButton>
          </div>
        </div>
    </ShellSectionCard>
  );
}

function ReviewRecordCard({
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
  routeScope: DiscoveryReviewRouteScope;
  selected: boolean;
  busyActionKey: string;
  onConfirm: (record: ShellDiscoveryReviewRecord, note: string) => void;
  onToggleSelected: (recordKey: string) => void;
  onReopen: (record: ShellDiscoveryReviewRecord, note: string) => void;
  onOpenHandoff: (record: ShellDiscoveryReviewRecord) => void;
}) {
  const [note, setNote] = useState("");
  const scopedRoute = record.chain
    ? shellChainRouteScope(record.chain, routeScope)
    : routeScope;
  const authoringHref = buildDiscoveryIdeaAuthoringScopeHref(
    record.dossier.idea.idea_id,
    scopedRoute
  );
  const dossierHref = buildDiscoveryIdeaScopeHref(record.dossier.idea.idea_id, scopedRoute);
  const traceHref = buildDiscoveryTraceIdeaScopeHref(
    record.dossier.idea.idea_id,
    scopedRoute
  );
  const replayHref = record.trace?.linkedSessionIds[0]
    ? buildDiscoveryReplayScopeHref(record.trace.linkedSessionIds[0], scopedRoute)
    : null;
  const confirmActionKey = `review:${record.key}:confirm`;
  const reopenActionKey = `review:${record.key}:reopen`;
  const handoffActionKey = `review:${record.key}:handoff`;
  const canOpenHandoff =
    record.kind === "handoff-ready" &&
    Boolean(record.dossier.execution_brief_candidate);
  const settingsHref = buildShellEntrySettingsHref(
    scopedRoute,
    shellSettingsParityTargetsFromDiscoveryReviewRecord(record)
  );

  return (
    <ShellRecordCard selected={selected}>
      <ShellRecordHeader
        badges={
          <>
            <Badge tone={stageTone(record.dossier.idea.latest_stage)}>
              {record.dossier.idea.latest_stage}
            </Badge>
            <Badge tone={reviewKindTone(record.kind)}>
              {reviewKindLabel(record.kind)}
            </Badge>
            <Badge tone={discoveryAuthoringStatusTone(record.chain?.authoring.status || "thin")}>
              authoring {record.chain?.authoring.status || "thin"}
            </Badge>
            {record.chain ? <Badge tone="info">chain-linked</Badge> : null}
            {(record.chain?.attention?.total ?? 0) > 0 ? (
              <Badge tone="warning">{record.chain?.attention?.total} attention</Badge>
            ) : null}
            {(record.trace?.linkedSessionIds.length ?? 0) > 0 ? (
              <Badge tone="neutral">{record.trace?.linkedSessionIds.length} replays</Badge>
            ) : null}
          </>
        }
        title={record.dossier.idea.title}
        description={truncate(record.reason, 260)}
        accessory={
          <div className="flex flex-col items-end gap-2">
            <ShellRecordSelectionButton
              selected={selected}
              disabled={busyActionKey.length > 0}
              onClick={() => onToggleSelected(record.key)}
              label={selected ? "Selected for batch triage" : "Select for batch triage"}
            />
            <ShellRecordAccessory
              label="Next step"
              value={record.recommendedAction}
              className="max-w-[240px]"
              align="left"
            />
          </div>
        }
      />

      <ShellRecordBody>
        <ShellRecordSection
          title="Recommended action"
          className="bg-[color:var(--shell-panel-muted)]/40"
        >
          <div className="text-[13px] leading-6 text-muted-foreground">
            {record.recommendedAction}
          </div>
        </ShellRecordSection>

        <ShellRecordSection
          title="Operator action lane"
          className="bg-[color:var(--shell-panel-muted)]/34"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[12px] leading-5 text-muted-foreground">
              Confirm writes a discovery decision, reopen writes a timeline event,
              and handoff-ready records can open execution review directly from this route.
            </div>
            <Badge tone="info">shell-owned review actions</Badge>
          </div>
          <div className="mt-3">
            <ShellComposerTextarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional note to persist with the confirm or reopen action"
              className="min-h-[96px]"
            />
          </div>
          <ShellRecordActionBar className="mt-3">
            <ShellPillButton
              type="button"
              tone="primary"
              onClick={() => onConfirm(record, note)}
              disabled={busyActionKey === confirmActionKey}
            >
              <ShellActionStateLabel
                busy={busyActionKey === confirmActionKey}
                idleLabel={reviewConfirmLabel(record.kind)}
                busyLabel={reviewConfirmLabel(record.kind)}
              />
            </ShellPillButton>
            <ShellPillButton
              type="button"
              tone="outline"
              onClick={() => onReopen(record, note)}
              disabled={busyActionKey === reopenActionKey}
            >
              <ShellActionStateLabel
                busy={busyActionKey === reopenActionKey}
                idleLabel={reviewReopenLabel(record.kind)}
                busyLabel={reviewReopenLabel(record.kind)}
              />
            </ShellPillButton>
            {canOpenHandoff ? (
              <ShellPillButton
                type="button"
                tone="outline"
                onClick={() => onOpenHandoff(record)}
                disabled={busyActionKey === handoffActionKey}
              >
                <ShellActionStateLabel
                  busy={busyActionKey === handoffActionKey}
                  idleLabel="Open in execution"
                  busyLabel="Open in execution"
                />
              </ShellPillButton>
            ) : null}
          </ShellRecordActionBar>
        </ShellRecordSection>

        <div className="grid gap-3 xl:grid-cols-3">
          <ShellRecordSection title="Authoring coverage">
            <div className="flex flex-wrap gap-2">
              {(record.chain?.authoring.gaps ?? []).length > 0 ? (
                (record.chain?.authoring.gaps ?? []).map((gap) => (
                  <Badge key={gap} tone="warning">
                    {discoveryAuthoringGapLabel(gap)}
                  </Badge>
                ))
              ) : (
                <Badge tone="success">ready</Badge>
              )}
            </div>
            <div className="mt-2 text-[12px] leading-5 text-muted-foreground">
              {record.chain?.authoring.detail ||
                "Authoring readiness is derived from dossier evidence, validation, decisions, and timeline coverage."}
            </div>
          </ShellRecordSection>

          <ShellRecordSection title="Trace signal">
            <div className="space-y-1.5 text-[12px] leading-5 text-muted-foreground">
              <div>
                {record.trace
                  ? `${record.trace.stepCount} trace steps · latest ${record.trace.latestKind || "n/a"}`
                  : "No idea-level trace bundle is visible in the current shell snapshot."}
              </div>
              {record.trace ? (
                <div>
                  decision {record.trace.decisionCount} · validation {record.trace.validationCount}
                  {" "}· simulation {record.trace.simulationCount} · ranking {record.trace.rankingCount}
                </div>
              ) : null}
              {record.trace?.latestAt ? (
                <div>updated {formatDate(record.trace.latestAt)}</div>
              ) : null}
            </div>
          </ShellRecordSection>

          <ShellRecordSection title="Replay context">
            <div className="space-y-1.5 text-[12px] leading-5 text-muted-foreground">
              <div>
                {(record.trace?.linkedSessionIds.length ?? 0) > 0
                  ? `${record.trace?.linkedSessionIds.length} linked sessions`
                  : "No linked replay sessions on the current trace bundle."}
              </div>
              {(record.trace?.linkedSessions ?? []).slice(0, 2).map((session) => (
                <div key={session.id}>
                  {truncate(session.task, 100)} · {session.status}
                </div>
              ))}
            </div>
          </ShellRecordSection>
        </div>

        {record.chain ? (
          <ShellRecordSection
            title="Execution-chain context"
            className="bg-[color:var(--shell-panel-muted)]/32"
          >
            <div className="flex flex-wrap gap-2">
              <Badge tone="info">execution-chain context</Badge>
              {record.chain.project ? (
                <Badge tone="neutral">{record.chain.project.name}</Badge>
              ) : null}
              {record.chain.intakeSession ? (
                <Badge tone="neutral">{record.chain.intakeSession.title}</Badge>
              ) : null}
              {record.chain.briefId ? (
                <Badge tone="neutral">brief {truncate(record.chain.briefId, 24)}</Badge>
              ) : null}
            </div>
          </ShellRecordSection>
        ) : null}

        <ShellRecordActionBar>
          <ShellRecordLinkButton href={authoringHref} label="Open authoring route" />
          <ShellRecordLinkButton href={dossierHref} label="Open dossier" />
          <ShellRecordLinkButton href={settingsHref} label="Open scoped settings" />
          <ShellRecordLinkButton href={traceHref} label="Open trace detail" />
          {replayHref ? <ShellRecordLinkButton href={replayHref} label="Open replay" /> : null}
          {record.chain?.project ? (
            <ShellRecordLinkButton
              href={buildExecutionProjectScopeHref(record.chain.project.id, scopedRoute)}
              label="Open execution project"
            />
          ) : null}
          {record.chain?.intakeSessionId ? (
            <ShellRecordLinkButton
              href={buildExecutionIntakeScopeHref(record.chain.intakeSessionId, scopedRoute)}
              label="Open intake session"
            />
          ) : null}
          {record.chain ? (
            <ShellRecordLinkButton
              href={buildInboxScopeHref(scopedRoute)}
              label="Open scoped inbox"
            />
          ) : null}
        </ShellRecordActionBar>
      </ShellRecordBody>
    </ShellRecordCard>
  );
}

export function DiscoveryReviewWorkspace({
  initialSnapshot,
  initialPreferences,
  routeScope,
  initialFilter = "all",
}: {
  initialSnapshot?: ShellDiscoveryReviewSnapshot | null;
  initialPreferences?: ShellPreferences;
  routeScope: DiscoveryReviewRouteScope;
  initialFilter?: DiscoveryReviewFilter;
}) {
  const routeViewKey = `${routeScope.projectId}:${routeScope.intakeSessionId}:${initialFilter}`;
  const { normalizedQuery, query, setQuery } = useScopedQuery(routeViewKey);
  const { isRefreshing, refresh, refreshNonce } = useShellManualRefresh();
  const {
    busyActionKey,
    errorMessage,
    refreshNonce: routeMutationNonce,
    runMutation,
    statusMessage,
  } = useShellRouteMutationRunner<DiscoveryMutationEffect | ReviewBatchEffect>({
    planes: ["discovery", "execution"],
    scope: routeScope,
    source: "discovery-review",
    reason: "discovery-review-mutation",
  }, {
    fallbackErrorMessage: "Review action failed.",
  });
  const snapshotRefreshNonce = useShellSnapshotRefreshNonce({
    additionalRefreshNonce: routeMutationNonce,
    baseRefreshNonce: refreshNonce,
    invalidation: {
      planes: ["discovery", "execution"],
      scope: routeScope,
    },
    invalidationOptions: {
      since: initialSnapshot?.generatedAt ?? null,
    },
  });
  const { preferences, updatePreferences } = useShellPreferences(initialPreferences);
  const pollInterval = getShellPollInterval(
    "discovery_review",
    preferences.refreshProfile
  );
  const loadSnapshot = useCallback(() => fetchShellDiscoveryReviewSnapshot(), []);
  const selectLoadState = useCallback(
    (snapshot: ShellDiscoveryReviewSnapshot) => snapshot.loadState,
    []
  );
  const { loadState, snapshot } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_DISCOVERY_REVIEW_SNAPSHOT,
    initialSnapshot,
    refreshNonce: snapshotRefreshNonce,
    pollIntervalMs: pollInterval,
    loadSnapshot,
    selectLoadState,
  });
  const scopeActive = hasShellRouteScope(routeScope);
  const filter = initialFilter;
  const availableChains = useMemo(
    () =>
      snapshot.records
        .map((record) => record.chain)
        .filter((record): record is NonNullable<typeof record> => Boolean(record)),
    [snapshot.records]
  );
  const derivedScopedIntakeSessionId = useMemo(
    () => resolveScopedShellChainIntakeSessionId(availableChains, routeScope),
    [availableChains, routeScope]
  );
  const reviewMemoryBucket = useMemo(
    () =>
      resolveReviewMemoryBucket({
        scope: {
          projectId: routeScope.projectId,
          intakeSessionId: derivedScopedIntakeSessionId,
        },
        chainRecords: availableChains,
      }),
    [availableChains, derivedScopedIntakeSessionId, routeScope.projectId]
  );
  const routeScopedRecords = useMemo(
    () =>
      scopeActive
        ? snapshot.records.filter(
            (record) =>
              Boolean(record.chain) &&
              matchesShellChainRouteScope(record.chain!, routeScope)
          )
        : snapshot.records,
    [routeScope, scopeActive, snapshot.records]
  );
  const filteredRecords = useMemo(() => {
    return routeScopedRecords.filter((record) => {
      if (!matchesDiscoveryReviewFilter(record, filter)) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      return record.searchText.includes(normalizedQuery);
    });
  }, [filter, normalizedQuery, routeScopedRecords]);
  const filteredAuthoringRecords = useMemo(
    () =>
      filteredRecords.filter((record) => record.kind === "authoring"),
    [filteredRecords]
  );
  const filteredTraceRecords = useMemo(
    () =>
      filteredRecords.filter((record) => record.kind === "trace-review"),
    [filteredRecords]
  );
  const filteredHandoffRecords = useMemo(
    () =>
      filteredRecords.filter((record) => record.kind === "handoff-ready"),
    [filteredRecords]
  );
  const filteredReplayRecords = useMemo(
    () =>
      filteredRecords.filter(
        (record) => (record.trace?.linkedSessionIds.length ?? 0) > 0
      ),
    [filteredRecords]
  );
  const currentReviewPass = useMemo(
    () => reviewPassFromDiscoveryReviewFilter(filter),
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
  const isCurrentReviewRemembered =
    rememberedReviewPass.lane === currentReviewPass.lane &&
    rememberedReviewPass.preset === currentReviewPass.preset;
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
  const selectedRecords = useMemo(
    () => filteredRecords.filter((record) => selectedKeySet.has(record.key)),
    [filteredRecords, selectedKeySet]
  );
  const selectedAuthoringRecords = useMemo(
    () => selectedRecords.filter((record) => record.kind === "authoring"),
    [selectedRecords]
  );
  const selectedTraceRecords = useMemo(
    () => selectedRecords.filter((record) => record.kind === "trace-review"),
    [selectedRecords]
  );
  const selectedHandoffRecords = useMemo(
    () => selectedRecords.filter((record) => record.kind === "handoff-ready"),
    [selectedRecords]
  );
  const selectedReplayRecords = useMemo(
    () =>
      selectedRecords.filter(
        (record) => (record.trace?.linkedSessionIds.length ?? 0) > 0
      ),
    [selectedRecords]
  );
  const visibleRecordKeys = useMemo(
    () => filteredRecords.map((record) => record.key),
    [filteredRecords]
  );
  const stats = useMemo(
    () => buildDiscoveryReviewStatsFromRecords(routeScopedRecords),
    [routeScopedRecords]
  );
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
  const handleResetRememberedFilter = useCallback(() => {
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
  const handleConfirmReview = useCallback(
    (record: ShellDiscoveryReviewRecord, note: string) => {
      void runDiscoveryReviewMutation({
        action: "confirm",
        actionKey: `review:${record.key}:confirm`,
        note,
        record,
        routeScope,
        runMutation,
        source: "discovery-review",
      });
    },
    [routeScope, runMutation]
  );
  const handleReopenReview = useCallback(
    (record: ShellDiscoveryReviewRecord, note: string) => {
      void runDiscoveryReviewMutation({
        action: "reopen",
        actionKey: `review:${record.key}:reopen`,
        note,
        record,
        routeScope,
        runMutation,
        source: "discovery-review",
      });
    },
    [routeScope, runMutation]
  );
  const handleOpenHandoff = useCallback(
    (record: ShellDiscoveryReviewRecord) => {
      void runDiscoveryReviewMutation({
        action: "open-handoff",
        actionKey: `review:${record.key}:handoff`,
        record,
        routeScope,
        runMutation,
        source: "discovery-review",
      });
    },
    [routeScope, runMutation]
  );
  const handleBatchConfirm = useCallback(async () => {
    await runDiscoveryReviewBatchMutation({
      action: "confirm",
      actionKey: "batch:discovery-confirm",
      records: selectedRecords,
      routeScope,
      runMutation,
      source: "discovery-review",
      onProcessedKeys: clearProcessedSelection,
    });
  }, [clearProcessedSelection, routeScope, runMutation, selectedRecords]);
  const handleBatchReopen = useCallback(async () => {
    await runDiscoveryReviewBatchMutation({
      action: "reopen",
      actionKey: "batch:discovery-reopen",
      records: selectedRecords,
      routeScope,
      runMutation,
      source: "discovery-review",
      onProcessedKeys: clearProcessedSelection,
    });
  }, [clearProcessedSelection, routeScope, runMutation, selectedRecords]);

  return (
    <ShellPage>
      <div className="flex items-center justify-end gap-2">
        <ShellRefreshButton type="button" onClick={refresh} busy={isRefreshing} />
        <ShellFilterChipLink
          href={buildDiscoveryAuthoringScopeHref(routeScope)}
          label="Authoring queue"
        />
        <ShellFilterChipLink
          href={buildDiscoveryBoardScopeHref(routeScope)}
          label="Board"
        />
        <ShellFilterChipLink
          href={buildReviewScopeHref(routeScope, "discovery")}
          label="Review center"
        />
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <ShellMetricCard
          label="Review items"
          value={String(stats.totalCount)}
        />
        <ShellMetricCard
          label="Authoring"
          value={String(stats.authoringCount)}
        />
        <ShellMetricCard
          label="Trace review"
          value={String(stats.traceReviewCount)}
        />
        <ShellMetricCard
          label="Handoff ready"
          value={String(stats.handoffReadyCount)}
        />
        <ShellMetricCard
          label="Execution follow-through"
          value={String(stats.executionFollowthroughCount)}
        />
        <ShellMetricCard
          label="Replay-linked"
          value={String(stats.replayLinkedCount)}
        />
      </section>

      {snapshot.error ? (
        <ShellStatusBanner tone="warning">{snapshot.error}</ShellStatusBanner>
      ) : null}

      {statusMessage ? (
        <ShellStatusBanner tone="success">{statusMessage}</ShellStatusBanner>
      ) : null}

      {errorMessage ? (
        <ShellStatusBanner tone="danger">{errorMessage}</ShellStatusBanner>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <ShellQueueSectionCard
            title="Find the next discovery decision to revisit"
            actions={<Badge tone="info">{filteredRecords.length} visible</Badge>}
            searchValue={query}
            onSearchChange={(event) => setQuery(event.target.value)}
            searchPlaceholder="Filter by idea, trace, replay, project, intake, or recommended action"
            hint={scopeActive ? "scope" : "lane"}
            summary={`${filteredRecords.length} visible after filter`}
            chips={[
              ["all", "All"],
              ["authoring", "Authoring"],
              ["trace", "Trace"],
              ["handoff", "Handoff"],
              ["execution", "Execution"],
              ["linked", "Linked"],
              ["replay", "Replay"],
            ].map(([key, label]) => (
              <ShellFilterChipLink
                key={key}
                href={buildDiscoveryReviewScopeHref(
                  routeScope,
                  key === "all" ? null : key
                )}
                label={String(label ?? key ?? "")}
                active={filter === key}
              />
            ))}
          >
              {loadState === "loading" && routeScopedRecords.length === 0 ? (
                <ShellLoadingState description="Loading discovery review..." />
              ) : null}

              {filteredRecords.map((record) => (
                <ReviewRecordCard
                  key={record.key}
                  record={record}
                  routeScope={routeScope}
                  selected={selectedKeySet.has(record.key)}
                  busyActionKey={busyActionKey}
                  onConfirm={handleConfirmReview}
                  onToggleSelected={toggleSelectedKey}
                  onReopen={handleReopenReview}
                  onOpenHandoff={handleOpenHandoff}
                />
              ))}

              {loadState !== "loading" && filteredRecords.length === 0 ? (
                <ShellEmptyState
                  description={
                    scopeActive
                      ? "No discovery review records match the current route scope and filter."
                      : "No discovery review records match the current filter."
                  }
                />
              ) : null}
          </ShellQueueSectionCard>
        </div>

        <div className="space-y-4">
          <DiscoveryReviewBatchPanel
            busyActionKey={busyActionKey}
            selectedAuthoringCount={selectedAuthoringRecords.length}
            selectedCount={selectedRecords.length}
            selectedHandoffCount={selectedHandoffRecords.length}
            selectedReplayCount={selectedReplayRecords.length}
            selectedTraceCount={selectedTraceRecords.length}
            visibleAuthoringCount={filteredAuthoringRecords.length}
            visibleCount={visibleRecordKeys.length}
            visibleHandoffCount={filteredHandoffRecords.length}
            visibleReplayCount={filteredReplayRecords.length}
            visibleTraceCount={filteredTraceRecords.length}
            onBatchConfirm={handleBatchConfirm}
            onBatchReopen={handleBatchReopen}
            onClearSelection={clearSelection}
            onSelectAuthoring={() =>
              replaceSelectedKeys(filteredAuthoringRecords.map((record) => record.key))
            }
            onSelectHandoffReady={() =>
              replaceSelectedKeys(filteredHandoffRecords.map((record) => record.key))
            }
            onSelectReplayLinked={() =>
              replaceSelectedKeys(filteredReplayRecords.map((record) => record.key))
            }
            onSelectTrace={() =>
              replaceSelectedKeys(filteredTraceRecords.map((record) => record.key))
            }
            onSelectVisible={() => replaceSelectedKeys(visibleRecordKeys)}
          />


          <ReviewMemoryCard
            cardTitle="Remember this discovery review slice"
            cardDescription="Operator memory"
            memoryTargetLabel={reviewMemoryBucketLabel(reviewMemoryBucket)}
            rememberedLabel={describeReviewPassPreference(rememberedReviewPass)}
            currentLabel={describeReviewPassPreference(currentReviewPass)}
            rememberLabel={`Remember ${reviewMemoryBucketLabel(reviewMemoryBucket)} filter`}
            remembered={isCurrentReviewRemembered}
            busy={busyActionKey.length > 0}
            resetDisabled={isMemoryAtDefault}
            onRemember={handleRememberCurrentFilter}
            onReset={handleResetRememberedFilter}
            note="Unified review will reopen this discovery lane with the remembered pass whenever the same chain type reappears."
          />

          <ShellRefreshStateCard
            description="Review data stays on the shell-owned read path and refreshes by operator profile."
            busy={loadState === "loading"}
            busyLabel="Review queue refresh in progress..."
            idleLabel="Review queue idle."
            icon={<Orbit className="h-4 w-4 text-accent" />}
            intervalSeconds={Math.round(pollInterval / 1000)}
            guidance="Use authoring, trace, replay, and execution links to validate the next discovery decision in context."
            statusTitle="Review refresh"
          />
        </div>
      </section>
    </ShellPage>
  );
}
