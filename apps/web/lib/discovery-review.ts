import type {
  QuorumIdeaDossierSummary,
  QuorumIdeaTraceBundle,
  QuorumSessionSummary,
} from "@founderos/api-clients";
import type { LinkedShellChainRecord } from "@/lib/chain-graph";

import {
  buildDiscoveryAuthoringQueueSnapshot,
  emptyShellDiscoveryAuthoringQueueSnapshot,
} from "@/lib/discovery-authoring-queue";
import { buildDiscoveryTracesSnapshot } from "@/lib/discovery-history";
import {
  formatUpstreamErrorMessage,
  requestUpstreamJson,
} from "@/lib/upstream";

export type ShellDiscoveryReviewKind =
  | "authoring"
  | "trace-review"
  | "handoff-ready"
  | "execution-followthrough";

export interface ShellDiscoveryReviewTraceSummary {
  latestKind: string | null;
  latestTitle: string | null;
  latestAt: string | null;
  linkedSessionIds: string[];
  linkedSessions: QuorumSessionSummary[];
  stepCount: number;
  decisionCount: number;
  simulationCount: number;
  validationCount: number;
  rankingCount: number;
  swipeCount: number;
  timelineCount: number;
}

export interface ShellDiscoveryReviewRecord {
  key: string;
  kind: ShellDiscoveryReviewKind;
  priority: number;
  reason: string;
  recommendedAction: string;
  dossier: QuorumIdeaDossierSummary;
  chain: LinkedShellChainRecord | null;
  trace: ShellDiscoveryReviewTraceSummary | null;
  searchText: string;
}

export interface ShellDiscoveryReviewStats {
  totalCount: number;
  authoringCount: number;
  traceReviewCount: number;
  handoffReadyCount: number;
  executionFollowthroughCount: number;
  linkedCount: number;
  replayLinkedCount: number;
}

export interface ShellDiscoveryReviewSnapshot {
  generatedAt: string;
  records: ShellDiscoveryReviewRecord[];
  stats: ShellDiscoveryReviewStats;
  error: string | null;
  loadState: "ready" | "error";
}

function emptyStats(): ShellDiscoveryReviewStats {
  return {
    totalCount: 0,
    authoringCount: 0,
    traceReviewCount: 0,
    handoffReadyCount: 0,
    executionFollowthroughCount: 0,
    linkedCount: 0,
    replayLinkedCount: 0,
  };
}

function buildTraceSummary(
  trace: QuorumIdeaTraceBundle | null,
  sessionsById: Map<string, QuorumSessionSummary>,
): ShellDiscoveryReviewTraceSummary | null {
  if (!trace) {
    return null;
  }

  const latestStep =
    [...trace.steps].sort((left, right) => {
      const leftTime = Date.parse(left.created_at || "") || 0;
      const rightTime = Date.parse(right.created_at || "") || 0;
      return rightTime - leftTime;
    })[0] ?? null;
  const linkedSessions = trace.linked_session_ids
    .map((sessionId) => sessionsById.get(sessionId) ?? null)
    .filter((item): item is QuorumSessionSummary => Boolean(item));

  return {
    latestKind: latestStep?.trace_kind || null,
    latestTitle: latestStep?.title || null,
    latestAt: latestStep?.created_at || trace.last_updated_at || null,
    linkedSessionIds: trace.linked_session_ids,
    linkedSessions,
    stepCount: trace.steps.length,
    decisionCount: trace.steps.filter((step) => step.trace_kind === "decision")
      .length,
    simulationCount: trace.steps.filter(
      (step) => step.trace_kind === "simulation",
    ).length,
    validationCount: trace.steps.filter(
      (step) => step.trace_kind === "validation",
    ).length,
    rankingCount: trace.steps.filter((step) => step.trace_kind === "ranking")
      .length,
    swipeCount: trace.steps.filter((step) => step.trace_kind === "swipe")
      .length,
    timelineCount: trace.steps.filter((step) => step.trace_kind === "timeline")
      .length,
  };
}

function needsTraceReview(trace: ShellDiscoveryReviewTraceSummary | null) {
  if (!trace) {
    return false;
  }

  return (
    trace.decisionCount > 0 ||
    trace.validationCount > 0 ||
    trace.simulationCount > 0 ||
    trace.rankingCount > 0 ||
    trace.swipeCount > 0
  );
}

function deriveReviewKind(args: {
  dossier: QuorumIdeaDossierSummary;
  chain: LinkedShellChainRecord | null;
  trace: ShellDiscoveryReviewTraceSummary | null;
}): {
  kind: ShellDiscoveryReviewKind;
  reason: string;
  recommendedAction: string;
} {
  const { dossier, chain, trace } = args;
  const authoring = chain?.authoring;

  if ((authoring?.gapCount ?? 0) > 0) {
    return {
      kind: "authoring",
      reason:
        authoring?.headline || "Discovery dossier still has authoring gaps.",
      recommendedAction:
        "Complete the dossier in the shell authoring route before treating this idea as decision-ready.",
    };
  }

  if (needsTraceReview(trace)) {
    return {
      kind: "trace-review",
      reason:
        trace?.latestTitle ||
        "Recent trace activity suggests this decision should be reviewed again.",
      recommendedAction:
        "Inspect trace and replay context, then confirm whether the current discovery decision still holds.",
    };
  }

  if (dossier.execution_brief_candidate && !chain?.project) {
    return {
      kind: "handoff-ready",
      reason:
        "Execution brief candidate exists but no linked execution project is visible yet.",
      recommendedAction:
        "Review the dossier and authoring state, then decide whether to hand off into execution.",
    };
  }

  return {
    kind: "execution-followthrough",
    reason: chain?.attention?.total
      ? "Execution attention is open on the linked project."
      : "Execution-linked discovery idea is already in follow-through territory.",
    recommendedAction:
      "Use execution and inbox context to close the loop on the linked project or confirm the discovery verdict.",
  };
}

function reviewPriority(args: {
  recordKind: ShellDiscoveryReviewKind;
  chain: LinkedShellChainRecord | null;
  trace: ShellDiscoveryReviewTraceSummary | null;
  dossier: QuorumIdeaDossierSummary;
}) {
  const kindBase =
    args.recordKind === "authoring"
      ? 400
      : args.recordKind === "trace-review"
        ? 300
        : args.recordKind === "handoff-ready"
          ? 220
          : 160;
  const attentionBonus = (args.chain?.attention?.total ?? 0) * 10;
  const traceBonus = args.trace ? Math.min(args.trace.stepCount, 20) : 0;
  const stageBonus =
    args.dossier.idea.latest_stage === "executed"
      ? 40
      : args.dossier.idea.latest_stage === "handed_off"
        ? 30
        : args.dossier.idea.latest_stage === "simulated"
          ? 20
          : args.dossier.idea.latest_stage === "debated"
            ? 15
            : 10;

  return kindBase + attentionBonus + traceBonus + stageBonus;
}

function buildSearchText(args: {
  dossier: QuorumIdeaDossierSummary;
  chain: LinkedShellChainRecord | null;
  trace: ShellDiscoveryReviewTraceSummary | null;
  reason: string;
  recommendedAction: string;
  kind: ShellDiscoveryReviewKind;
}) {
  const { dossier, chain, trace, reason, recommendedAction, kind } = args;
  return [
    dossier.idea.idea_id,
    dossier.idea.title,
    dossier.idea.summary,
    dossier.idea.latest_stage,
    kind,
    reason,
    recommendedAction,
    chain?.briefId,
    chain?.project?.id,
    chain?.project?.name,
    chain?.intakeSession?.id,
    chain?.intakeSession?.title,
    trace?.latestKind,
    trace?.latestTitle,
    trace?.linkedSessionIds.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function buildStats(records: ShellDiscoveryReviewRecord[]) {
  return records.reduce<ShellDiscoveryReviewStats>((stats, record) => {
    stats.totalCount += 1;

    if (record.kind === "authoring") stats.authoringCount += 1;
    if (record.kind === "trace-review") stats.traceReviewCount += 1;
    if (record.kind === "handoff-ready") stats.handoffReadyCount += 1;
    if (record.kind === "execution-followthrough") {
      stats.executionFollowthroughCount += 1;
    }
    if (record.chain) stats.linkedCount += 1;
    if ((record.trace?.linkedSessionIds.length ?? 0) > 0)
      stats.replayLinkedCount += 1;

    return stats;
  }, emptyStats());
}

export function emptyShellDiscoveryReviewSnapshot(): ShellDiscoveryReviewSnapshot {
  return {
    generatedAt: "",
    records: [],
    stats: emptyStats(),
    error: null,
    loadState: "ready",
  };
}

type DiscoveryReviewSnapshotOptions = {
  upstreamTimeoutMs?: number;
  limit?: number;
};

export async function buildDiscoveryReviewSnapshot(
  options?: DiscoveryReviewSnapshotOptions,
): Promise<ShellDiscoveryReviewSnapshot> {
  const limit =
    typeof options?.limit === "number"
      ? Math.max(1, Math.min(Math.trunc(options.limit), 100))
      : 100;
  const [authoringResult, tracesResult, sessionsResult] =
    await Promise.allSettled([
      buildDiscoveryAuthoringQueueSnapshot({
        upstreamTimeoutMs: options?.upstreamTimeoutMs,
      }),
      buildDiscoveryTracesSnapshot(null, { traceLimit: 48 }),
      requestUpstreamJson<QuorumSessionSummary[]>(
        "quorum",
        "orchestrate/sessions",
        undefined,
        { timeoutMs: options?.upstreamTimeoutMs },
      ),
    ]);

  const errors: string[] = [];

  const authoring =
    authoringResult.status === "fulfilled"
      ? authoringResult.value
      : (errors.push(
          authoringResult.reason instanceof Error
            ? `Discovery authoring queue: ${authoringResult.reason.message}`
            : "Discovery authoring queue: request failed.",
        ),
        emptyShellDiscoveryAuthoringQueueSnapshot());
  const traces =
    tracesResult.status === "fulfilled"
      ? tracesResult.value
      : (errors.push(
          tracesResult.reason instanceof Error
            ? `Discovery traces: ${tracesResult.reason.message}`
            : "Discovery traces: request failed.",
        ),
        null);
  const sessions =
    sessionsResult.status === "fulfilled"
      ? sessionsResult.value
      : (errors.push(
          formatUpstreamErrorMessage("Quorum sessions", sessionsResult.reason),
        ),
        []);

  if (authoring.error) {
    errors.push(authoring.error);
  }
  if (traces?.errors.length) {
    errors.push(...traces.errors);
  }

  const sessionsById = new Map(
    sessions.map((session) => [session.id, session]),
  );
  const tracesByIdeaId = new Map(
    (traces?.traces?.traces ?? []).map((item) => [item.idea_id, item]),
  );

  const records = [...authoring.records]
    .map((authoringRecord) => {
      const trace = buildTraceSummary(
        tracesByIdeaId.get(authoringRecord.dossier.idea.idea_id) ?? null,
        sessionsById,
      );
      const derived = deriveReviewKind({
        dossier: authoringRecord.dossier,
        chain: authoringRecord.chain,
        trace,
      });

      return {
        key: authoringRecord.key,
        kind: derived.kind,
        priority: reviewPriority({
          recordKind: derived.kind,
          chain: authoringRecord.chain,
          trace,
          dossier: authoringRecord.dossier,
        }),
        reason: derived.reason,
        recommendedAction: derived.recommendedAction,
        dossier: authoringRecord.dossier,
        chain: authoringRecord.chain,
        trace,
        searchText: buildSearchText({
          dossier: authoringRecord.dossier,
          chain: authoringRecord.chain,
          trace,
          reason: derived.reason,
          recommendedAction: derived.recommendedAction,
          kind: derived.kind,
        }),
      } satisfies ShellDiscoveryReviewRecord;
    })
    .sort((left, right) => {
      if (right.priority !== left.priority) {
        return right.priority - left.priority;
      }

      const leftTime =
        Date.parse(
          left.trace?.latestAt || left.dossier.idea.updated_at || "",
        ) || 0;
      const rightTime =
        Date.parse(
          right.trace?.latestAt || right.dossier.idea.updated_at || "",
        ) || 0;
      return rightTime - leftTime;
    })
    .slice(0, limit);

  return {
    generatedAt: new Date().toISOString(),
    records,
    stats: buildStats(records),
    error: errors.length > 0 ? errors.join(" ") : null,
    loadState:
      authoringResult.status === "fulfilled" ||
      tracesResult.status === "fulfilled" ||
      sessionsResult.status === "fulfilled"
        ? "ready"
        : "error",
  };
}
