import {
  addQuorumDiscoveryDecision,
  addQuorumDiscoveryObservation,
  addQuorumDiscoveryTimelineEvent,
  addQuorumDiscoveryValidationReport,
  actOnQuorumDiscoveryInboxItem,
  archiveQuorumDiscoveryIdea,
  compareQuorumRankingIdeas,
  continueQuorumSession,
  controlQuorumSession,
  createExecutionBriefHandoff,
  exportQuorumExecutionBrief,
  prepareQuorumTournamentFromSession,
  resolveQuorumRankingFinals,
  resolveQuorumDiscoveryInboxItem,
  runQuorumDiscoveryMarketSimulation,
  runQuorumDiscoverySimulation,
  sendQuorumSessionMessage,
  swipeQuorumDiscoveryIdea,
  upsertQuorumDiscoveryEvidenceBundle,
  type QuorumAutopilotLaunchPreset,
  type QuorumDossierTimelineEvent,
  type QuorumDossierTimelineEventCreateRequest,
  type QuorumFinalVoteBallot,
  type QuorumFinalVoteResult,
  type QuorumEvidenceBundle,
  type QuorumEvidenceBundleUpsertRequest,
  type QuorumDiscoverySwipeAction,
  type QuorumDiscoveryInboxItem,
  type QuorumExecutionBrief,
  type QuorumIdeaDecision,
  type QuorumIdeaDecisionCreateRequest,
  type QuorumIdeaArchiveEntry,
  type QuorumMarketSimulationRunRequest,
  type QuorumSourceObservation,
  type QuorumSourceObservationCreateRequest,
  type QuorumSimulationRunRequest,
  type QuorumValidationReport,
  type QuorumValidationReportCreateRequest,
} from "@founderos/api-clients";
import type { ShellDiscoveryReviewRecord } from "@/lib/discovery-review";

import { resolveDiscoveryInboxEditFieldKey } from "@/lib/discovery-ui-state";
import { buildExecutionHandoffScopeHref } from "@/lib/route-scope";
import {
  resolveDiscoverySessionMutationHref,
} from "@/lib/shell-route-intents";
import type { ShellMutationEffect } from "@/lib/shell-mutation-effects";
import type { ShellRouteScope } from "@/lib/route-scope";
import type { ShellRouteMutationInvalidation } from "@/lib/use-shell-route-mutation";

export type DiscoverySessionActionKind =
  | "queue"
  | "resume"
  | "cancel"
  | "restart"
  | "continue"
  | "export"
  | "handoff"
  | "launch"
  | "tournament";

export type DiscoveryInboxActionKind =
  | "resolve"
  | "accept"
  | "ignore"
  | "compare"
  | "edit"
  | "respond";

export type DiscoveryBoardActionKind =
  | "ranking-compare-left"
  | "ranking-compare-right"
  | "ranking-compare-tie"
  | "ranking-finals-resolve"
  | "idea-archive"
  | "swipe-pass"
  | "swipe-maybe"
  | "swipe-yes"
  | "swipe-now"
  | "simulation-run-persona"
  | "simulation-run-market";

export type DiscoveryAuthoringActionKind =
  | "observation-add"
  | "validation-add"
  | "decision-add"
  | "timeline-add"
  | "evidence-upsert";

export type DiscoveryReviewActionKind =
  | "review-confirm"
  | "review-reopen"
  | "review-open-handoff";

export type DiscoveryMutationActionKind =
  | DiscoverySessionActionKind
  | DiscoveryInboxActionKind
  | DiscoveryBoardActionKind
  | DiscoveryAuthoringActionKind
  | DiscoveryReviewActionKind;

export type DiscoveryMutationData = {
  actionKind: DiscoveryMutationActionKind;
  archiveEntry?: QuorumIdeaArchiveEntry | null;
  brief?: QuorumExecutionBrief | null;
  decision?: QuorumIdeaDecision | null;
  evidenceBundle?: QuorumEvidenceBundle | null;
  finalsResult?: QuorumFinalVoteResult | null;
  handoffId?: string | null;
  nextSessionId?: string | null;
  observation?: QuorumSourceObservation | null;
  timelineEvent?: QuorumDossierTimelineEvent | null;
  validationReport?: QuorumValidationReport | null;
};

export type DiscoveryMutationEffect = ShellMutationEffect<DiscoveryMutationData> & {
  actionKind: DiscoveryMutationActionKind;
  archiveEntry?: QuorumIdeaArchiveEntry | null;
  decision?: QuorumIdeaDecision | null;
  evidenceBundle?: QuorumEvidenceBundle | null;
  nextSessionId?: string | null;
  finalsResult?: QuorumFinalVoteResult | null;
  handoffId?: string | null;
  observation?: QuorumSourceObservation | null;
  brief?: QuorumExecutionBrief | null;
  timelineEvent?: QuorumDossierTimelineEvent | null;
  validationReport?: QuorumValidationReport | null;
};

function createDiscoveryMutationEffect(
  actionKind: DiscoveryMutationActionKind,
  effect: Omit<DiscoveryMutationEffect, "actionKind" | "data"> & {
    data?: Partial<DiscoveryMutationData>;
  }
): DiscoveryMutationEffect {
  const nextSessionId =
    effect.data?.nextSessionId ?? effect.nextSessionId ?? null;
  const handoffId = effect.data?.handoffId ?? effect.handoffId ?? null;
  const brief = effect.data?.brief ?? effect.brief ?? null;
  const archiveEntry =
    effect.data?.archiveEntry ?? effect.archiveEntry ?? null;
  const decision = effect.data?.decision ?? effect.decision ?? null;
  const evidenceBundle =
    effect.data?.evidenceBundle ?? effect.evidenceBundle ?? null;
  const finalsResult =
    effect.data?.finalsResult ?? effect.finalsResult ?? null;
  const observation = effect.data?.observation ?? effect.observation ?? null;
  const timelineEvent =
    effect.data?.timelineEvent ?? effect.timelineEvent ?? null;
  const validationReport =
    effect.data?.validationReport ?? effect.validationReport ?? null;

  return {
    ...effect,
    actionKind,
    archiveEntry,
    decision,
    evidenceBundle,
    nextSessionId,
    finalsResult,
    handoffId,
    observation,
    brief,
    timelineEvent,
    validationReport,
    data: {
      actionKind,
      archiveEntry,
      brief,
      decision,
      evidenceBundle,
      finalsResult,
      handoffId,
      nextSessionId,
      observation,
      timelineEvent,
      validationReport,
      ...effect.data,
    },
  };
}

function buildDiscoverySessionInvalidation(
  sessionId: string,
  routeScope?: Partial<ShellRouteScope> | null,
  reason: string = "discovery-session-mutation",
  source: string = "discovery-workspace"
): ShellRouteMutationInvalidation {
  return {
    planes: ["discovery"],
    scope: routeScope,
    resource: {
      discoverySessionId: sessionId,
    },
    source,
    reason,
  };
}

function buildDiscoveryIdeaInvalidation(
  ideaId: string,
  routeScope?: Partial<ShellRouteScope> | null,
  reason: string = "discovery-idea-mutation",
  source: string = "discovery"
): ShellRouteMutationInvalidation {
  return {
    planes: ["discovery"],
    scope: routeScope,
    resource: {
      discoveryIdeaId: ideaId,
    },
    source,
    reason,
  };
}

function buildDiscoveryPlaneInvalidation(
  routeScope?: Partial<ShellRouteScope> | null,
  reason: string = "discovery-plane-mutation",
  source: string = "discovery"
): ShellRouteMutationInvalidation {
  return {
    planes: ["discovery"],
    scope: routeScope,
    source,
    reason,
  };
}

function discoveryReviewDecisionType(kind: ShellDiscoveryReviewRecord["kind"]) {
  if (kind === "trace-review") return "trace_review_confirmed";
  if (kind === "handoff-ready") return "handoff_ready_confirmed";
  if (kind === "execution-followthrough") {
    return "execution_followthrough_confirmed";
  }
  return "authoring_review_confirmed";
}

function discoveryReviewConfirmRationale(
  record: ShellDiscoveryReviewRecord,
  note?: string
) {
  const normalizedNote = (note || "").trim();
  if (normalizedNote) {
    return normalizedNote;
  }

  if (record.kind === "authoring") {
    return "Confirmed that this dossier still needs authoring work before it should move forward.";
  }
  if (record.kind === "trace-review") {
    return "Confirmed the latest discovery trace signals were reviewed in the unified shell.";
  }
  if (record.kind === "handoff-ready") {
    return "Confirmed the dossier is ready for execution handoff review.";
  }
  return "Confirmed execution-linked discovery follow-through is still the correct review stance.";
}

function discoveryReviewReopenTitle(kind: ShellDiscoveryReviewRecord["kind"]) {
  if (kind === "trace-review") return "Trace review reopened";
  if (kind === "handoff-ready") return "Handoff review reopened";
  if (kind === "execution-followthrough") return "Execution follow-through reopened";
  return "Authoring review reopened";
}

function discoveryReviewReopenDetail(
  record: ShellDiscoveryReviewRecord,
  note?: string
) {
  const normalizedNote = (note || "").trim();
  if (normalizedNote) {
    return normalizedNote;
  }
  return record.reason;
}

function discoveryReviewMetadata(
  record: ShellDiscoveryReviewRecord,
  note?: string
) {
  return {
    review_kind: record.kind,
    idea_id: record.dossier.idea.idea_id,
    brief_id: record.chain?.briefId ?? null,
    project_id: record.chain?.project?.id ?? null,
    intake_session_id:
      record.chain?.intakeSession?.id ?? record.chain?.intakeSessionId ?? null,
    linked_replay_session_ids: record.trace?.linkedSessionIds ?? [],
    latest_trace_kind: record.trace?.latestKind ?? null,
    latest_trace_title: record.trace?.latestTitle ?? null,
    review_reason: record.reason,
    recommended_action: record.recommendedAction,
    operator_note: (note || "").trim() || null,
    route: "discovery_review",
  } satisfies Record<string, unknown>;
}

function buildDiscoveryInboxInvalidation(args: {
  item: QuorumDiscoveryInboxItem;
  routeScope?: Partial<ShellRouteScope> | null;
  reason: string;
  source?: string;
  compareTargetIdeaId?: string | null;
}) {
  const ideaId = (args.item.idea_id || "").trim();
  const compareTargetIdeaId = (args.compareTargetIdeaId || "").trim();

  if (
    compareTargetIdeaId &&
    ideaId &&
    compareTargetIdeaId !== ideaId
  ) {
    return {
      planes: ["discovery"],
      scope: args.routeScope,
      source: args.source || "inbox",
      reason: args.reason,
    } satisfies ShellRouteMutationInvalidation;
  }

  if (ideaId) {
    return buildDiscoveryIdeaInvalidation(
      ideaId,
      args.routeScope,
      args.reason,
      args.source || "inbox"
    );
  }

  return {
    planes: ["discovery"],
    scope: args.routeScope,
    source: args.source || "inbox",
    reason: args.reason,
  } satisfies ShellRouteMutationInvalidation;
}

export async function queueDiscoverySessionInstruction(args: {
  sessionId: string;
  content: string;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<DiscoveryMutationEffect> {
  await sendQuorumSessionMessage(args.sessionId, args.content);
  return createDiscoveryMutationEffect("queue", {
    statusMessage: "Instruction queued in the active Quorum session.",
    invalidation: buildDiscoverySessionInvalidation(
      args.sessionId,
      args.routeScope,
      "discovery-session-queue",
      args.source
    ),
  });
}

export async function resumeDiscoverySession(args: {
  sessionId: string;
  content?: string;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<DiscoveryMutationEffect> {
  await controlQuorumSession(args.sessionId, "resume", args.content);
  return createDiscoveryMutationEffect("resume", {
    statusMessage: "Session resumed.",
    invalidation: buildDiscoverySessionInvalidation(
      args.sessionId,
      args.routeScope,
      "discovery-session-resume",
      args.source
    ),
  });
}

export async function cancelDiscoverySession(args: {
  sessionId: string;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<DiscoveryMutationEffect> {
  await controlQuorumSession(args.sessionId, "cancel");
  return createDiscoveryMutationEffect("cancel", {
    statusMessage: "Stop requested for the active session.",
    invalidation: buildDiscoverySessionInvalidation(
      args.sessionId,
      args.routeScope,
      "discovery-session-cancel",
      args.source
    ),
  });
}

export async function restartDiscoverySessionFromCheckpoint(args: {
  sessionId: string;
  checkpointId: string;
  content?: string;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<DiscoveryMutationEffect> {
  const result = await controlQuorumSession(
    args.sessionId,
    "restart_from_checkpoint",
    args.content,
    args.checkpointId
  );
  const nextSessionId = result.new_session_id || args.sessionId;
  return createDiscoveryMutationEffect("restart", {
    statusMessage: result.new_session_id
      ? "New branch created from the current checkpoint."
      : "Restart requested from the current checkpoint.",
    nextSessionId: result.new_session_id,
    href: result.new_session_id
      ? resolveDiscoverySessionMutationHref(result.new_session_id, args.routeScope)
      : null,
    invalidation: buildDiscoverySessionInvalidation(
      nextSessionId,
      args.routeScope,
      result.new_session_id
        ? "discovery-session-branch-restart"
        : "discovery-session-restart",
      args.source
    ),
  });
}

export async function continueDiscoverySessionConversation(args: {
  sessionId: string;
  content: string;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<DiscoveryMutationEffect> {
  const result = await continueQuorumSession(args.sessionId, args.content);
  const nextSessionId = result.new_session_id || args.sessionId;
  return createDiscoveryMutationEffect("continue", {
    statusMessage: result.new_session_id
      ? "Continuation branch created for the team."
      : "Continuation request accepted.",
    nextSessionId: result.new_session_id,
    href: result.new_session_id
      ? resolveDiscoverySessionMutationHref(result.new_session_id, args.routeScope)
      : null,
    invalidation: buildDiscoverySessionInvalidation(
      nextSessionId,
      args.routeScope,
      result.new_session_id
        ? "discovery-session-branch-continue"
        : "discovery-session-continue",
      args.source
    ),
  });
}

export async function exportDiscoveryExecutionBrief(args: {
  sessionId: string;
}): Promise<DiscoveryMutationEffect> {
  const exported = await exportQuorumExecutionBrief(args.sessionId);
  return createDiscoveryMutationEffect("export", {
    statusMessage: "Execution Brief exported from Quorum.",
    invalidation: false,
    brief: exported.brief,
  });
}

export async function openDiscoveryExecutionHandoff(args: {
  sessionId: string;
  launch: boolean;
  selectedLaunchPresetId: string;
  launchPresets: QuorumAutopilotLaunchPreset[];
  routeScope?: Partial<ShellRouteScope> | null;
}): Promise<DiscoveryMutationEffect> {
  const exported = await exportQuorumExecutionBrief(args.sessionId);
  const preset = args.launchPresets.find(
    (item) => item.id === args.selectedLaunchPresetId
  );
  const handoff = await createExecutionBriefHandoff({
    sourcePlane: "discovery",
    sourceSessionId: args.sessionId,
    briefKind: "quorum_execution_brief",
    brief: exported.brief as unknown as Record<string, unknown>,
    defaultProjectName: exported.brief.title,
    recommendedLaunchPresetId: preset?.id ?? args.selectedLaunchPresetId,
    launchIntent: args.launch ? "launch" : "create",
  });

  return createDiscoveryMutationEffect(args.launch ? "launch" : "handoff", {
    statusMessage: args.launch
      ? "Discovery brief opened in execution with launch intent."
      : "Discovery brief opened in execution.",
    invalidation: false,
    brief: exported.brief,
    handoffId: handoff.id,
    href: buildExecutionHandoffScopeHref(handoff.id, args.routeScope),
  });
}

export async function prepareDiscoveryTournament(args: {
  sessionId: string;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<DiscoveryMutationEffect> {
  const response = await prepareQuorumTournamentFromSession(args.sessionId);
  return createDiscoveryMutationEffect("tournament", {
    statusMessage: `Tournament draft prepared with ${response.tournament.contestants.length} contestants.`,
    invalidation: buildDiscoverySessionInvalidation(
      args.sessionId,
      args.routeScope,
      "discovery-session-tournament",
      args.source
    ),
  });
}

export async function resolveDiscoveryInboxItem(args: {
  item: QuorumDiscoveryInboxItem;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<DiscoveryMutationEffect> {
  await resolveQuorumDiscoveryInboxItem(args.item.item_id);
  return createDiscoveryMutationEffect("resolve", {
    statusMessage: `Resolved discovery inbox item ${args.item.item_id}.`,
    invalidation: buildDiscoveryInboxInvalidation({
      item: args.item,
      routeScope: args.routeScope,
      reason: "discovery-resolve",
      source: args.source,
    }),
  });
}

export async function acceptDiscoveryInboxItem(args: {
  item: QuorumDiscoveryInboxItem;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<DiscoveryMutationEffect> {
  await actOnQuorumDiscoveryInboxItem(args.item.item_id, {
    action: "accept",
    note: `Accepted ${args.item.subject_kind} review from unified inbox.`,
  });
  return createDiscoveryMutationEffect("accept", {
    statusMessage: `Accepted discovery inbox item ${args.item.item_id}.`,
    invalidation: buildDiscoveryInboxInvalidation({
      item: args.item,
      routeScope: args.routeScope,
      reason: "discovery-accept",
      source: args.source,
    }),
  });
}

export async function ignoreDiscoveryInboxItem(args: {
  item: QuorumDiscoveryInboxItem;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<DiscoveryMutationEffect> {
  await actOnQuorumDiscoveryInboxItem(args.item.item_id, {
    action: "ignore",
    note: `Ignored ${args.item.subject_kind} review from unified inbox.`,
  });
  return createDiscoveryMutationEffect("ignore", {
    statusMessage: `Ignored discovery inbox item ${args.item.item_id}.`,
    invalidation: buildDiscoveryInboxInvalidation({
      item: args.item,
      routeScope: args.routeScope,
      reason: "discovery-ignore",
      source: args.source,
    }),
  });
}

export async function compareDiscoveryInboxItem(args: {
  item: QuorumDiscoveryInboxItem;
  compareIdeaId: string;
  note: string;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<DiscoveryMutationEffect> {
  await actOnQuorumDiscoveryInboxItem(args.item.item_id, {
    action: "compare",
    note: args.note,
    compare_target_idea_id: args.compareIdeaId,
  });
  return createDiscoveryMutationEffect("compare", {
    statusMessage: `Compared discovery inbox item ${args.item.item_id} against ${args.compareIdeaId}.`,
    invalidation: buildDiscoveryInboxInvalidation({
      item: args.item,
      routeScope: args.routeScope,
      compareTargetIdeaId: args.compareIdeaId,
      reason: "discovery-compare",
      source: args.source,
    }),
  });
}

export async function editDiscoveryInboxItem(args: {
  item: QuorumDiscoveryInboxItem;
  editText: string;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<DiscoveryMutationEffect> {
  await actOnQuorumDiscoveryInboxItem(args.item.item_id, {
    action: "edit",
    note: `Edited ${args.item.subject_kind} payload from unified inbox.`,
    edited_fields: {
      [resolveDiscoveryInboxEditFieldKey(args.item.subject_kind)]:
        args.editText.trim(),
    },
  });
  return createDiscoveryMutationEffect("edit", {
    statusMessage: `Edited discovery inbox item ${args.item.item_id}.`,
    invalidation: buildDiscoveryInboxInvalidation({
      item: args.item,
      routeScope: args.routeScope,
      reason: "discovery-edit",
      source: args.source,
    }),
  });
}

export async function respondToDiscoveryInboxItem(args: {
  item: QuorumDiscoveryInboxItem;
  responseText: string;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<DiscoveryMutationEffect> {
  const note = args.responseText.trim();
  await actOnQuorumDiscoveryInboxItem(args.item.item_id, {
    action: "respond",
    note,
    response_text: note,
  });
  return createDiscoveryMutationEffect("respond", {
    statusMessage: `Responded to discovery inbox item ${args.item.item_id}.`,
    invalidation: buildDiscoveryInboxInvalidation({
      item: args.item,
      routeScope: args.routeScope,
      reason: "discovery-respond",
      source: args.source,
    }),
  });
}

export async function compareDiscoveryRankingPair(args: {
  leftIdeaId: string;
  rightIdeaId: string;
  verdict: "left" | "right" | "tie";
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<DiscoveryMutationEffect> {
  await compareQuorumRankingIdeas({
    leftIdeaId: args.leftIdeaId,
    rightIdeaId: args.rightIdeaId,
    verdict: args.verdict,
    rationale: `Unified shell ranking vote: ${args.verdict}.`,
    judgeSource: "human",
  });

  const actionKind =
    args.verdict === "left"
      ? "ranking-compare-left"
      : args.verdict === "right"
        ? "ranking-compare-right"
        : "ranking-compare-tie";

  return createDiscoveryMutationEffect(actionKind, {
    statusMessage:
      args.verdict === "tie"
        ? "Ranking pair recorded as a tie."
        : `Ranking vote recorded for ${args.verdict}.`,
    invalidation: buildDiscoveryPlaneInvalidation(
      args.routeScope,
      "discovery-ranking-compare",
      args.source || "discovery-board"
    ),
  });
}

export async function resolveDiscoveryRankingFinals(args: {
  candidateIdeaIds?: string[];
  ballots: QuorumFinalVoteBallot[];
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<DiscoveryMutationEffect> {
  const result = await resolveQuorumRankingFinals({
    candidateIdeaIds: args.candidateIdeaIds,
    ballots: args.ballots,
  });

  return createDiscoveryMutationEffect("ranking-finals-resolve", {
    statusMessage: result.winner_idea_id
      ? `Finals resolved. Winner: ${result.winner_idea_id}.`
      : "Finals resolved without a winner.",
    finalsResult: result,
    invalidation: buildDiscoveryPlaneInvalidation(
      args.routeScope,
      "discovery-ranking-finals",
      args.source || "discovery-board-finals"
    ),
  });
}

export async function archiveDiscoveryIdeaRecord(args: {
  ideaId: string;
  reason?: string;
  supersededByIdeaId?: string | null;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<DiscoveryMutationEffect> {
  const result = await archiveQuorumDiscoveryIdea(args.ideaId, {
    reason:
      args.reason?.trim() ||
      "Archived from the unified shell archive route.",
    supersededByIdeaId: args.supersededByIdeaId,
  });

  return createDiscoveryMutationEffect("idea-archive", {
    statusMessage: `Idea ${args.ideaId} moved into the archive frontier.`,
    archiveEntry: result,
    invalidation: buildDiscoveryIdeaInvalidation(
      args.ideaId,
      args.routeScope,
      "discovery-idea-archive",
      args.source || "discovery-board-archive"
    ),
  });
}

export async function addDiscoveryObservationRecord(args: {
  ideaId: string;
  request: QuorumSourceObservationCreateRequest;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<DiscoveryMutationEffect> {
  const result = await addQuorumDiscoveryObservation(args.ideaId, args.request);

  return createDiscoveryMutationEffect("observation-add", {
    statusMessage: `Observation added to ${args.ideaId}.`,
    observation: result,
    invalidation: buildDiscoveryIdeaInvalidation(
      args.ideaId,
      args.routeScope,
      "discovery-observation-add",
      args.source || "discovery-authoring"
    ),
  });
}

export async function addDiscoveryValidationReportRecord(args: {
  ideaId: string;
  request: QuorumValidationReportCreateRequest;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<DiscoveryMutationEffect> {
  const result = await addQuorumDiscoveryValidationReport(args.ideaId, args.request);

  return createDiscoveryMutationEffect("validation-add", {
    statusMessage: `Validation report added to ${args.ideaId}.`,
    validationReport: result,
    invalidation: buildDiscoveryIdeaInvalidation(
      args.ideaId,
      args.routeScope,
      "discovery-validation-add",
      args.source || "discovery-authoring"
    ),
  });
}

export async function addDiscoveryDecisionRecord(args: {
  ideaId: string;
  request: QuorumIdeaDecisionCreateRequest;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<DiscoveryMutationEffect> {
  const result = await addQuorumDiscoveryDecision(args.ideaId, args.request);

  return createDiscoveryMutationEffect("decision-add", {
    statusMessage: `Decision recorded for ${args.ideaId}.`,
    decision: result,
    invalidation: buildDiscoveryIdeaInvalidation(
      args.ideaId,
      args.routeScope,
      "discovery-decision-add",
      args.source || "discovery-authoring"
    ),
  });
}

export async function addDiscoveryTimelineEventRecord(args: {
  ideaId: string;
  request: QuorumDossierTimelineEventCreateRequest;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<DiscoveryMutationEffect> {
  const result = await addQuorumDiscoveryTimelineEvent(args.ideaId, args.request);

  return createDiscoveryMutationEffect("timeline-add", {
    statusMessage: `Timeline event added to ${args.ideaId}.`,
    timelineEvent: result,
    invalidation: buildDiscoveryIdeaInvalidation(
      args.ideaId,
      args.routeScope,
      "discovery-timeline-add",
      args.source || "discovery-authoring"
    ),
  });
}

export async function upsertDiscoveryEvidenceBundleRecord(args: {
  ideaId: string;
  request: QuorumEvidenceBundleUpsertRequest;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<DiscoveryMutationEffect> {
  const result = await upsertQuorumDiscoveryEvidenceBundle(args.ideaId, args.request);

  return createDiscoveryMutationEffect("evidence-upsert", {
    statusMessage: `Evidence bundle updated for ${args.ideaId}.`,
    evidenceBundle: result,
    invalidation: buildDiscoveryIdeaInvalidation(
      args.ideaId,
      args.routeScope,
      "discovery-evidence-upsert",
      args.source || "discovery-authoring"
    ),
  });
}

export async function confirmDiscoveryReviewRecord(args: {
  record: ShellDiscoveryReviewRecord;
  note?: string;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<DiscoveryMutationEffect> {
  const result = await addQuorumDiscoveryDecision(args.record.dossier.idea.idea_id, {
    decision_type: discoveryReviewDecisionType(args.record.kind),
    rationale: discoveryReviewConfirmRationale(args.record, args.note),
    actor: "founder",
    metadata: discoveryReviewMetadata(args.record, args.note),
  });

  return createDiscoveryMutationEffect("review-confirm", {
    statusMessage: `Review confirmed for ${args.record.dossier.idea.idea_id}.`,
    decision: result,
    invalidation: buildDiscoveryIdeaInvalidation(
      args.record.dossier.idea.idea_id,
      args.routeScope,
      "discovery-review-confirm",
      args.source || "discovery-review"
    ),
  });
}

export async function reopenDiscoveryReviewRecord(args: {
  record: ShellDiscoveryReviewRecord;
  note?: string;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<DiscoveryMutationEffect> {
  const result = await addQuorumDiscoveryTimelineEvent(
    args.record.dossier.idea.idea_id,
    {
      stage: args.record.dossier.idea.latest_stage,
      title: discoveryReviewReopenTitle(args.record.kind),
      detail: discoveryReviewReopenDetail(args.record, args.note),
      metadata: discoveryReviewMetadata(args.record, args.note),
    }
  );

  return createDiscoveryMutationEffect("review-reopen", {
    statusMessage: `Review reopened for ${args.record.dossier.idea.idea_id}.`,
    timelineEvent: result,
    invalidation: buildDiscoveryIdeaInvalidation(
      args.record.dossier.idea.idea_id,
      args.routeScope,
      "discovery-review-reopen",
      args.source || "discovery-review"
    ),
  });
}

export async function openDiscoveryReviewExecutionHandoff(args: {
  record: ShellDiscoveryReviewRecord;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<DiscoveryMutationEffect> {
  const brief = args.record.dossier.execution_brief_candidate;
  if (!brief) {
    throw new Error("Execution brief candidate is unavailable for this review record.");
  }

  const handoff = await createExecutionBriefHandoff({
    sourcePlane: "discovery",
    sourceSessionId: args.record.trace?.linkedSessionIds[0] ?? null,
    briefKind: "shared_execution_brief",
    brief: brief as unknown as Record<string, unknown>,
    defaultProjectName: brief.title,
    launchIntent: "create",
  });

  return createDiscoveryMutationEffect("review-open-handoff", {
    statusMessage: "Execution handoff opened from discovery review.",
    handoffId: handoff.id,
    href: buildExecutionHandoffScopeHref(handoff.id, args.routeScope),
    invalidation: false,
  });
}

export async function swipeDiscoveryIdeaFromBoard(args: {
  ideaId: string;
  action: QuorumDiscoverySwipeAction;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<DiscoveryMutationEffect> {
  await swipeQuorumDiscoveryIdea(args.ideaId, {
    action: args.action,
    actor: "founder",
    rationale: `Unified shell swipe action: ${args.action}.`,
    revisitAfterHours: args.action === "maybe" ? 72 : undefined,
  });

  return createDiscoveryMutationEffect(`swipe-${args.action}`, {
    statusMessage: `Idea ${args.ideaId} moved to ${args.action}.`,
    invalidation: buildDiscoveryIdeaInvalidation(
      args.ideaId,
      args.routeScope,
      "discovery-swipe",
      args.source || "discovery-board"
    ),
  });
}

export async function runDiscoveryPersonaSimulation(args: {
  ideaId: string;
  request: QuorumSimulationRunRequest;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<DiscoveryMutationEffect> {
  const result = await runQuorumDiscoverySimulation(args.ideaId, args.request);

  return createDiscoveryMutationEffect("simulation-run-persona", {
    statusMessage: result.cached
      ? `Persona simulation ready for ${result.idea.title} (cache hit).`
      : `Persona simulation completed for ${result.idea.title}.`,
    invalidation: buildDiscoveryIdeaInvalidation(
      args.ideaId,
      args.routeScope,
      "discovery-persona-simulation",
      args.source || "discovery-board-simulations"
    ),
  });
}

export async function runDiscoveryMarketSimulation(args: {
  ideaId: string;
  request: QuorumMarketSimulationRunRequest;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<DiscoveryMutationEffect> {
  const result = await runQuorumDiscoveryMarketSimulation(
    args.ideaId,
    args.request
  );

  return createDiscoveryMutationEffect("simulation-run-market", {
    statusMessage: result.cached
      ? `Market lab ready for ${result.idea.title} (cache hit).`
      : `Market lab completed for ${result.idea.title}.`,
    invalidation: buildDiscoveryIdeaInvalidation(
      args.ideaId,
      args.routeScope,
      "discovery-market-simulation",
      args.source || "discovery-board-simulations"
    ),
  });
}

type DiscoverySessionActionArgs =
  | {
      action: "queue";
      sessionId: string;
      content: string;
      routeScope?: Partial<ShellRouteScope> | null;
      source?: string;
    }
  | {
      action: "resume";
      sessionId: string;
      content?: string;
      routeScope?: Partial<ShellRouteScope> | null;
      source?: string;
    }
  | {
      action: "cancel";
      sessionId: string;
      routeScope?: Partial<ShellRouteScope> | null;
      source?: string;
    }
  | {
      action: "restart";
      sessionId: string;
      checkpointId: string;
      content?: string;
      routeScope?: Partial<ShellRouteScope> | null;
      source?: string;
    }
  | {
      action: "continue";
      sessionId: string;
      content: string;
      routeScope?: Partial<ShellRouteScope> | null;
      source?: string;
    }
  | {
      action: "export";
      sessionId: string;
      source?: string;
    }
  | {
      action: "handoff" | "launch";
      sessionId: string;
      selectedLaunchPresetId: string;
      launchPresets: QuorumAutopilotLaunchPreset[];
      routeScope?: Partial<ShellRouteScope> | null;
      source?: string;
    }
  | {
      action: "tournament";
      sessionId: string;
      routeScope?: Partial<ShellRouteScope> | null;
      source?: string;
    };

export async function runDiscoverySessionAction(
  args: DiscoverySessionActionArgs
): Promise<DiscoveryMutationEffect> {
  switch (args.action) {
    case "queue":
      return queueDiscoverySessionInstruction(args);
    case "resume":
      return resumeDiscoverySession(args);
    case "cancel":
      return cancelDiscoverySession(args);
    case "restart":
      return restartDiscoverySessionFromCheckpoint(args);
    case "continue":
      return continueDiscoverySessionConversation(args);
    case "export":
      return exportDiscoveryExecutionBrief(args);
    case "handoff":
    case "launch":
      return openDiscoveryExecutionHandoff({
        sessionId: args.sessionId,
        launch: args.action === "launch",
        selectedLaunchPresetId: args.selectedLaunchPresetId,
        launchPresets: args.launchPresets,
        routeScope: args.routeScope,
      });
    case "tournament":
      return prepareDiscoveryTournament(args);
  }
}

type DiscoveryInboxActionArgs =
  | {
      action: "resolve" | "accept" | "ignore";
      item: QuorumDiscoveryInboxItem;
      routeScope?: Partial<ShellRouteScope> | null;
      source?: string;
    }
  | {
      action: "compare";
      item: QuorumDiscoveryInboxItem;
      compareIdeaId: string;
      note: string;
      routeScope?: Partial<ShellRouteScope> | null;
      source?: string;
    }
  | {
      action: "edit";
      item: QuorumDiscoveryInboxItem;
      editText: string;
      routeScope?: Partial<ShellRouteScope> | null;
      source?: string;
    }
  | {
      action: "respond";
      item: QuorumDiscoveryInboxItem;
      responseText: string;
      routeScope?: Partial<ShellRouteScope> | null;
      source?: string;
    };

export async function runDiscoveryInboxAction(
  args: DiscoveryInboxActionArgs
): Promise<DiscoveryMutationEffect> {
  switch (args.action) {
    case "resolve":
      return resolveDiscoveryInboxItem(args);
    case "accept":
      return acceptDiscoveryInboxItem(args);
    case "ignore":
      return ignoreDiscoveryInboxItem(args);
    case "compare":
      return compareDiscoveryInboxItem(args);
    case "edit":
      return editDiscoveryInboxItem(args);
    case "respond":
      return respondToDiscoveryInboxItem(args);
  }
}
