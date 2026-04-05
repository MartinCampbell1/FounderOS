import type {
  AutopilotExecutionApprovalRecord,
  AutopilotExecutionIssueRecord,
  AutopilotIntakeSessionDetail,
  AutopilotIntakeSessionSummary,
  AutopilotProjectDetail,
  AutopilotProjectSummary,
  AutopilotToolPermissionRuntimeRecord,
  QuorumDiscoveryIdea,
  QuorumDiscoveryInboxFeed,
  QuorumDiscoveryTraceSnapshot,
  QuorumEvolutionRecommendation,
  QuorumIdeaArchiveSnapshot,
  QuorumIdeaArchiveCell,
  QuorumIdeaGenome,
  QuorumMarketSimulationReport,
  QuorumNextPairResponse,
  QuorumRankingLeaderboardResponse,
  QuorumDebateReplaySession,
  QuorumIdeaTraceBundle,
  QuorumIdeaDossier,
  QuorumDiscoveryObservabilityScoreboard,
  QuorumSimulationFeedbackReport,
  QuorumSession,
  QuorumSessionSummary,
  QuorumIdeaQueueItem,
  QuorumSwipeQueueResponse,
  ShellParityAuditDrilldown,
  ShellParityAuditDrilldownMetric,
  ShellParityAuditRecord,
  ShellParityAuditSnapshot,
  ShellParityAuditStatus,
} from "@founderos/api-clients";
import type {
  ShellExecutionAttentionRecord,
} from "@/lib/attention-records";
import type {
  ShellChainRecord,
} from "@/lib/chain-graph";
import type {
  ShellDiscoveryReviewRecord,
} from "@/lib/discovery-review";

import {
  buildShellAttentionRecords,
  matchesAttentionRouteScope,
} from "@/lib/attention-records";
import {
  buildShellChainGraphStats,
  matchesShellChainRouteScope,
} from "@/lib/chain-graph";
import {
  loadShellChainGraphSnapshotData,
} from "@/lib/chain-graph-data";
import {
  buildDashboardSnapshot,
} from "@/lib/dashboard";
import {
  buildDiscoveryBoardSnapshot,
} from "@/lib/discovery-board";
import {
  buildDiscoveryRankingSnapshot,
  buildDiscoverySimulationSnapshot,
} from "@/lib/discovery-board-detail";
import {
  buildDiscoveryArchiveSnapshot,
  buildDiscoveryFinalsSnapshot,
} from "@/lib/discovery-board-history";
import {
  buildDiscoveryAuthoringQueueRecords,
  buildDiscoveryAuthoringQueueSnapshot,
  buildDiscoveryAuthoringQueueStats,
  DISCOVERY_AUTHORING_STAGES,
  type ShellDiscoveryAuthoringQueueRecord,
} from "@/lib/discovery-authoring-queue";
import {
  buildDiscoveryIdeasSnapshot,
  buildDiscoverySessionsSnapshot,
} from "@/lib/discovery";
import {
  buildDiscoveryReplaySnapshot,
  buildDiscoveryTracesSnapshot,
} from "@/lib/discovery-history";
import {
  buildDiscoveryReviewStatsFromRecords,
} from "@/lib/discovery-review-model";
import {
  buildDiscoveryReviewSnapshot,
} from "@/lib/discovery-review";
import {
  buildExecutionIntakeSnapshot,
  buildExecutionWorkspaceSnapshot,
} from "@/lib/execution";
import {
  buildExecutionReviewRollupFromAttentionRecords,
} from "@/lib/execution-review-model";
import { buildExecutionReviewSnapshot } from "@/lib/execution-review";
import {
  buildInboxSnapshot,
} from "@/lib/inbox";
import {
  buildPortfolioSnapshot,
} from "@/lib/portfolio";
import { buildShellReviewCenterSnapshot } from "@/lib/review-center";
import {
  buildShellReviewPressureSummary,
} from "@/lib/review-pressure";
import {
  buildDiscoveryBoardArchiveScopeHref,
  buildDiscoveryBoardFinalsScopeHref,
  buildDiscoveryBoardRankingScopeHref,
  buildDiscoveryBoardScopeHref,
  buildDiscoveryBoardSimulationIdeaScopeHref,
  buildDiscoveryBoardSimulationsScopeHref,
  buildDiscoveryAuthoringScopeHref,
  buildDashboardScopeHref,
  buildDiscoveryIdeaAuthoringScopeHref,
  buildDiscoveryIdeaScopeHref,
  buildDiscoveryReplayScopeHref,
  buildDiscoveryReviewScopeHref,
  buildDiscoverySessionScopeHref,
  buildDiscoveryTraceIdeaScopeHref,
  buildDiscoveryTracesScopeHref,
  buildExecutionIntakeScopeHref,
  buildExecutionProjectScopeHref,
  buildExecutionReviewScopeHref,
  buildInboxScopeHref,
  buildPortfolioScopeHref,
  buildReviewScopeHref,
  hasShellRouteScope,
  type ShellRouteScope,
} from "@/lib/route-scope";
import {
  buildUpstreamQuery,
  formatUpstreamErrorMessage,
  requestUpstreamJson as requestBaseUpstreamJson,
} from "@/lib/upstream";

const PARITY_SAMPLE_LIMIT = 5;
const PARITY_UPSTREAM_TIMEOUT_MS = 8000;
const PARITY_COMPOSITE_UPSTREAM_TIMEOUT_MS = 12000;

type UpstreamKind = "quorum" | "autopilot" | "composite";
type ParityBuilderOptions = {
  routeScope?: Partial<ShellRouteScope> | null;
  discoverySessionId?: string | null;
  discoveryIdeaId?: string | null;
};

function emptySummary() {
  return {
    okCount: 0,
    driftCount: 0,
    blockedCount: 0,
    errorCount: 0,
  };
}

function requestUpstreamJson<T>(
  upstream: "quorum" | "autopilot",
  path: string,
  searchParams?: URLSearchParams
) {
  return requestBaseUpstreamJson<T>(upstream, path, searchParams, {
    timeoutMs: PARITY_UPSTREAM_TIMEOUT_MS,
  });
}

function emptyShellParityAuditSnapshot(): ShellParityAuditSnapshot {
  return {
    generatedAt: "",
    records: [],
    drilldowns: [],
    summary: emptySummary(),
    drilldownSummary: emptySummary(),
    errors: [],
    loadState: "ready",
  };
}

function normalizeId(value: string | null | undefined) {
  return (value || "").trim();
}

function normalizeRouteScope(scope?: Partial<ShellRouteScope> | null): ShellRouteScope {
  return {
    projectId: normalizeId(scope?.projectId),
    intakeSessionId: normalizeId(scope?.intakeSessionId),
  };
}

function uniqueIds(ids: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const values: string[] = [];

  for (const candidate of ids) {
    const id = normalizeId(candidate);
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    values.push(id);
  }

  return values;
}

function sampleIds(ids: string[]) {
  return ids.slice(0, PARITY_SAMPLE_LIMIT);
}

function diffIds(sourceIds: string[], targetIds: string[]) {
  const targetSet = new Set(targetIds);
  return sourceIds.filter((id) => !targetSet.has(id));
}

function joinSampleIds(ids: string[]) {
  return ids.length > 0 ? ids.join(", ") : "none";
}

function joinNonEmptyDetails(
  ...values: Array<string | null | undefined>
) {
  const normalized = values
    .map((value) => normalizeId(value))
    .filter(Boolean);
  return normalized.length > 0 ? normalized.join(" ") : null;
}

function normalizeSemanticText(value: string | null | undefined) {
  return normalizeId(value).toLowerCase().replace(/\s+/g, " ");
}

function serializeSemanticAxes(value: Record<string, string> | null | undefined) {
  return Object.entries(value ?? {})
    .map(([key, axisValue]) => [normalizeSemanticText(key), normalizeSemanticText(axisValue)] as const)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, axisValue]) => `${key}=${axisValue}`)
    .join("|");
}

function buildArchiveCellSemanticId(cell: QuorumIdeaArchiveCell) {
  return [
    "archive-cell",
    normalizeSemanticText(cell.key),
    normalizeSemanticText(cell.domain),
    normalizeSemanticText(cell.complexity),
    normalizeSemanticText(cell.distribution_strategy),
    normalizeSemanticText(cell.buyer_type),
  ].join(":");
}

function buildArchiveProfileSemanticId(profile: {
  profile_id?: string | null;
  operator_kind: string;
  label: string;
}) {
  const fallback = `${normalizeSemanticText(profile.operator_kind)}:${normalizeSemanticText(profile.label)}`;
  return `archive-profile:${normalizeId(profile.profile_id) || fallback}`;
}

function buildArchiveRecommendationSemanticId(
  recommendation: QuorumEvolutionRecommendation
) {
  return [
    "archive-recommendation",
    normalizeSemanticText(recommendation.operator_kind),
    normalizeId(recommendation.prompt_profile_id) || "none",
    serializeSemanticAxes(recommendation.target_axes) || "no-axes",
  ].join(":");
}

function buildArchiveCheckpointSemanticId(checkpoint: {
  checkpoint_id?: string | null;
  generation: number;
  created_at: string;
}) {
  return [
    "archive-checkpoint",
    normalizeId(checkpoint.checkpoint_id) || `generation:${checkpoint.generation}`,
    normalizeId(checkpoint.created_at) || "no-time",
  ].join(":");
}

function buildArchiveGenomeSemanticId(genome: QuorumIdeaGenome) {
  return [
    "archive-genome",
    normalizeSemanticText(genome.domain),
    normalizeSemanticText(genome.complexity),
    normalizeSemanticText(genome.distribution_strategy),
    normalizeSemanticText(genome.buyer_type),
    normalizeId(genome.prompt_profile_id) || "none",
  ].join(":");
}

function buildSwipeQueueSemanticId(item: QuorumIdeaQueueItem) {
  return [
    "queue",
    normalizeSemanticText(item.queue_kind),
    normalizeId(item.idea.idea_id),
  ].join(":");
}

function snapshotErrorsDetail(errors?: string[] | null) {
  if (!errors || errors.length === 0) {
    return null;
  }
  return errors.join(" ");
}

function countStatuses<T extends { status: ShellParityAuditStatus }>(
  records: T[],
  status: ShellParityAuditStatus
) {
  return records.filter((record) => record.status === status).length;
}

function buildStatusSummary<T extends { status: ShellParityAuditStatus }>(records: T[]) {
  return {
    okCount: countStatuses(records, "ok"),
    driftCount: countStatuses(records, "drift"),
    blockedCount: countStatuses(records, "blocked"),
    errorCount: countStatuses(records, "error"),
  };
}

function buildUpstreamRoute(
  path: string,
  query?: string | URLSearchParams | null
) {
  if (!query) {
    return path;
  }

  const serializedQuery =
    typeof query === "string" ? query.replace(/^\?/, "") : query.toString();

  return serializedQuery ? `${path}?${serializedQuery}` : path;
}

function findCategoryError(errors: string[], labels: string[]) {
  return (
    errors.find((error) =>
      labels.some((label) => error.startsWith(`${label}:`))
    ) ?? null
  );
}

function collectCategoryErrors(errors: string[] | null | undefined, labels: string[]) {
  if (!errors || errors.length === 0) {
    return null;
  }

  const matching = errors.filter((error) =>
    labels.some((label) => error.startsWith(`${label}:`))
  );

  return matching.length > 0 ? matching.join(" ") : null;
}

function buildAttentionRecordKeys(args: {
  discoveryFeed: QuorumDiscoveryInboxFeed;
  projects: AutopilotProjectSummary[];
  intakeSessions: AutopilotIntakeSessionSummary[];
  approvals: AutopilotExecutionApprovalRecord[];
  issues: AutopilotExecutionIssueRecord[];
  runtimes: AutopilotToolPermissionRuntimeRecord[];
  chains: ShellChainRecord[];
}) {
  return buildShellAttentionRecords({
    discoveryFeed: args.discoveryFeed,
    projects: args.projects,
    intakeSessions: args.intakeSessions,
    approvals: args.approvals,
    issues: args.issues,
    runtimes: args.runtimes,
    chains: args.chains,
    routeScope: null,
  }).map((record) => record.key);
}

function buildScopedAttentionRecords(
  records: ReturnType<typeof buildShellAttentionRecords>,
  routeScope: ShellRouteScope
) {
  if (!hasShellRouteScope(routeScope)) {
    return records;
  }

  return records.filter((record) => matchesAttentionRouteScope(record, routeScope));
}

function formatMismatchDetail(args: {
  shellIds: string[];
  upstreamIds: string[];
  shellCount: number;
  upstreamCount: number;
}) {
  const missingInShell = diffIds(args.upstreamIds, args.shellIds);
  const missingInUpstream = diffIds(args.shellIds, args.upstreamIds);
  const countMatches = args.shellCount === args.upstreamCount;

  if (missingInShell.length === 0 && missingInUpstream.length === 0) {
    return `Shell ids and upstream ids match at ${args.shellCount}.`;
  }

  if (countMatches) {
    return `Counts match at ${args.shellCount}, but id sets differ. Missing in shell: ${joinSampleIds(
      sampleIds(missingInShell)
    )}. Missing in upstream: ${joinSampleIds(sampleIds(missingInUpstream))}.`;
  }

  return `Shell count ${args.shellCount} does not match upstream count ${args.upstreamCount}. Missing in shell: ${joinSampleIds(
    sampleIds(missingInShell)
  )}. Missing in upstream: ${joinSampleIds(sampleIds(missingInUpstream))}.`;
}

function buildParityDetail(args: {
  shellIds: string[];
  upstreamIds: string[];
  shellError: string | null;
  upstreamError: string | null;
}) {
  if (args.upstreamError) {
    return args.shellError
      ? `${args.upstreamError} Shell snapshot also reported: ${args.shellError}`
      : args.upstreamError;
  }

  if (args.shellError) {
    return args.shellError;
  }

  return formatMismatchDetail({
    shellIds: args.shellIds,
    upstreamIds: args.upstreamIds,
    shellCount: args.shellIds.length,
    upstreamCount: args.upstreamIds.length,
  });
}

function buildIdParityRecord(args: {
  key: string;
  label: string;
  upstream: UpstreamKind;
  shellRoute: string;
  shellSurfaceHref: string;
  upstreamRoute: string;
  shellIds: string[];
  shellError: string | null;
  upstreamIds: string[];
  upstreamError: string | null;
}): ShellParityAuditRecord {
  const shellIds = uniqueIds(args.shellIds);
  const upstreamIds = uniqueIds(args.upstreamIds);
  const missingInShell = diffIds(upstreamIds, shellIds);
  const missingInUpstream = diffIds(shellIds, upstreamIds);

  let status: ShellParityAuditStatus = "ok";
  if (args.upstreamError) {
    status = "blocked";
  } else if (args.shellError) {
    status = "error";
  } else if (
    shellIds.length !== upstreamIds.length ||
    missingInShell.length > 0 ||
    missingInUpstream.length > 0
  ) {
    status = "drift";
  }

  return {
    key: args.key,
    label: args.label,
    upstream: args.upstream,
    shellRoute: args.shellRoute,
    shellSurfaceHref: args.shellSurfaceHref,
    upstreamRoute: args.upstreamRoute,
    status,
    shellCount: shellIds.length,
    upstreamCount: upstreamIds.length,
    detail: buildParityDetail({
      shellIds,
      upstreamIds,
      shellError: args.shellError,
      upstreamError: args.upstreamError,
    }),
    shellSampleIds: sampleIds(shellIds),
    upstreamSampleIds: sampleIds(upstreamIds),
    missingInShellSampleIds: sampleIds(missingInShell),
    missingInUpstreamSampleIds: sampleIds(missingInUpstream),
  };
}

function asMetricValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "n/a";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
}

function buildDrilldownMetric(
  label: string,
  shellValue: unknown,
  upstreamValue: unknown
): ShellParityAuditDrilldownMetric {
  const normalizedShellValue = asMetricValue(shellValue);
  const normalizedUpstreamValue = asMetricValue(upstreamValue);

  return {
    label,
    shellValue: normalizedShellValue,
    upstreamValue: normalizedUpstreamValue,
    matches: normalizedShellValue === normalizedUpstreamValue,
  };
}

function summarizeMetricDrift(metrics: ShellParityAuditDrilldownMetric[]) {
  const mismatched = metrics.filter((metric) => !metric.matches).map((metric) => metric.label);
  return mismatched.length > 0 ? mismatched : [];
}

function buildDrilldownDetail(args: {
  targetId: string;
  shellError: string | null;
  upstreamError: string | null;
  mismatchedMetricLabels: string[];
}) {
  if (args.upstreamError) {
    return args.shellError
      ? `${args.upstreamError} Shell drilldown also reported: ${args.shellError}`
      : args.upstreamError;
  }

  if (args.shellError) {
    return args.shellError;
  }

  if (args.mismatchedMetricLabels.length === 0) {
    return `Shell detail matches upstream for ${args.targetId}.`;
  }

  return `Detail drift detected for ${args.targetId}. Mismatched metrics: ${args.mismatchedMetricLabels.join(
    ", "
  )}.`;
}

function buildParityDrilldown(args: {
  key: string;
  label: string;
  upstream: UpstreamKind;
  shellRoute: string;
  shellSurfaceHref: string;
  upstreamRoute: string;
  targetId: string;
  shellError: string | null;
  upstreamError: string | null;
  metrics: ShellParityAuditDrilldownMetric[];
}): ShellParityAuditDrilldown {
  const mismatchedMetricLabels = summarizeMetricDrift(args.metrics);
  let status: ShellParityAuditStatus = "ok";

  if (args.upstreamError) {
    status = "blocked";
  } else if (args.shellError) {
    status = "error";
  } else if (mismatchedMetricLabels.length > 0) {
    status = "drift";
  }

  return {
    key: args.key,
    label: args.label,
    upstream: args.upstream,
    shellRoute: args.shellRoute,
    shellSurfaceHref: args.shellSurfaceHref,
    upstreamRoute: args.upstreamRoute,
    targetId: args.targetId,
    status,
    detail: buildDrilldownDetail({
      targetId: args.targetId,
      shellError: args.shellError,
      upstreamError: args.upstreamError,
      mismatchedMetricLabels,
    }),
    metrics: args.metrics,
  };
}

function firstNonEmptyId(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const id = normalizeId(value);
    if (id) {
      return id;
    }
  }
  return "";
}

function firstSessionId(
  shellSnapshot: Awaited<ReturnType<typeof buildDiscoverySessionsSnapshot>> | null,
  upstreamResult:
    | { status: "fulfilled"; value: QuorumSessionSummary[] }
    | PromiseRejectedResult
    | null
) {
  return firstNonEmptyId(
    shellSnapshot?.sessions[0]?.id,
    upstreamResult && upstreamResult.status === "fulfilled"
      ? upstreamResult.value[0]?.id
      : ""
  );
}

function firstIdeaId(
  shellSnapshot: Awaited<ReturnType<typeof buildDiscoveryIdeasSnapshot>> | null,
  upstreamResult:
    | { status: "fulfilled"; value: { ideas: QuorumDiscoveryIdea[] } }
    | PromiseRejectedResult
    | null
) {
  return firstNonEmptyId(
    shellSnapshot?.ideas[0]?.idea_id,
    upstreamResult && upstreamResult.status === "fulfilled"
      ? upstreamResult.value.ideas[0]?.idea_id
      : ""
  );
}

function firstProjectId(
  shellSnapshot: Awaited<ReturnType<typeof buildExecutionWorkspaceSnapshot>> | null,
  upstreamResult:
    | { status: "fulfilled"; value: { projects: AutopilotProjectSummary[] } }
    | PromiseRejectedResult
    | null
) {
  return firstNonEmptyId(
    shellSnapshot?.projects[0]?.id,
    upstreamResult && upstreamResult.status === "fulfilled"
      ? upstreamResult.value.projects[0]?.id
      : ""
  );
}

function firstIntakeSessionId(
  shellSnapshot: Awaited<ReturnType<typeof buildExecutionIntakeSnapshot>> | null,
  upstreamResult:
    | { status: "fulfilled"; value: { sessions: AutopilotIntakeSessionSummary[] } }
    | PromiseRejectedResult
    | null
) {
  return firstNonEmptyId(
    shellSnapshot?.intakeSessions[0]?.id,
    upstreamResult && upstreamResult.status === "fulfilled"
      ? upstreamResult.value.sessions[0]?.id
      : ""
  );
}

async function buildDiscoverySessionDrilldown(args: {
  targetId: string;
  routeScope: ShellRouteScope;
}) {
  const upstreamRoute = `orchestrate/session/${encodeURIComponent(args.targetId)}`;
  const [shellResult, upstreamResult] = await Promise.allSettled([
    buildDiscoverySessionsSnapshot(args.targetId),
    requestUpstreamJson<QuorumSession>("quorum", upstreamRoute),
  ]);

  const shellSnapshot = shellResult.status === "fulfilled" ? shellResult.value : null;
  const shellSession = shellSnapshot?.session ?? null;
  const upstreamSession = upstreamResult.status === "fulfilled" ? upstreamResult.value : null;

  return buildParityDrilldown({
    key: "discoverySessionDetail",
    label: "Discovery session detail",
    upstream: "quorum",
    shellRoute: "/api/shell/discovery/sessions",
    shellSurfaceHref: buildDiscoverySessionScopeHref(args.targetId, args.routeScope),
    upstreamRoute,
    targetId: args.targetId,
    shellError:
      shellResult.status === "rejected"
        ? formatUpstreamErrorMessage("Discovery session snapshot", shellResult.reason)
        : shellSnapshot?.sessionError ?? null,
    upstreamError:
      upstreamResult.status === "rejected"
        ? formatUpstreamErrorMessage("Quorum session", upstreamResult.reason)
        : null,
    metrics: [
      buildDrilldownMetric("status", shellSession?.status, upstreamSession?.status),
      buildDrilldownMetric(
        "messages",
        shellSession?.messages.length ?? null,
        upstreamSession?.messages.length ?? null
      ),
      buildDrilldownMetric(
        "events",
        shellSnapshot?.events.length ?? null,
        upstreamSession?.events?.length ?? null
      ),
      buildDrilldownMetric(
        "active node",
        shellSession?.active_node ?? null,
        upstreamSession?.active_node ?? null
      ),
    ],
  });
}

async function buildDiscoveryIdeaDrilldown(args: {
  targetId: string;
  routeScope: ShellRouteScope;
}) {
  const upstreamRoute = `orchestrate/discovery/ideas/${encodeURIComponent(
    args.targetId
  )}/dossier`;
  const [shellResult, upstreamResult] = await Promise.allSettled([
    buildDiscoveryIdeasSnapshot(args.targetId, { limit: 24 }),
    requestUpstreamJson<QuorumIdeaDossier>("quorum", upstreamRoute),
  ]);

  const shellSnapshot = shellResult.status === "fulfilled" ? shellResult.value : null;
  const shellDossier = shellSnapshot?.dossier ?? null;
  const upstreamDossier = upstreamResult.status === "fulfilled" ? upstreamResult.value : null;

  return buildParityDrilldown({
    key: "discoveryIdeaDetail",
    label: "Discovery dossier detail",
    upstream: "quorum",
    shellRoute: "/api/shell/discovery/ideas",
    shellSurfaceHref: buildDiscoveryIdeaScopeHref(args.targetId, args.routeScope),
    upstreamRoute,
    targetId: args.targetId,
    shellError:
      shellResult.status === "rejected"
        ? formatUpstreamErrorMessage("Discovery dossier snapshot", shellResult.reason)
        : shellSnapshot?.dossierError ?? null,
    upstreamError:
      upstreamResult.status === "rejected"
        ? formatUpstreamErrorMessage("Discovery dossier", upstreamResult.reason)
        : null,
    metrics: [
      buildDrilldownMetric(
        "observations",
        shellDossier?.observations.length ?? null,
        upstreamDossier?.observations.length ?? null
      ),
      buildDrilldownMetric(
        "validation reports",
        shellDossier?.validation_reports.length ?? null,
        upstreamDossier?.validation_reports.length ?? null
      ),
      buildDrilldownMetric(
        "decisions",
        shellDossier?.decisions.length ?? null,
        upstreamDossier?.decisions.length ?? null
      ),
      buildDrilldownMetric(
        "timeline",
        shellDossier?.timeline.length ?? null,
        upstreamDossier?.timeline.length ?? null
      ),
      buildDrilldownMetric(
        "execution outcomes",
        shellDossier?.execution_outcomes.length ?? null,
        upstreamDossier?.execution_outcomes.length ?? null
      ),
      buildDrilldownMetric(
        "brief id",
        shellDossier?.execution_brief_candidate?.brief_id ?? null,
        upstreamDossier?.execution_brief_candidate?.brief_id ?? null
      ),
    ],
  });
}

async function buildExecutionProjectDrilldown(args: {
  targetId: string;
  routeScope: ShellRouteScope;
}) {
  const upstreamRoute = `projects/${encodeURIComponent(args.targetId)}`;
  const [shellResult, upstreamResult] = await Promise.allSettled([
    buildExecutionWorkspaceSnapshot(args.targetId),
    requestUpstreamJson<AutopilotProjectDetail>("autopilot", upstreamRoute),
  ]);

  const shellSnapshot = shellResult.status === "fulfilled" ? shellResult.value : null;
  const shellProject = shellSnapshot?.project ?? null;
  const upstreamProject = upstreamResult.status === "fulfilled" ? upstreamResult.value : null;

  return buildParityDrilldown({
    key: "executionProjectDetail",
    label: "Execution project detail",
    upstream: "autopilot",
    shellRoute: "/api/shell/execution/workspace",
    shellSurfaceHref: buildExecutionProjectScopeHref(args.targetId, args.routeScope),
    upstreamRoute,
    targetId: args.targetId,
    shellError:
      shellResult.status === "rejected"
        ? formatUpstreamErrorMessage("Execution project snapshot", shellResult.reason)
        : shellSnapshot?.projectError ?? null,
    upstreamError:
      upstreamResult.status === "rejected"
        ? formatUpstreamErrorMessage("Autopilot project", upstreamResult.reason)
        : null,
    metrics: [
      buildDrilldownMetric("status", shellProject?.status, upstreamProject?.status),
      buildDrilldownMetric("paused", shellProject?.paused, upstreamProject?.paused),
      buildDrilldownMetric(
        "stories",
        shellProject?.stories.length ?? null,
        upstreamProject?.stories.length ?? null
      ),
      buildDrilldownMetric(
        "timeline",
        shellProject?.timeline.length ?? null,
        upstreamProject?.timeline.length ?? null
      ),
      buildDrilldownMetric(
        "current story",
        shellProject?.current_story_id ?? null,
        upstreamProject?.current_story_id ?? null
      ),
    ],
  });
}

async function buildExecutionIntakeDrilldown(args: {
  targetId: string;
  routeScope: ShellRouteScope;
}) {
  const upstreamRoute = `intake/sessions/${encodeURIComponent(args.targetId)}`;
  const [shellResult, upstreamResult] = await Promise.allSettled([
    buildExecutionIntakeSnapshot(args.targetId),
    requestUpstreamJson<AutopilotIntakeSessionDetail>("autopilot", upstreamRoute),
  ]);

  const shellSnapshot = shellResult.status === "fulfilled" ? shellResult.value : null;
  const shellSession = shellSnapshot?.intakeSession ?? null;
  const upstreamSession = upstreamResult.status === "fulfilled" ? upstreamResult.value : null;

  return buildParityDrilldown({
    key: "executionIntakeDetail",
    label: "Execution intake detail",
    upstream: "autopilot",
    shellRoute: "/api/shell/execution/intake",
    shellSurfaceHref: buildExecutionIntakeScopeHref(args.targetId, args.routeScope),
    upstreamRoute,
    targetId: args.targetId,
    shellError:
      shellResult.status === "rejected"
        ? formatUpstreamErrorMessage("Execution intake snapshot", shellResult.reason)
        : shellSnapshot?.intakeSessionError ?? null,
    upstreamError:
      upstreamResult.status === "rejected"
        ? formatUpstreamErrorMessage("Autopilot intake session", upstreamResult.reason)
        : null,
    metrics: [
      buildDrilldownMetric(
        "messages",
        shellSession?.messages.length ?? null,
        upstreamSession?.messages.length ?? null
      ),
      buildDrilldownMetric(
        "prd ready",
        shellSession?.prd_ready ?? null,
        upstreamSession?.prd_ready ?? null
      ),
      buildDrilldownMetric(
        "bootstrap ready",
        shellSession?.bootstrap_ready ?? null,
        upstreamSession?.bootstrap_ready ?? null
      ),
      buildDrilldownMetric(
        "linked project",
        shellSession?.linked_project_id ?? null,
        upstreamSession?.linked_project_id ?? null
      ),
      buildDrilldownMetric(
        "project name",
        shellSession?.project_name ?? null,
        upstreamSession?.project_name ?? null
      ),
    ],
  });
}

async function buildDiscoveryTraceIdeaDrilldown(args: {
  targetId: string;
  routeScope: ShellRouteScope;
}) {
  const upstreamRoute = `orchestrate/observability/traces/discovery/${encodeURIComponent(
    args.targetId
  )}`;
  const [shellResult, upstreamResult] = await Promise.allSettled([
    buildDiscoveryTracesSnapshot(args.targetId, { traceLimit: 48 }),
    requestUpstreamJson<QuorumIdeaTraceBundle>("quorum", upstreamRoute),
  ]);

  const shellSnapshot = shellResult.status === "fulfilled" ? shellResult.value : null;
  const shellTrace = shellSnapshot?.ideaTrace ?? null;
  const upstreamTrace = upstreamResult.status === "fulfilled" ? upstreamResult.value : null;

  return buildParityDrilldown({
    key: "discoveryTraceIdeaDetail",
    label: "Discovery trace detail",
    upstream: "quorum",
    shellRoute: "/api/shell/discovery/traces",
    shellSurfaceHref: buildDiscoveryTraceIdeaScopeHref(args.targetId, args.routeScope),
    upstreamRoute,
    targetId: args.targetId,
    shellError:
      shellResult.status === "rejected"
        ? formatUpstreamErrorMessage("Discovery trace snapshot", shellResult.reason)
        : shellSnapshot?.ideaTraceError ?? null,
    upstreamError:
      upstreamResult.status === "rejected"
        ? formatUpstreamErrorMessage("Discovery idea trace", upstreamResult.reason)
        : null,
    metrics: [
      buildDrilldownMetric(
        "latest stage",
        shellTrace?.latest_stage ?? null,
        upstreamTrace?.latest_stage ?? null
      ),
      buildDrilldownMetric(
        "linked sessions",
        shellTrace?.linked_session_ids.length ?? null,
        upstreamTrace?.linked_session_ids.length ?? null
      ),
      buildDrilldownMetric(
        "steps",
        shellTrace?.steps.length ?? null,
        upstreamTrace?.steps.length ?? null
      ),
      buildDrilldownMetric(
        "decision steps",
        countTraceKind(shellTrace, "decision"),
        countTraceKind(upstreamTrace, "decision")
      ),
      buildDrilldownMetric(
        "validation steps",
        countTraceKind(shellTrace, "validation"),
        countTraceKind(upstreamTrace, "validation")
      ),
      buildDrilldownMetric(
        "simulation steps",
        countTraceKind(shellTrace, "simulation"),
        countTraceKind(upstreamTrace, "simulation")
      ),
      buildDrilldownMetric(
        "timeline steps",
        countTraceKind(shellTrace, "timeline"),
        countTraceKind(upstreamTrace, "timeline")
      ),
    ],
  });
}

async function buildDiscoveryReplaySessionDrilldown(args: {
  targetId: string;
  routeScope: ShellRouteScope;
}) {
  const upstreamRoute = `orchestrate/observability/debate-replay/sessions/${encodeURIComponent(
    args.targetId
  )}`;
  const [shellResult, upstreamResult] = await Promise.allSettled([
    buildDiscoveryReplaySnapshot(args.targetId, { sessionLimit: 12 }),
    requestUpstreamJson<QuorumDebateReplaySession>("quorum", upstreamRoute),
  ]);

  const shellSnapshot = shellResult.status === "fulfilled" ? shellResult.value : null;
  const shellReplay = shellSnapshot?.replay ?? null;
  const upstreamReplay =
    upstreamResult.status === "fulfilled" ? upstreamResult.value : null;

  return buildParityDrilldown({
    key: "discoveryReplaySessionDetail",
    label: "Discovery replay detail",
    upstream: "quorum",
    shellRoute: "/api/shell/discovery/replays",
    shellSurfaceHref: buildDiscoveryReplayScopeHref(args.targetId, args.routeScope),
    upstreamRoute,
    targetId: args.targetId,
    shellError:
      shellResult.status === "rejected"
        ? formatUpstreamErrorMessage("Discovery replay snapshot", shellResult.reason)
        : shellSnapshot?.replayError ?? null,
    upstreamError:
      upstreamResult.status === "rejected"
        ? formatUpstreamErrorMessage("Debate replay", upstreamResult.reason)
        : null,
    metrics: [
      buildDrilldownMetric("status", shellReplay?.status ?? null, upstreamReplay?.status ?? null),
      buildDrilldownMetric(
        "participants",
        shellReplay?.participants.length ?? null,
        upstreamReplay?.participants.length ?? null
      ),
      buildDrilldownMetric(
        "events",
        shellReplay?.event_count ?? null,
        upstreamReplay?.event_count ?? null
      ),
      buildDrilldownMetric(
        "checkpoints",
        shellReplay?.checkpoint_count ?? null,
        upstreamReplay?.checkpoint_count ?? null
      ),
      buildDrilldownMetric(
        "invalid transitions",
        shellReplay?.invalid_transition_count ?? null,
        upstreamReplay?.invalid_transition_count ?? null
      ),
      buildDrilldownMetric(
        "generation artifacts",
        shellReplay?.generation_artifact_count ?? null,
        upstreamReplay?.generation_artifact_count ?? null
      ),
      buildDrilldownMetric(
        "timeline steps",
        shellReplay?.timeline.length ?? null,
        upstreamReplay?.timeline.length ?? null
      ),
    ],
  });
}

function buildScopedCompositeTargetId(scope: ShellRouteScope) {
  if (scope.projectId && scope.intakeSessionId) {
    return `${scope.projectId}:${scope.intakeSessionId}`;
  }
  return scope.projectId || scope.intakeSessionId || "global";
}

function countTraceKind(
  bundle: QuorumIdeaTraceBundle | null | undefined,
  kind: string
) {
  return bundle?.steps.filter((step) => step.trace_kind === kind).length ?? null;
}

function sortBoardOverviewSimulationIdeas(items: QuorumDiscoveryIdea[]) {
  function simulationPriority(idea: QuorumDiscoveryIdea) {
    if (idea.latest_stage === "executed") return 5;
    if (idea.latest_stage === "handed_off") return 4;
    if (idea.latest_stage === "simulated") return 3;
    if (idea.simulation_state && idea.simulation_state !== "idle") return 2;
    return 1;
  }

  return [...items].sort((left, right) => {
    const stageDelta = simulationPriority(right) - simulationPriority(left);
    if (stageDelta !== 0) {
      return stageDelta;
    }

    const rankDelta = right.rank_score - left.rank_score;
    if (rankDelta !== 0) {
      return rankDelta;
    }

    const leftTime = Date.parse(left.updated_at || left.created_at || "") || 0;
    const rightTime = Date.parse(right.updated_at || right.created_at || "") || 0;
    return rightTime - leftTime;
  });
}

function buildDiscoveryScoreboardIds(
  scoreboard: QuorumDiscoveryObservabilityScoreboard | null | undefined
) {
  return uniqueIds([
    ...(scoreboard?.metrics.map((metric) => `metric:${metric.key}`) ?? []),
    scoreboard ? `strong-count:${scoreboard.strongest_ideas.length}` : null,
    scoreboard ? `weak-count:${scoreboard.weakest_ideas.length}` : null,
    ...(scoreboard?.protocol_regressions.map(
      (regression) => `protocol:${regression.protocol_key}:${regression.mode}`
    ) ?? []),
  ]);
}

function buildDiscoveryRankingIds(args: {
  leaderboard: QuorumRankingLeaderboardResponse | null | undefined;
  nextPair?: QuorumNextPairResponse | null | undefined;
  archive?: QuorumIdeaArchiveSnapshot | null | undefined;
}) {
  return uniqueIds([
    ...(args.leaderboard?.items.map(
      (item) => `leaderboard:${item.idea.idea_id}`
    ) ?? []),
    ...(args.leaderboard?.judges.map((judge) => `judge:${judge.judge_key}`) ?? []),
    ...(args.archive?.cells.map(buildArchiveCellSemanticId) ?? []),
    ...(args.archive?.prompt_profiles.map(buildArchiveProfileSemanticId) ?? []),
    ...(args.archive?.recommendations.map(
      buildArchiveRecommendationSemanticId
    ) ?? []),
    ...(args.archive?.checkpoints.map(buildArchiveCheckpointSemanticId) ?? []),
    ...(args.archive?.top_genomes.map(buildArchiveGenomeSemanticId) ?? []),
  ]);
}

function buildDiscoverySwipeQueueIds(
  swipeQueue: QuorumSwipeQueueResponse | null | undefined
) {
  return uniqueIds(swipeQueue?.items.map(buildSwipeQueueSemanticId) ?? []);
}

function buildDiscoveryBoardSurfaceIds(args: {
  scoreboard: QuorumDiscoveryObservabilityScoreboard | null | undefined;
  leaderboard: QuorumRankingLeaderboardResponse | null | undefined;
  nextPair: QuorumNextPairResponse | null | undefined;
  swipeQueue: QuorumSwipeQueueResponse | null | undefined;
  simulationIdeas: QuorumDiscoveryIdea[];
}) {
  return uniqueIds([
    ...buildDiscoveryScoreboardIds(args.scoreboard),
    ...buildDiscoveryRankingIds({
      leaderboard: args.leaderboard,
      nextPair: args.nextPair,
    }),
    ...buildDiscoverySwipeQueueIds(args.swipeQueue),
    ...args.simulationIdeas.map((idea) => `simulation:${idea.idea_id}`),
  ]);
}

function buildDiscoveryBoardHistoryIds(args: {
  archive: QuorumIdeaArchiveSnapshot | null | undefined;
  leaderboard: QuorumRankingLeaderboardResponse | null | undefined;
  ideas: QuorumDiscoveryIdea[];
}) {
  return uniqueIds([
    ...buildDiscoveryRankingIds({
      leaderboard: args.leaderboard,
      archive: args.archive,
    }),
    ...args.ideas.map((idea) => `idea:${idea.idea_id}`),
  ]);
}

function buildDiscoverySimulationSurfaceIds(ideas: QuorumDiscoveryIdea[]) {
  return uniqueIds(ideas.map((idea) => `idea:${idea.idea_id}`));
}

async function buildDiscoveryBoardOverviewDrilldown(args: {
  routeScope: ShellRouteScope;
}) {
  const upstreamBoardIdeasQuery = buildUpstreamQuery({ limit: 18 });
  const upstreamSwipeQueueQuery = buildUpstreamQuery({ limit: 6 });
  const upstreamLeaderboardQuery = buildUpstreamQuery({ limit: 10 });

  const [shellResult, scoreboardResult, leaderboardResult, nextPairResult, swipeQueueResult, ideasResult] =
    await Promise.allSettled([
      buildDiscoveryBoardSnapshot(),
      requestUpstreamJson<QuorumDiscoveryObservabilityScoreboard>(
        "quorum",
        "orchestrate/observability/scoreboards/discovery"
      ),
      requestUpstreamJson<QuorumRankingLeaderboardResponse>(
        "quorum",
        "orchestrate/ranking/leaderboard",
        upstreamLeaderboardQuery
      ),
      requestUpstreamJson<{ pair?: QuorumNextPairResponse | null }>(
        "quorum",
        "orchestrate/ranking/next-pair"
      ),
      requestUpstreamJson<QuorumSwipeQueueResponse>(
        "quorum",
        "orchestrate/discovery/swipe-queue",
        upstreamSwipeQueueQuery
      ),
      requestUpstreamJson<{ ideas: QuorumDiscoveryIdea[] }>(
        "quorum",
        "orchestrate/discovery/ideas",
        upstreamBoardIdeasQuery
      ),
    ]);

  const shellSnapshot = shellResult.status === "fulfilled" ? shellResult.value : null;
  const upstreamScoreboard = scoreboardResult.status === "fulfilled" ? scoreboardResult.value : null;
  const upstreamLeaderboard = leaderboardResult.status === "fulfilled" ? leaderboardResult.value : null;
  const upstreamNextPair =
    nextPairResult.status === "fulfilled" ? nextPairResult.value.pair ?? null : null;
  const upstreamSwipeQueue = swipeQueueResult.status === "fulfilled" ? swipeQueueResult.value : null;
  const upstreamSimulationIdeas =
    ideasResult.status === "fulfilled"
      ? sortBoardOverviewSimulationIdeas(
          ideasResult.value.ideas.filter(
            (idea) => idea.validation_state !== "archived"
          )
        ).slice(0, 6)
      : [];

  return buildParityDrilldown({
    key: "discoveryBoardOverviewDetail",
    label: "Discovery board overview",
    upstream: "composite",
    shellRoute: "/api/shell/discovery/board",
    shellSurfaceHref: buildDiscoveryBoardScopeHref(args.routeScope),
    upstreamRoute: "composite/discovery-board",
    targetId: "board",
    shellError:
      shellResult.status === "rejected"
        ? formatUpstreamErrorMessage("Discovery board snapshot", shellResult.reason)
        : joinNonEmptyDetails(
            shellSnapshot?.scoreboardError,
            shellSnapshot?.rankingError,
            shellSnapshot?.swipeQueueError,
            shellSnapshot?.simulationIdeasError
          ),
    upstreamError: joinNonEmptyDetails(
      scoreboardResult.status === "rejected"
        ? formatUpstreamErrorMessage(
            "Discovery observability scoreboard",
            scoreboardResult.reason
          )
        : null,
      leaderboardResult.status === "rejected"
        ? formatUpstreamErrorMessage("Ranking leaderboard", leaderboardResult.reason)
        : null,
      nextPairResult.status === "rejected"
        ? formatUpstreamErrorMessage("Ranking next pair", nextPairResult.reason)
        : null,
      swipeQueueResult.status === "rejected"
        ? formatUpstreamErrorMessage("Swipe queue", swipeQueueResult.reason)
        : null,
      ideasResult.status === "rejected"
        ? formatUpstreamErrorMessage("Discovery ideas", ideasResult.reason)
        : null
    ),
    metrics: [
      buildDrilldownMetric(
        "scoreboard idea count",
        shellSnapshot?.scoreboard?.idea_count ?? null,
        upstreamScoreboard?.idea_count ?? null
      ),
      buildDrilldownMetric(
        "active ideas",
        shellSnapshot?.scoreboard?.active_idea_count ?? null,
        upstreamScoreboard?.active_idea_count ?? null
      ),
      buildDrilldownMetric(
        "sessions",
        shellSnapshot?.scoreboard?.session_count ?? null,
        upstreamScoreboard?.session_count ?? null
      ),
      buildDrilldownMetric(
        "leaderboard items",
        shellSnapshot?.leaderboard?.items.length ?? null,
        upstreamLeaderboard?.items.length ?? null
      ),
      buildDrilldownMetric(
        "next pair candidate pool",
        shellSnapshot?.nextPair?.candidate_pool_size ?? null,
        upstreamNextPair?.candidate_pool_size ?? null
      ),
      buildDrilldownMetric(
        "next pair direct comparisons",
        shellSnapshot?.nextPair?.direct_comparisons ?? null,
        upstreamNextPair?.direct_comparisons ?? null
      ),
      buildDrilldownMetric(
        "swipe queue items",
        shellSnapshot?.swipeQueue?.items.length ?? null,
        upstreamSwipeQueue?.items.length ?? null
      ),
      buildDrilldownMetric(
        "simulation ideas",
        shellSnapshot?.simulationIdeas.length ?? null,
        upstreamSimulationIdeas.length
      ),
    ],
  });
}

async function buildDiscoveryBoardRankingDrilldown(args: {
  routeScope: ShellRouteScope;
}) {
  const leaderboardQuery = buildUpstreamQuery({ limit: 16 });
  const archiveQuery = buildUpstreamQuery({ limit_cells: 12 });

  const [shellResult, leaderboardResult, nextPairResult, archiveResult] =
    await Promise.allSettled([
      buildDiscoveryRankingSnapshot(),
      requestUpstreamJson<QuorumRankingLeaderboardResponse>(
        "quorum",
        "orchestrate/ranking/leaderboard",
        leaderboardQuery
      ),
      requestUpstreamJson<{ pair?: QuorumNextPairResponse | null }>(
        "quorum",
        "orchestrate/ranking/next-pair"
      ),
      requestUpstreamJson<QuorumIdeaArchiveSnapshot>(
        "quorum",
        "orchestrate/ranking/archive",
        archiveQuery
      ),
    ]);

  const shellSnapshot = shellResult.status === "fulfilled" ? shellResult.value : null;
  const upstreamLeaderboard = leaderboardResult.status === "fulfilled" ? leaderboardResult.value : null;
  const upstreamNextPair =
    nextPairResult.status === "fulfilled" ? nextPairResult.value.pair ?? null : null;
  const upstreamArchive = archiveResult.status === "fulfilled" ? archiveResult.value : null;

  return buildParityDrilldown({
    key: "discoveryBoardRankingDetail",
    label: "Discovery board ranking detail",
    upstream: "composite",
    shellRoute: "/api/shell/discovery/board/ranking",
    shellSurfaceHref: buildDiscoveryBoardRankingScopeHref(args.routeScope),
    upstreamRoute: "composite/discovery-board/ranking",
    targetId: "ranking",
    shellError:
      shellResult.status === "rejected"
        ? formatUpstreamErrorMessage("Discovery ranking snapshot", shellResult.reason)
        : joinNonEmptyDetails(
            shellSnapshot?.leaderboardError,
            shellSnapshot?.nextPairError,
            shellSnapshot?.archiveError
          ),
    upstreamError: joinNonEmptyDetails(
      leaderboardResult.status === "rejected"
        ? formatUpstreamErrorMessage("Ranking leaderboard", leaderboardResult.reason)
        : null,
      nextPairResult.status === "rejected"
        ? formatUpstreamErrorMessage("Ranking next pair", nextPairResult.reason)
        : null,
      archiveResult.status === "rejected"
        ? formatUpstreamErrorMessage("Ranking archive", archiveResult.reason)
        : null
    ),
    metrics: [
      buildDrilldownMetric(
        "leaderboard items",
        shellSnapshot?.leaderboard?.items.length ?? null,
        upstreamLeaderboard?.items.length ?? null
      ),
      buildDrilldownMetric(
        "judges",
        shellSnapshot?.leaderboard?.judges.length ?? null,
        upstreamLeaderboard?.judges.length ?? null
      ),
      buildDrilldownMetric(
        "comparisons",
        shellSnapshot?.leaderboard?.metrics.comparisons_count ?? null,
        upstreamLeaderboard?.metrics.comparisons_count ?? null
      ),
      buildDrilldownMetric(
        "next pair candidate pool",
        shellSnapshot?.nextPair?.candidate_pool_size ?? null,
        upstreamNextPair?.candidate_pool_size ?? null
      ),
      buildDrilldownMetric(
        "next pair direct comparisons",
        shellSnapshot?.nextPair?.direct_comparisons ?? null,
        upstreamNextPair?.direct_comparisons ?? null
      ),
      buildDrilldownMetric(
        "archive cells",
        shellSnapshot?.archive?.cells.length ?? null,
        upstreamArchive?.cells.length ?? null
      ),
      buildDrilldownMetric(
        "archive checkpoints",
        shellSnapshot?.archive?.checkpoints.length ?? null,
        upstreamArchive?.checkpoints.length ?? null
      ),
      buildDrilldownMetric(
        "prompt profiles",
        shellSnapshot?.archive?.prompt_profiles.length ?? null,
        upstreamArchive?.prompt_profiles.length ?? null
      ),
    ],
  });
}

async function buildDiscoveryBoardArchiveDrilldown(args: {
  routeScope: ShellRouteScope;
}) {
  const archiveQuery = buildUpstreamQuery({ limit_cells: 24 });
  const leaderboardQuery = buildUpstreamQuery({ limit: 20 });
  const ideasQuery = buildUpstreamQuery({ limit: 40 });

  const [shellResult, archiveResult, leaderboardResult, ideasResult] =
    await Promise.allSettled([
      buildDiscoveryArchiveSnapshot(),
      requestUpstreamJson<QuorumIdeaArchiveSnapshot>(
        "quorum",
        "orchestrate/ranking/archive",
        archiveQuery
      ),
      requestUpstreamJson<QuorumRankingLeaderboardResponse>(
        "quorum",
        "orchestrate/ranking/leaderboard",
        leaderboardQuery
      ),
      requestUpstreamJson<{ ideas: QuorumDiscoveryIdea[] }>(
        "quorum",
        "orchestrate/discovery/ideas",
        ideasQuery
      ),
    ]);

  const shellSnapshot = shellResult.status === "fulfilled" ? shellResult.value : null;
  const upstreamArchive = archiveResult.status === "fulfilled" ? archiveResult.value : null;
  const upstreamLeaderboard = leaderboardResult.status === "fulfilled" ? leaderboardResult.value : null;
  const upstreamIdeas = ideasResult.status === "fulfilled" ? ideasResult.value.ideas : [];

  return buildParityDrilldown({
    key: "discoveryBoardArchiveDetail",
    label: "Discovery board archive detail",
    upstream: "composite",
    shellRoute: "/api/shell/discovery/board/archive",
    shellSurfaceHref: buildDiscoveryBoardArchiveScopeHref(args.routeScope),
    upstreamRoute: "composite/discovery-board/archive",
    targetId: "archive",
    shellError:
      shellResult.status === "rejected"
        ? formatUpstreamErrorMessage("Discovery archive snapshot", shellResult.reason)
        : joinNonEmptyDetails(
            shellSnapshot?.archiveError,
            shellSnapshot?.leaderboardError,
            shellSnapshot?.ideasError
          ),
    upstreamError: joinNonEmptyDetails(
      archiveResult.status === "rejected"
        ? formatUpstreamErrorMessage("Ranking archive", archiveResult.reason)
        : null,
      leaderboardResult.status === "rejected"
        ? formatUpstreamErrorMessage("Ranking leaderboard", leaderboardResult.reason)
        : null,
      ideasResult.status === "rejected"
        ? formatUpstreamErrorMessage("Discovery ideas", ideasResult.reason)
        : null
    ),
    metrics: [
      buildDrilldownMetric(
        "archive cells",
        shellSnapshot?.archive?.cells.length ?? null,
        upstreamArchive?.cells.length ?? null
      ),
      buildDrilldownMetric(
        "checkpoints",
        shellSnapshot?.archive?.checkpoints.length ?? null,
        upstreamArchive?.checkpoints.length ?? null
      ),
      buildDrilldownMetric(
        "prompt profiles",
        shellSnapshot?.archive?.prompt_profiles.length ?? null,
        upstreamArchive?.prompt_profiles.length ?? null
      ),
      buildDrilldownMetric(
        "recommendations",
        shellSnapshot?.archive?.recommendations.length ?? null,
        upstreamArchive?.recommendations.length ?? null
      ),
      buildDrilldownMetric(
        "leaderboard items",
        shellSnapshot?.leaderboard?.items.length ?? null,
        upstreamLeaderboard?.items.length ?? null
      ),
      buildDrilldownMetric(
        "ideas",
        shellSnapshot?.ideas.length ?? null,
        upstreamIdeas.length
      ),
    ],
  });
}

async function buildDiscoveryBoardFinalsDrilldown(args: {
  routeScope: ShellRouteScope;
}) {
  const archiveQuery = buildUpstreamQuery({ limit_cells: 16 });
  const leaderboardQuery = buildUpstreamQuery({ limit: 12 });
  const ideasQuery = buildUpstreamQuery({ limit: 24 });

  const [shellResult, archiveResult, leaderboardResult, ideasResult] =
    await Promise.allSettled([
      buildDiscoveryFinalsSnapshot(),
      requestUpstreamJson<QuorumIdeaArchiveSnapshot>(
        "quorum",
        "orchestrate/ranking/archive",
        archiveQuery
      ),
      requestUpstreamJson<QuorumRankingLeaderboardResponse>(
        "quorum",
        "orchestrate/ranking/leaderboard",
        leaderboardQuery
      ),
      requestUpstreamJson<{ ideas: QuorumDiscoveryIdea[] }>(
        "quorum",
        "orchestrate/discovery/ideas",
        ideasQuery
      ),
    ]);

  const shellSnapshot = shellResult.status === "fulfilled" ? shellResult.value : null;
  const upstreamArchive = archiveResult.status === "fulfilled" ? archiveResult.value : null;
  const upstreamLeaderboard = leaderboardResult.status === "fulfilled" ? leaderboardResult.value : null;
  const upstreamIdeas = ideasResult.status === "fulfilled" ? ideasResult.value.ideas : [];

  return buildParityDrilldown({
    key: "discoveryBoardFinalsDetail",
    label: "Discovery board finals detail",
    upstream: "composite",
    shellRoute: "/api/shell/discovery/board/finals",
    shellSurfaceHref: buildDiscoveryBoardFinalsScopeHref(args.routeScope),
    upstreamRoute: "composite/discovery-board/finals",
    targetId: "finals",
    shellError:
      shellResult.status === "rejected"
        ? formatUpstreamErrorMessage("Discovery finals snapshot", shellResult.reason)
        : joinNonEmptyDetails(
            shellSnapshot?.archiveError,
            shellSnapshot?.leaderboardError,
            shellSnapshot?.ideasError
          ),
    upstreamError: joinNonEmptyDetails(
      archiveResult.status === "rejected"
        ? formatUpstreamErrorMessage("Ranking archive", archiveResult.reason)
        : null,
      leaderboardResult.status === "rejected"
        ? formatUpstreamErrorMessage("Ranking leaderboard", leaderboardResult.reason)
        : null,
      ideasResult.status === "rejected"
        ? formatUpstreamErrorMessage("Discovery ideas", ideasResult.reason)
        : null
    ),
    metrics: [
      buildDrilldownMetric(
        "archive checkpoints",
        shellSnapshot?.archive?.checkpoints.length ?? null,
        upstreamArchive?.checkpoints.length ?? null
      ),
      buildDrilldownMetric(
        "archive cells",
        shellSnapshot?.archive?.cells.length ?? null,
        upstreamArchive?.cells.length ?? null
      ),
      buildDrilldownMetric(
        "leaderboard items",
        shellSnapshot?.leaderboard?.items.length ?? null,
        upstreamLeaderboard?.items.length ?? null
      ),
      buildDrilldownMetric(
        "idea pool",
        shellSnapshot?.ideas.length ?? null,
        upstreamIdeas.length
      ),
      buildDrilldownMetric(
        "top rating",
        shellSnapshot?.leaderboard?.items[0]?.rating ?? null,
        upstreamLeaderboard?.items[0]?.rating ?? null
      ),
      buildDrilldownMetric(
        "top merit score",
        shellSnapshot?.leaderboard?.items[0]?.merit_score ?? null,
        upstreamLeaderboard?.items[0]?.merit_score ?? null
      ),
    ],
  });
}

async function buildDiscoveryBoardSimulationIdeaDrilldown(args: {
  targetId: string;
  routeScope: ShellRouteScope;
}) {
  const upstreamIdeasQuery = buildUpstreamQuery({ limit: 18 });
  const upstreamIdeaRoute = `orchestrate/discovery/ideas/${encodeURIComponent(args.targetId)}`;
  const upstreamPersonaRoute = `${upstreamIdeaRoute}/simulation`;
  const upstreamMarketRoute = `${upstreamIdeaRoute}/simulation/lab`;

  const [shellResult, ideasResult, ideaResult, personaResult, marketResult] =
    await Promise.allSettled([
      buildDiscoverySimulationSnapshot(args.targetId),
      requestUpstreamJson<{ ideas: QuorumDiscoveryIdea[] }>(
        "quorum",
        "orchestrate/discovery/ideas",
        upstreamIdeasQuery
      ),
      requestUpstreamJson<QuorumDiscoveryIdea>("quorum", upstreamIdeaRoute),
      requestUpstreamJson<QuorumSimulationFeedbackReport>("quorum", upstreamPersonaRoute),
      requestUpstreamJson<QuorumMarketSimulationReport>("quorum", upstreamMarketRoute),
    ]);

  const shellSnapshot = shellResult.status === "fulfilled" ? shellResult.value : null;
  const upstreamIdeas = ideasResult.status === "fulfilled" ? ideasResult.value.ideas : [];
  const upstreamIdea = ideaResult.status === "fulfilled" ? ideaResult.value : null;
  const upstreamPersona = personaResult.status === "fulfilled" ? personaResult.value : null;
  const upstreamMarket = marketResult.status === "fulfilled" ? marketResult.value : null;

  return buildParityDrilldown({
    key: "discoveryBoardSimulationIdeaDetail",
    label: "Discovery board simulation detail",
    upstream: "composite",
    shellRoute: "/api/shell/discovery/board/simulations",
    shellSurfaceHref: buildDiscoveryBoardSimulationIdeaScopeHref(
      args.targetId,
      args.routeScope
    ),
    upstreamRoute: `composite/${upstreamIdeaRoute}/simulation`,
    targetId: args.targetId,
    shellError:
      shellResult.status === "rejected"
        ? formatUpstreamErrorMessage(
            "Discovery simulation snapshot",
            shellResult.reason
          )
        : joinNonEmptyDetails(
            shellSnapshot?.ideasError,
            shellSnapshot?.selectedIdeaError,
            shellSnapshot?.personaReportError,
            shellSnapshot?.marketReportError
          ),
    upstreamError: joinNonEmptyDetails(
      ideasResult.status === "rejected"
        ? formatUpstreamErrorMessage("Discovery ideas", ideasResult.reason)
        : null,
      ideaResult.status === "rejected"
        ? formatUpstreamErrorMessage("Discovery idea detail", ideaResult.reason)
        : null,
      personaResult.status === "rejected"
        ? formatUpstreamErrorMessage("Persona simulation report", personaResult.reason)
        : null,
      marketResult.status === "rejected"
        ? formatUpstreamErrorMessage("Market simulation report", marketResult.reason)
        : null
    ),
    metrics: [
      buildDrilldownMetric("idea pool", shellSnapshot?.ideas.length ?? null, upstreamIdeas.length),
      buildDrilldownMetric(
        "selected stage",
        shellSnapshot?.selectedIdea?.latest_stage ?? null,
        upstreamIdea?.latest_stage ?? null
      ),
      buildDrilldownMetric(
        "persona report",
        shellSnapshot?.personaReport?.report_id ?? null,
        upstreamPersona?.report_id ?? null
      ),
      buildDrilldownMetric(
        "persona run",
        shellSnapshot?.personaReport?.run.run_id ?? null,
        upstreamPersona?.run.run_id ?? null
      ),
      buildDrilldownMetric(
        "persona count",
        shellSnapshot?.personaReport?.personas.length ?? null,
        upstreamPersona?.personas.length ?? null
      ),
      buildDrilldownMetric(
        "market report",
        shellSnapshot?.marketReport?.report_id ?? null,
        upstreamMarket?.report_id ?? null
      ),
      buildDrilldownMetric(
        "market rounds",
        shellSnapshot?.marketReport?.run_state.round_summaries.length ?? null,
        upstreamMarket?.run_state.round_summaries.length ?? null
      ),
      buildDrilldownMetric(
        "market verdict",
        shellSnapshot?.marketReport?.verdict ?? null,
        upstreamMarket?.verdict ?? null
      ),
    ],
  });
}

function filterChainRecordsByScope(
  records: ShellChainRecord[],
  scope: ShellRouteScope
) {
  if (!hasShellRouteScope(scope)) {
    return records;
  }
  return records.filter((record) => matchesShellChainRouteScope(record, scope));
}

function filterAuthoringQueueRecordsByScope(
  records: ShellDiscoveryAuthoringQueueRecord[],
  scope: ShellRouteScope
) {
  if (!hasShellRouteScope(scope)) {
    return records;
  }

  return records.filter((record) => {
    if (!record.chain) {
      return false;
    }
    return matchesShellChainRouteScope(record.chain, scope);
  });
}

function filterDiscoveryReviewRecordsByScope(
  records: ShellDiscoveryReviewRecord[],
  scope: ShellRouteScope
) {
  if (!hasShellRouteScope(scope)) {
    return records;
  }
  return records.filter(
    (record) => record.chain && matchesShellChainRouteScope(record.chain, scope)
  );
}

function filterExecutionReviewRecordsByScope(
  records: ShellExecutionAttentionRecord[],
  scope: ShellRouteScope
) {
  if (!hasShellRouteScope(scope)) {
    return records;
  }
  return records.filter((record) => matchesAttentionRouteScope(record, scope));
}

function buildScopedPortfolioCompositeDrilldown(args: {
  routeScope: ShellRouteScope;
  shellPortfolioResult:
    | { status: "fulfilled"; value: Awaited<ReturnType<typeof buildPortfolioSnapshot>> }
    | PromiseRejectedResult;
  upstreamChainGraphResult:
    | {
        status: "fulfilled";
        value: Awaited<ReturnType<typeof loadShellChainGraphSnapshotData>>;
      }
    | PromiseRejectedResult;
}) {
  const shellSnapshot =
    args.shellPortfolioResult.status === "fulfilled"
      ? args.shellPortfolioResult.value
      : null;
  const upstreamSnapshot =
    args.upstreamChainGraphResult.status === "fulfilled"
      ? args.upstreamChainGraphResult.value
      : null;
  const shellRecords = filterChainRecordsByScope(
    shellSnapshot?.records ?? [],
    args.routeScope
  );
  const upstreamRecords = filterChainRecordsByScope(
    upstreamSnapshot?.chains ?? [],
    args.routeScope
  );
  const shellStats = buildShellChainGraphStats(shellRecords);
  const upstreamStats = buildShellChainGraphStats(upstreamRecords);

  return buildParityDrilldown({
    key: "portfolioScopedChain",
    label: "Portfolio scoped chain graph",
    upstream: "composite",
    shellRoute: "/api/shell/portfolio",
    shellSurfaceHref: buildPortfolioScopeHref(args.routeScope),
    upstreamRoute: "composite/chain-graph/scoped",
    targetId: buildScopedCompositeTargetId(args.routeScope),
    shellError:
      args.shellPortfolioResult.status === "rejected"
        ? formatUpstreamErrorMessage(
            "Portfolio snapshot",
            args.shellPortfolioResult.reason
          )
        : null,
    upstreamError:
      args.upstreamChainGraphResult.status === "rejected"
        ? formatUpstreamErrorMessage(
            "Chain graph snapshot",
            args.upstreamChainGraphResult.reason
          )
        : snapshotErrorsDetail(upstreamSnapshot?.errors),
    metrics: [
      buildDrilldownMetric("total chains", shellRecords.length, upstreamRecords.length),
      buildDrilldownMetric(
        "linked chains",
        shellStats.linkedCount,
        upstreamStats.linkedCount
      ),
      buildDrilldownMetric(
        "intake-linked chains",
        shellStats.intakeLinkedCount,
        upstreamStats.intakeLinkedCount
      ),
      buildDrilldownMetric(
        "orphan projects",
        shellStats.orphanCount,
        upstreamStats.orphanCount
      ),
      buildDrilldownMetric(
        "chains with attention",
        shellStats.chainsWithAttentionCount,
        upstreamStats.chainsWithAttentionCount
      ),
      buildDrilldownMetric(
        "chain sample ids",
        joinSampleIds(sampleIds(shellRecords.map((record) => record.key))),
        joinSampleIds(sampleIds(upstreamRecords.map((record) => record.key)))
      ),
    ],
  });
}

function buildScopedReviewCenterDiscoveryDrilldown(args: {
  routeScope: ShellRouteScope;
  shellReviewCenterResult:
    | {
        status: "fulfilled";
        value: Awaited<ReturnType<typeof buildShellReviewCenterSnapshot>>;
      }
    | PromiseRejectedResult;
  upstreamDiscoveryReviewResult:
    | {
        status: "fulfilled";
        value: Awaited<ReturnType<typeof buildDiscoveryReviewSnapshot>>;
      }
    | PromiseRejectedResult;
}) {
  const shellSnapshot =
    args.shellReviewCenterResult.status === "fulfilled"
      ? args.shellReviewCenterResult.value
      : null;
  const upstreamSnapshot =
    args.upstreamDiscoveryReviewResult.status === "fulfilled"
      ? args.upstreamDiscoveryReviewResult.value
      : null;
  const shellRecords = filterDiscoveryReviewRecordsByScope(
    shellSnapshot?.discovery.records ?? [],
    args.routeScope
  );
  const upstreamRecords = filterDiscoveryReviewRecordsByScope(
    upstreamSnapshot?.records ?? [],
    args.routeScope
  );
  const shellStats = buildDiscoveryReviewStatsFromRecords(shellRecords);
  const upstreamStats = buildDiscoveryReviewStatsFromRecords(upstreamRecords);

  return buildParityDrilldown({
    key: "reviewCenterScopedDiscovery",
    label: "Review center scoped discovery lane",
    upstream: "composite",
    shellRoute: "/api/shell/review",
    shellSurfaceHref: buildReviewScopeHref(args.routeScope, "discovery"),
    upstreamRoute: "composite/review-center/discovery/scoped",
    targetId: buildScopedCompositeTargetId(args.routeScope),
    shellError:
      args.shellReviewCenterResult.status === "rejected"
        ? formatUpstreamErrorMessage(
            "Review center snapshot",
            args.shellReviewCenterResult.reason
          )
        : null,
    upstreamError:
      args.upstreamDiscoveryReviewResult.status === "rejected"
        ? formatUpstreamErrorMessage(
            "Discovery review snapshot",
            args.upstreamDiscoveryReviewResult.reason
          )
        : upstreamSnapshot?.error ?? null,
    metrics: [
      buildDrilldownMetric(
        "review records",
        shellStats.totalCount,
        upstreamStats.totalCount
      ),
      buildDrilldownMetric(
        "authoring",
        shellStats.authoringCount,
        upstreamStats.authoringCount
      ),
      buildDrilldownMetric(
        "trace review",
        shellStats.traceReviewCount,
        upstreamStats.traceReviewCount
      ),
      buildDrilldownMetric(
        "handoff ready",
        shellStats.handoffReadyCount,
        upstreamStats.handoffReadyCount
      ),
      buildDrilldownMetric(
        "execution followthrough",
        shellStats.executionFollowthroughCount,
        upstreamStats.executionFollowthroughCount
      ),
      buildDrilldownMetric(
        "review sample ids",
        joinSampleIds(sampleIds(shellRecords.map((record) => record.key))),
        joinSampleIds(sampleIds(upstreamRecords.map((record) => record.key)))
      ),
    ],
  });
}

function buildScopedReviewCenterExecutionDrilldown(args: {
  routeScope: ShellRouteScope;
  shellReviewCenterResult:
    | {
        status: "fulfilled";
        value: Awaited<ReturnType<typeof buildShellReviewCenterSnapshot>>;
      }
    | PromiseRejectedResult;
  upstreamExecutionReviewResult:
    | {
        status: "fulfilled";
        value: Awaited<ReturnType<typeof buildExecutionReviewSnapshot>>;
      }
    | PromiseRejectedResult;
}) {
  const shellSnapshot =
    args.shellReviewCenterResult.status === "fulfilled"
      ? args.shellReviewCenterResult.value
      : null;
  const upstreamSnapshot =
    args.upstreamExecutionReviewResult.status === "fulfilled"
      ? args.upstreamExecutionReviewResult.value
      : null;
  const shellRecords = filterExecutionReviewRecordsByScope(
    shellSnapshot?.execution.records ?? [],
    args.routeScope
  );
  const upstreamRecords = filterExecutionReviewRecordsByScope(
    upstreamSnapshot?.records ?? [],
    args.routeScope
  );
  const shellRollup = buildExecutionReviewRollupFromAttentionRecords(shellRecords);
  const upstreamRollup = buildExecutionReviewRollupFromAttentionRecords(upstreamRecords);

  return buildParityDrilldown({
    key: "reviewCenterScopedExecution",
    label: "Review center scoped execution lane",
    upstream: "composite",
    shellRoute: "/api/shell/review",
    shellSurfaceHref: buildReviewScopeHref(args.routeScope, "execution"),
    upstreamRoute: "composite/review-center/execution/scoped",
    targetId: buildScopedCompositeTargetId(args.routeScope),
    shellError:
      args.shellReviewCenterResult.status === "rejected"
        ? formatUpstreamErrorMessage(
            "Review center snapshot",
            args.shellReviewCenterResult.reason
          )
        : null,
    upstreamError:
      args.upstreamExecutionReviewResult.status === "rejected"
        ? formatUpstreamErrorMessage(
            "Execution review snapshot",
            args.upstreamExecutionReviewResult.reason
          )
        : upstreamSnapshot?.error ?? null,
    metrics: [
      buildDrilldownMetric(
        "review records",
        shellRollup.totalCount,
        upstreamRollup.totalCount
      ),
      buildDrilldownMetric("issues", shellRollup.issueCount, upstreamRollup.issueCount),
      buildDrilldownMetric(
        "approvals",
        shellRollup.approvalCount,
        upstreamRollup.approvalCount
      ),
      buildDrilldownMetric(
        "tool permissions",
        shellRollup.runtimeCount,
        upstreamRollup.runtimeCount
      ),
      buildDrilldownMetric(
        "decision prompts",
        shellRollup.decisionCount,
        upstreamRollup.decisionCount
      ),
      buildDrilldownMetric(
        "critical issues",
        shellRollup.criticalIssueCount,
        upstreamRollup.criticalIssueCount
      ),
      buildDrilldownMetric(
        "review sample ids",
        joinSampleIds(sampleIds(shellRecords.map((record) => record.key))),
        joinSampleIds(sampleIds(upstreamRecords.map((record) => record.key)))
      ),
    ],
  });
}

function buildScopedDashboardAttentionDrilldown(args: {
  routeScope: ShellRouteScope;
  shellDashboardResult:
    | {
        status: "fulfilled";
        value: Awaited<ReturnType<typeof buildDashboardSnapshot>>;
      }
    | PromiseRejectedResult;
  upstreamDashboardFeedResult:
    | { status: "fulfilled"; value: QuorumDiscoveryInboxFeed }
    | PromiseRejectedResult;
  upstreamDashboardChainDataResult:
    | {
        status: "fulfilled";
        value: Awaited<ReturnType<typeof loadShellChainGraphSnapshotData>>;
      }
    | PromiseRejectedResult;
}) {
  const shellSnapshot =
    args.shellDashboardResult.status === "fulfilled"
      ? args.shellDashboardResult.value
      : null;
  const shellRecords = buildScopedAttentionRecords(
    shellSnapshot
      ? buildShellAttentionRecords({
          discoveryFeed: shellSnapshot.discoveryFeed,
          projects: shellSnapshot.projects,
          intakeSessions: shellSnapshot.intakeSessions,
          approvals: shellSnapshot.approvals,
          issues: shellSnapshot.issues,
          runtimes: shellSnapshot.runtimes,
          chains: shellSnapshot.chains,
          routeScope: args.routeScope,
        })
      : [],
    args.routeScope
  );
  const upstreamRecords =
    args.upstreamDashboardFeedResult.status === "fulfilled" &&
    args.upstreamDashboardChainDataResult.status === "fulfilled"
      ? buildScopedAttentionRecords(
          buildShellAttentionRecords({
            discoveryFeed: args.upstreamDashboardFeedResult.value,
            projects: args.upstreamDashboardChainDataResult.value.projects,
            intakeSessions: args.upstreamDashboardChainDataResult.value.intakeSessions,
            approvals: args.upstreamDashboardChainDataResult.value.approvals,
            issues: args.upstreamDashboardChainDataResult.value.issues,
            runtimes: args.upstreamDashboardChainDataResult.value.runtimes,
            chains: args.upstreamDashboardChainDataResult.value.chains,
            routeScope: args.routeScope,
          }),
          args.routeScope
        )
      : [];

  return buildParityDrilldown({
    key: "dashboardScopedAttention",
    label: "Dashboard scoped attention",
    upstream: "composite",
    shellRoute: "/api/shell/dashboard",
    shellSurfaceHref: buildDashboardScopeHref(args.routeScope),
    upstreamRoute: "composite/dashboard/attention/scoped",
    targetId: buildScopedCompositeTargetId(args.routeScope),
    shellError:
      args.shellDashboardResult.status === "rejected"
        ? formatUpstreamErrorMessage(
            "Dashboard snapshot",
            args.shellDashboardResult.reason
          )
        : collectCategoryErrors(shellSnapshot?.errors, [
            "Discovery inbox",
            "Discovery ideas",
            "Discovery dossier",
            "Discovery dossiers",
            "Execution projects",
            "Execution intake sessions",
            "Execution issues",
            "Execution approvals",
            "Tool permissions",
          ]),
    upstreamError: joinNonEmptyDetails(
      args.upstreamDashboardFeedResult.status === "rejected"
        ? formatUpstreamErrorMessage(
            "Dashboard discovery inbox",
            args.upstreamDashboardFeedResult.reason
          )
        : null,
      args.upstreamDashboardChainDataResult.status === "rejected"
        ? formatUpstreamErrorMessage(
            "Dashboard chain graph snapshot",
            args.upstreamDashboardChainDataResult.reason
          )
        : snapshotErrorsDetail(args.upstreamDashboardChainDataResult.value.errors)
    ),
    metrics: [
      buildDrilldownMetric("attention records", shellRecords.length, upstreamRecords.length),
      buildDrilldownMetric(
        "discovery attention",
        shellRecords.filter((record) => record.type === "discovery").length,
        upstreamRecords.filter((record) => record.type === "discovery").length
      ),
      buildDrilldownMetric(
        "execution attention",
        shellRecords.filter((record) => record.plane === "execution").length,
        upstreamRecords.filter((record) => record.plane === "execution").length
      ),
      buildDrilldownMetric(
        "decision prompts",
        shellRecords.filter(
          (record) => record.type === "approval" || record.type === "runtime"
        ).length,
        upstreamRecords.filter(
          (record) => record.type === "approval" || record.type === "runtime"
        ).length
      ),
      buildDrilldownMetric(
        "attention sample ids",
        joinSampleIds(sampleIds(shellRecords.map((record) => record.key))),
        joinSampleIds(sampleIds(upstreamRecords.map((record) => record.key)))
      ),
    ],
  });
}

function buildScopedInboxAttentionDrilldown(args: {
  routeScope: ShellRouteScope;
  shellInboxResult:
    | {
        status: "fulfilled";
        value: Awaited<ReturnType<typeof buildInboxSnapshot>>;
      }
    | PromiseRejectedResult;
  upstreamInboxFeedResult:
    | { status: "fulfilled"; value: QuorumDiscoveryInboxFeed }
    | PromiseRejectedResult;
  upstreamChainGraphResult:
    | {
        status: "fulfilled";
        value: Awaited<ReturnType<typeof loadShellChainGraphSnapshotData>>;
      }
    | PromiseRejectedResult;
}) {
  const shellSnapshot =
    args.shellInboxResult.status === "fulfilled" ? args.shellInboxResult.value : null;
  const shellRecords = buildScopedAttentionRecords(
    shellSnapshot
      ? buildShellAttentionRecords({
          discoveryFeed: shellSnapshot.discoveryFeed,
          projects: shellSnapshot.projects,
          intakeSessions: shellSnapshot.intakeSessions,
          approvals: shellSnapshot.approvals,
          issues: shellSnapshot.issues,
          runtimes: shellSnapshot.runtimes,
          chains: shellSnapshot.chains,
          routeScope: args.routeScope,
        })
      : [],
    args.routeScope
  );
  const upstreamRecords =
    args.upstreamInboxFeedResult.status === "fulfilled" &&
    args.upstreamChainGraphResult.status === "fulfilled"
      ? buildScopedAttentionRecords(
          buildShellAttentionRecords({
            discoveryFeed: args.upstreamInboxFeedResult.value,
            projects: args.upstreamChainGraphResult.value.projects,
            intakeSessions: args.upstreamChainGraphResult.value.intakeSessions,
            approvals: args.upstreamChainGraphResult.value.approvals,
            issues: args.upstreamChainGraphResult.value.issues,
            runtimes: args.upstreamChainGraphResult.value.runtimes,
            chains: args.upstreamChainGraphResult.value.chains,
            routeScope: args.routeScope,
          }),
          args.routeScope
        )
      : [];

  return buildParityDrilldown({
    key: "inboxScopedAttention",
    label: "Inbox scoped attention",
    upstream: "composite",
    shellRoute: "/api/shell/inbox",
    shellSurfaceHref: buildInboxScopeHref(args.routeScope),
    upstreamRoute: "composite/inbox/attention/scoped",
    targetId: buildScopedCompositeTargetId(args.routeScope),
    shellError:
      args.shellInboxResult.status === "rejected"
        ? formatUpstreamErrorMessage("Inbox snapshot", args.shellInboxResult.reason)
        : collectCategoryErrors(shellSnapshot?.errors, [
            "Discovery inbox",
            "Discovery ideas",
            "Discovery dossier",
            "Discovery dossiers",
            "Execution projects",
            "Execution intake sessions",
            "Execution issues",
            "Execution approvals",
            "Tool permissions",
          ]),
    upstreamError: joinNonEmptyDetails(
      args.upstreamInboxFeedResult.status === "rejected"
        ? formatUpstreamErrorMessage(
            "Inbox discovery feed",
            args.upstreamInboxFeedResult.reason
          )
        : null,
      args.upstreamChainGraphResult.status === "rejected"
        ? formatUpstreamErrorMessage(
            "Chain graph snapshot",
            args.upstreamChainGraphResult.reason
          )
        : snapshotErrorsDetail(args.upstreamChainGraphResult.value.errors)
    ),
    metrics: [
      buildDrilldownMetric("attention records", shellRecords.length, upstreamRecords.length),
      buildDrilldownMetric(
        "discovery attention",
        shellRecords.filter((record) => record.type === "discovery").length,
        upstreamRecords.filter((record) => record.type === "discovery").length
      ),
      buildDrilldownMetric(
        "execution attention",
        shellRecords.filter((record) => record.plane === "execution").length,
        upstreamRecords.filter((record) => record.plane === "execution").length
      ),
      buildDrilldownMetric(
        "triage attention",
        shellRecords.filter(
          (record) => record.type === "discovery" || record.type === "issue"
        ).length,
        upstreamRecords.filter(
          (record) => record.type === "discovery" || record.type === "issue"
        ).length
      ),
      buildDrilldownMetric(
        "attention sample ids",
        joinSampleIds(sampleIds(shellRecords.map((record) => record.key))),
        joinSampleIds(sampleIds(upstreamRecords.map((record) => record.key)))
      ),
    ],
  });
}

function buildScopedDiscoveryAuthoringQueueDrilldown(args: {
  routeScope: ShellRouteScope;
  shellAuthoringQueueResult:
    | {
        status: "fulfilled";
        value: Awaited<ReturnType<typeof buildDiscoveryAuthoringQueueSnapshot>>;
      }
    | PromiseRejectedResult;
  upstreamAuthoringChainResult:
    | {
        status: "fulfilled";
        value: Awaited<ReturnType<typeof loadShellChainGraphSnapshotData>>;
      }
    | PromiseRejectedResult;
}) {
  const shellSnapshot =
    args.shellAuthoringQueueResult.status === "fulfilled"
      ? args.shellAuthoringQueueResult.value
      : null;
  const shellRecords = filterAuthoringQueueRecordsByScope(
    shellSnapshot?.records ?? [],
    args.routeScope
  );
  const upstreamRecords =
    args.upstreamAuthoringChainResult.status === "fulfilled"
      ? filterAuthoringQueueRecordsByScope(
          buildDiscoveryAuthoringQueueRecords(args.upstreamAuthoringChainResult.value),
          args.routeScope
        )
      : [];
  const shellStats = buildDiscoveryAuthoringQueueStats(shellRecords);
  const upstreamStats = buildDiscoveryAuthoringQueueStats(upstreamRecords);

  return buildParityDrilldown({
    key: "discoveryAuthoringScopedQueue",
    label: "Discovery authoring scoped queue",
    upstream: "composite",
    shellRoute: "/api/shell/discovery/authoring",
    shellSurfaceHref: buildDiscoveryAuthoringScopeHref(args.routeScope),
    upstreamRoute: "composite/discovery-authoring/scoped",
    targetId: buildScopedCompositeTargetId(args.routeScope),
    shellError:
      args.shellAuthoringQueueResult.status === "rejected"
        ? formatUpstreamErrorMessage(
            "Discovery authoring queue snapshot",
            args.shellAuthoringQueueResult.reason
          )
        : shellSnapshot?.error ?? null,
    upstreamError:
      args.upstreamAuthoringChainResult.status === "rejected"
        ? formatUpstreamErrorMessage(
            "Discovery authoring chain snapshot",
            args.upstreamAuthoringChainResult.reason
          )
        : snapshotErrorsDetail(args.upstreamAuthoringChainResult.value.errors),
    metrics: [
      buildDrilldownMetric("queue records", shellRecords.length, upstreamRecords.length),
      buildDrilldownMetric("needs work", shellStats.needsWorkCount, upstreamStats.needsWorkCount),
      buildDrilldownMetric("ready", shellStats.readyCount, upstreamStats.readyCount),
      buildDrilldownMetric("linked", shellStats.linkedCount, upstreamStats.linkedCount),
      buildDrilldownMetric(
        "attention-linked",
        shellStats.attentionLinkedCount,
        upstreamStats.attentionLinkedCount
      ),
      buildDrilldownMetric(
        "queue sample ids",
        joinSampleIds(sampleIds(shellRecords.map((record) => record.key))),
        joinSampleIds(sampleIds(upstreamRecords.map((record) => record.key)))
      ),
    ],
  });
}

function buildScopedDiscoveryReviewQueueDrilldown(args: {
  routeScope: ShellRouteScope;
  shellDiscoveryReviewResult:
    | {
        status: "fulfilled";
        value: Awaited<ReturnType<typeof buildDiscoveryReviewSnapshot>>;
      }
    | PromiseRejectedResult;
  reviewCenterResult:
    | {
        status: "fulfilled";
        value: Awaited<ReturnType<typeof buildShellReviewCenterSnapshot>>;
      }
    | PromiseRejectedResult;
}) {
  const shellSnapshot =
    args.shellDiscoveryReviewResult.status === "fulfilled"
      ? args.shellDiscoveryReviewResult.value
      : null;
  const upstreamSnapshot =
    args.reviewCenterResult.status === "fulfilled"
      ? args.reviewCenterResult.value
      : null;
  const shellRecords = filterDiscoveryReviewRecordsByScope(
    shellSnapshot?.records ?? [],
    args.routeScope
  );
  const upstreamRecords = filterDiscoveryReviewRecordsByScope(
    upstreamSnapshot?.discovery.records ?? [],
    args.routeScope
  );
  const shellStats = buildDiscoveryReviewStatsFromRecords(shellRecords);
  const upstreamStats = buildDiscoveryReviewStatsFromRecords(upstreamRecords);

  return buildParityDrilldown({
    key: "discoveryReviewScopedQueue",
    label: "Discovery review scoped queue",
    upstream: "composite",
    shellRoute: "/api/shell/discovery/review",
    shellSurfaceHref: buildDiscoveryReviewScopeHref(args.routeScope),
    upstreamRoute: "composite/review-center/discovery-lane/scoped",
    targetId: buildScopedCompositeTargetId(args.routeScope),
    shellError:
      args.shellDiscoveryReviewResult.status === "rejected"
        ? formatUpstreamErrorMessage(
            "Discovery review snapshot",
            args.shellDiscoveryReviewResult.reason
          )
        : shellSnapshot?.error ?? null,
    upstreamError:
      args.reviewCenterResult.status === "rejected"
        ? formatUpstreamErrorMessage(
            "Review center snapshot",
            args.reviewCenterResult.reason
          )
        : upstreamSnapshot?.discovery.error ?? null,
    metrics: [
      buildDrilldownMetric("review records", shellStats.totalCount, upstreamStats.totalCount),
      buildDrilldownMetric("authoring", shellStats.authoringCount, upstreamStats.authoringCount),
      buildDrilldownMetric(
        "trace review",
        shellStats.traceReviewCount,
        upstreamStats.traceReviewCount
      ),
      buildDrilldownMetric(
        "handoff ready",
        shellStats.handoffReadyCount,
        upstreamStats.handoffReadyCount
      ),
      buildDrilldownMetric(
        "followthrough",
        shellStats.executionFollowthroughCount,
        upstreamStats.executionFollowthroughCount
      ),
      buildDrilldownMetric(
        "review sample ids",
        joinSampleIds(sampleIds(shellRecords.map((record) => record.key))),
        joinSampleIds(sampleIds(upstreamRecords.map((record) => record.key)))
      ),
    ],
  });
}

function buildScopedExecutionReviewQueueDrilldown(args: {
  routeScope: ShellRouteScope;
  shellExecutionReviewResult:
    | {
        status: "fulfilled";
        value: Awaited<ReturnType<typeof buildExecutionReviewSnapshot>>;
      }
    | PromiseRejectedResult;
  reviewCenterResult:
    | {
        status: "fulfilled";
        value: Awaited<ReturnType<typeof buildShellReviewCenterSnapshot>>;
      }
    | PromiseRejectedResult;
}) {
  const shellSnapshot =
    args.shellExecutionReviewResult.status === "fulfilled"
      ? args.shellExecutionReviewResult.value
      : null;
  const upstreamSnapshot =
    args.reviewCenterResult.status === "fulfilled"
      ? args.reviewCenterResult.value
      : null;
  const shellRecords = filterExecutionReviewRecordsByScope(
    shellSnapshot?.records ?? [],
    args.routeScope
  );
  const upstreamRecords = filterExecutionReviewRecordsByScope(
    upstreamSnapshot?.execution.records ?? [],
    args.routeScope
  );
  const shellRollup = buildExecutionReviewRollupFromAttentionRecords(shellRecords);
  const upstreamRollup = buildExecutionReviewRollupFromAttentionRecords(upstreamRecords);

  return buildParityDrilldown({
    key: "executionReviewScopedQueue",
    label: "Execution review scoped queue",
    upstream: "composite",
    shellRoute: "/api/shell/execution/review",
    shellSurfaceHref: buildExecutionReviewScopeHref(args.routeScope),
    upstreamRoute: "composite/review-center/execution-lane/scoped",
    targetId: buildScopedCompositeTargetId(args.routeScope),
    shellError:
      args.shellExecutionReviewResult.status === "rejected"
        ? formatUpstreamErrorMessage(
            "Execution review snapshot",
            args.shellExecutionReviewResult.reason
          )
        : shellSnapshot?.error ?? null,
    upstreamError:
      args.reviewCenterResult.status === "rejected"
        ? formatUpstreamErrorMessage(
            "Review center snapshot",
            args.reviewCenterResult.reason
          )
        : upstreamSnapshot?.execution.error ?? null,
    metrics: [
      buildDrilldownMetric("review records", shellRollup.totalCount, upstreamRollup.totalCount),
      buildDrilldownMetric("issues", shellRollup.issueCount, upstreamRollup.issueCount),
      buildDrilldownMetric("approvals", shellRollup.approvalCount, upstreamRollup.approvalCount),
      buildDrilldownMetric(
        "tool permissions",
        shellRollup.runtimeCount,
        upstreamRollup.runtimeCount
      ),
      buildDrilldownMetric(
        "decision prompts",
        shellRollup.decisionCount,
        upstreamRollup.decisionCount
      ),
      buildDrilldownMetric(
        "review sample ids",
        joinSampleIds(sampleIds(shellRecords.map((record) => record.key))),
        joinSampleIds(sampleIds(upstreamRecords.map((record) => record.key)))
      ),
    ],
  });
}

function buildDiscoveryAuthoringIdeaDrilldown(args: {
  targetId: string;
  routeScope: ShellRouteScope;
  shellAuthoringQueueResult:
    | {
        status: "fulfilled";
        value: Awaited<ReturnType<typeof buildDiscoveryAuthoringQueueSnapshot>>;
      }
    | PromiseRejectedResult;
  upstreamAuthoringChainResult:
    | {
        status: "fulfilled";
        value: Awaited<ReturnType<typeof loadShellChainGraphSnapshotData>>;
      }
    | PromiseRejectedResult;
}) {
  const shellSnapshot =
    args.shellAuthoringQueueResult.status === "fulfilled"
      ? args.shellAuthoringQueueResult.value
      : null;
  const shellRecord =
    shellSnapshot?.records.find((record) => record.key === args.targetId) ?? null;
  const upstreamRecord =
    args.upstreamAuthoringChainResult.status === "fulfilled"
      ? buildDiscoveryAuthoringQueueRecords(args.upstreamAuthoringChainResult.value).find(
          (record) => record.key === args.targetId
        ) ?? null
      : null;
  const shellAuthoring = shellRecord?.authoring ?? null;
  const upstreamAuthoring = upstreamRecord?.authoring ?? null;

  return buildParityDrilldown({
    key: "discoveryAuthoringIdeaDetail",
    label: "Discovery authoring detail",
    upstream: "composite",
    shellRoute: "/api/shell/discovery/authoring",
    shellSurfaceHref: buildDiscoveryIdeaAuthoringScopeHref(args.targetId, args.routeScope),
    upstreamRoute: "composite/discovery-authoring/idea",
    targetId: args.targetId,
    shellError:
      args.shellAuthoringQueueResult.status === "rejected"
        ? formatUpstreamErrorMessage(
            "Discovery authoring queue snapshot",
            args.shellAuthoringQueueResult.reason
          )
        : shellSnapshot?.error ?? null,
    upstreamError:
      args.upstreamAuthoringChainResult.status === "rejected"
        ? formatUpstreamErrorMessage(
            "Discovery authoring chain snapshot",
            args.upstreamAuthoringChainResult.reason
          )
        : snapshotErrorsDetail(args.upstreamAuthoringChainResult.value.errors),
    metrics: [
      buildDrilldownMetric("status", shellAuthoring?.status ?? null, upstreamAuthoring?.status ?? null),
      buildDrilldownMetric(
        "gap count",
        shellAuthoring?.gapCount ?? null,
        upstreamAuthoring?.gapCount ?? null
      ),
      buildDrilldownMetric(
        "evidence count",
        shellAuthoring?.evidenceCount ?? null,
        upstreamAuthoring?.evidenceCount ?? null
      ),
      buildDrilldownMetric(
        "validation count",
        shellAuthoring?.validationCount ?? null,
        upstreamAuthoring?.validationCount ?? null
      ),
      buildDrilldownMetric(
        "decision count",
        shellAuthoring?.decisionCount ?? null,
        upstreamAuthoring?.decisionCount ?? null
      ),
      buildDrilldownMetric(
        "timeline count",
        shellAuthoring?.timelineCount ?? null,
        upstreamAuthoring?.timelineCount ?? null
      ),
      buildDrilldownMetric(
        "gaps",
        joinSampleIds(shellAuthoring?.gaps ?? []),
        joinSampleIds(upstreamAuthoring?.gaps ?? [])
      ),
    ],
  });
}

export function emptyParityAuditSnapshot() {
  return emptyShellParityAuditSnapshot();
}

export async function buildShellParityAuditSnapshot(
  options: ParityBuilderOptions = {}
): Promise<ShellParityAuditSnapshot> {
  const routeScope = normalizeRouteScope(options.routeScope);
  const ideaQuery = buildUpstreamQuery({ limit: 24 });
  const boardIdeasQuery = buildUpstreamQuery({ limit: 18 });
  const boardSwipeQueueQuery = buildUpstreamQuery({ limit: 6 });
  const boardLeaderboardQuery = buildUpstreamQuery({ limit: 10 });
  const rankingLeaderboardQuery = buildUpstreamQuery({ limit: 16 });
  const rankingArchiveQuery = buildUpstreamQuery({ limit_cells: 12 });
  const archiveIdeasQuery = buildUpstreamQuery({ limit: 40 });
  const archiveLeaderboardQuery = buildUpstreamQuery({ limit: 20 });
  const archiveLimitCellsQuery = buildUpstreamQuery({ limit_cells: 24 });
  const finalsIdeasQuery = buildUpstreamQuery({ limit: 24 });
  const finalsLeaderboardQuery = buildUpstreamQuery({ limit: 12 });
  const finalsLimitCellsQuery = buildUpstreamQuery({ limit_cells: 16 });
  const openIssuesQuery = buildUpstreamQuery({ status: "open" });
  const pendingApprovalsQuery = buildUpstreamQuery({ status: "pending" });
  const pendingRuntimesQuery = buildUpstreamQuery({ status: "pending" });

  const [
    shellDiscoveryBoard,
    shellDiscoveryBoardRanking,
    shellDiscoveryBoardArchive,
    shellDiscoveryBoardFinals,
    shellDiscoveryBoardSimulations,
    shellDashboard,
    shellDiscoveryAuthoringQueue,
    shellDiscoveryReplays,
    shellDiscoverySessions,
    shellDiscoveryIdeas,
    shellDiscoveryTraces,
    shellInbox,
    shellExecutionWorkspace,
    shellExecutionIntake,
    shellExecutionAttentionData,
    shellPortfolio,
    shellReviewCenter,
    upstreamDiscoveryReview,
    upstreamExecutionReview,
    upstreamDiscoveryTraceScoreboardResult,
    upstreamDiscoveryTraceSnapshotResult,
    upstreamDiscoveryBoardLeaderboard,
    upstreamDiscoveryBoardNextPair,
    upstreamDiscoveryBoardSwipeQueue,
    upstreamDiscoveryBoardIdeas,
    upstreamDiscoveryRankingLeaderboard,
    upstreamDiscoveryRankingNextPair,
    upstreamDiscoveryRankingArchive,
    upstreamDiscoveryArchiveIdeas,
    upstreamDiscoveryArchiveLeaderboard,
    upstreamDiscoveryArchiveArchive,
    upstreamDiscoveryFinalsIdeas,
    upstreamDiscoveryFinalsLeaderboard,
    upstreamDiscoveryFinalsArchive,
    upstreamDashboardFeed,
    upstreamDashboardChainData,
    upstreamDiscoveryAuthoringChainData,
    upstreamInboxFeed,
    upstreamSessions,
    upstreamIdeas,
    upstreamProjects,
    upstreamIntakeSessions,
    upstreamIssues,
    upstreamApprovals,
    upstreamRuntimes,
  ] = await Promise.allSettled([
    buildDiscoveryBoardSnapshot(),
    buildDiscoveryRankingSnapshot(),
    buildDiscoveryArchiveSnapshot(),
    buildDiscoveryFinalsSnapshot(),
    buildDiscoverySimulationSnapshot(null),
    buildDashboardSnapshot({
      upstreamTimeoutMs: PARITY_COMPOSITE_UPSTREAM_TIMEOUT_MS,
    }),
    buildDiscoveryAuthoringQueueSnapshot({
      upstreamTimeoutMs: PARITY_COMPOSITE_UPSTREAM_TIMEOUT_MS,
    }),
    buildDiscoveryReplaySnapshot(null, { sessionLimit: 12 }),
    buildDiscoverySessionsSnapshot(null),
    buildDiscoveryIdeasSnapshot(null, { limit: 24 }),
    buildDiscoveryTracesSnapshot(null, { traceLimit: 48 }),
    buildInboxSnapshot(),
    buildExecutionWorkspaceSnapshot(null),
    buildExecutionIntakeSnapshot(null),
    loadShellChainGraphSnapshotData({
      discoveryIdeaLimit: 100,
      includeArchivedProjects: true,
      upstreamTimeoutMs: PARITY_COMPOSITE_UPSTREAM_TIMEOUT_MS,
    }),
    buildPortfolioSnapshot(),
    buildShellReviewCenterSnapshot({
      upstreamTimeoutMs: PARITY_COMPOSITE_UPSTREAM_TIMEOUT_MS,
    }),
    buildDiscoveryReviewSnapshot({
      upstreamTimeoutMs: PARITY_COMPOSITE_UPSTREAM_TIMEOUT_MS,
    }),
    buildExecutionReviewSnapshot({
      upstreamTimeoutMs: PARITY_COMPOSITE_UPSTREAM_TIMEOUT_MS,
    }),
    requestUpstreamJson<QuorumDiscoveryObservabilityScoreboard>(
      "quorum",
      "orchestrate/observability/scoreboards/discovery"
    ),
    requestUpstreamJson<QuorumDiscoveryTraceSnapshot>(
      "quorum",
      "orchestrate/observability/traces/discovery",
      buildUpstreamQuery({ limit: 48 })
    ),
    requestUpstreamJson<QuorumRankingLeaderboardResponse>(
      "quorum",
      "orchestrate/ranking/leaderboard",
      boardLeaderboardQuery
    ),
    requestUpstreamJson<{ pair?: QuorumNextPairResponse | null }>(
      "quorum",
      "orchestrate/ranking/next-pair"
    ),
    requestUpstreamJson<QuorumSwipeQueueResponse>(
      "quorum",
      "orchestrate/discovery/swipe-queue",
      boardSwipeQueueQuery
    ),
    requestUpstreamJson<{ ideas: QuorumDiscoveryIdea[] }>(
      "quorum",
      "orchestrate/discovery/ideas",
      boardIdeasQuery
    ),
    requestUpstreamJson<QuorumRankingLeaderboardResponse>(
      "quorum",
      "orchestrate/ranking/leaderboard",
      rankingLeaderboardQuery
    ),
    requestUpstreamJson<{ pair?: QuorumNextPairResponse | null }>(
      "quorum",
      "orchestrate/ranking/next-pair"
    ),
    requestUpstreamJson<QuorumIdeaArchiveSnapshot>(
      "quorum",
      "orchestrate/ranking/archive",
      rankingArchiveQuery
    ),
    requestUpstreamJson<{ ideas: QuorumDiscoveryIdea[] }>(
      "quorum",
      "orchestrate/discovery/ideas",
      archiveIdeasQuery
    ),
    requestUpstreamJson<QuorumRankingLeaderboardResponse>(
      "quorum",
      "orchestrate/ranking/leaderboard",
      archiveLeaderboardQuery
    ),
    requestUpstreamJson<QuorumIdeaArchiveSnapshot>(
      "quorum",
      "orchestrate/ranking/archive",
      archiveLimitCellsQuery
    ),
    requestUpstreamJson<{ ideas: QuorumDiscoveryIdea[] }>(
      "quorum",
      "orchestrate/discovery/ideas",
      finalsIdeasQuery
    ),
    requestUpstreamJson<QuorumRankingLeaderboardResponse>(
      "quorum",
      "orchestrate/ranking/leaderboard",
      finalsLeaderboardQuery
    ),
    requestUpstreamJson<QuorumIdeaArchiveSnapshot>(
      "quorum",
      "orchestrate/ranking/archive",
      finalsLimitCellsQuery
    ),
    requestUpstreamJson<QuorumDiscoveryInboxFeed>(
      "quorum",
      "orchestrate/discovery/inbox",
      buildUpstreamQuery({ limit: 12, status: "open" })
    ),
    loadShellChainGraphSnapshotData({
      discoveryIdeaLimit: 24,
      includeArchivedProjects: false,
    }),
    loadShellChainGraphSnapshotData({
      discoveryIdeaLimit: 60,
      includeArchivedProjects: true,
      discoveryStages: DISCOVERY_AUTHORING_STAGES,
    }),
    requestUpstreamJson<QuorumDiscoveryInboxFeed>(
      "quorum",
      "orchestrate/discovery/inbox",
      buildUpstreamQuery({ limit: 50, status: "open" })
    ),
    requestUpstreamJson<QuorumSessionSummary[]>("quorum", "orchestrate/sessions"),
    requestUpstreamJson<{ ideas: QuorumDiscoveryIdea[] }>(
      "quorum",
      "orchestrate/discovery/ideas",
      ideaQuery
    ),
    requestUpstreamJson<{ projects: AutopilotProjectSummary[] }>(
      "autopilot",
      "projects/"
    ),
    requestUpstreamJson<{ sessions: AutopilotIntakeSessionSummary[] }>(
      "autopilot",
      "intake/sessions"
    ),
    requestUpstreamJson<{ issues: AutopilotExecutionIssueRecord[] }>(
      "autopilot",
      "execution-plane/issues",
      openIssuesQuery
    ),
    requestUpstreamJson<{ approvals: AutopilotExecutionApprovalRecord[] }>(
      "autopilot",
      "execution-plane/approvals",
      pendingApprovalsQuery
    ),
    requestUpstreamJson<{ runtimes: AutopilotToolPermissionRuntimeRecord[] }>(
      "autopilot",
      "execution-plane/tool-permission-runtimes",
      pendingRuntimesQuery
    ),
  ]);

  const shellDiscoveryBoardSnapshot =
    shellDiscoveryBoard.status === "fulfilled" ? shellDiscoveryBoard.value : null;
  const shellDiscoveryBoardRankingSnapshot =
    shellDiscoveryBoardRanking.status === "fulfilled"
      ? shellDiscoveryBoardRanking.value
      : null;
  const shellDiscoveryBoardArchiveSnapshot =
    shellDiscoveryBoardArchive.status === "fulfilled"
      ? shellDiscoveryBoardArchive.value
      : null;
  const shellDiscoveryBoardFinalsSnapshot =
    shellDiscoveryBoardFinals.status === "fulfilled"
      ? shellDiscoveryBoardFinals.value
      : null;
  const shellDiscoveryBoardSimulationsSnapshot =
    shellDiscoveryBoardSimulations.status === "fulfilled"
      ? shellDiscoveryBoardSimulations.value
      : null;
  const shellDiscoverySessionsSnapshot =
    shellDiscoverySessions.status === "fulfilled"
      ? shellDiscoverySessions.value
      : null;
  const shellDiscoveryAuthoringQueueSnapshot =
    shellDiscoveryAuthoringQueue.status === "fulfilled"
      ? shellDiscoveryAuthoringQueue.value
      : null;
  const shellDiscoveryReplaySnapshot =
    shellDiscoveryReplays.status === "fulfilled" ? shellDiscoveryReplays.value : null;
  const shellDiscoveryIdeasSnapshot =
    shellDiscoveryIdeas.status === "fulfilled" ? shellDiscoveryIdeas.value : null;
  const shellDiscoveryTracesSnapshot =
    shellDiscoveryTraces.status === "fulfilled" ? shellDiscoveryTraces.value : null;
  const shellDashboardSnapshot =
    shellDashboard.status === "fulfilled" ? shellDashboard.value : null;
  const shellInboxSnapshot =
    shellInbox.status === "fulfilled" ? shellInbox.value : null;
  const shellExecutionWorkspaceSnapshot =
    shellExecutionWorkspace.status === "fulfilled"
      ? shellExecutionWorkspace.value
      : null;
  const shellExecutionIntakeSnapshot =
    shellExecutionIntake.status === "fulfilled"
      ? shellExecutionIntake.value
      : null;
  const shellExecutionAttentionSnapshot =
    shellExecutionAttentionData.status === "fulfilled"
      ? shellExecutionAttentionData.value
      : null;
  const shellPortfolioSnapshot =
    shellPortfolio.status === "fulfilled" ? shellPortfolio.value : null;
  const shellReviewCenterSnapshot =
    shellReviewCenter.status === "fulfilled" ? shellReviewCenter.value : null;
  const upstreamDiscoveryReviewSnapshot =
    upstreamDiscoveryReview.status === "fulfilled"
      ? upstreamDiscoveryReview.value
      : null;
  const upstreamExecutionReviewSnapshot =
    upstreamExecutionReview.status === "fulfilled"
      ? upstreamExecutionReview.value
      : null;
  const upstreamDiscoveryTraceSnapshot =
    upstreamDiscoveryTraceSnapshotResult.status === "fulfilled"
      ? upstreamDiscoveryTraceSnapshotResult.value
      : null;
  const upstreamDashboardChainSnapshot =
    upstreamDashboardChainData.status === "fulfilled"
      ? upstreamDashboardChainData.value
      : null;
  const upstreamDiscoveryAuthoringChainSnapshot =
    upstreamDiscoveryAuthoringChainData.status === "fulfilled"
      ? upstreamDiscoveryAuthoringChainData.value
      : null;

  const records = [
    buildIdParityRecord({
      key: "discoverySessions",
      label: "Discovery sessions",
      upstream: "quorum",
      shellRoute: "/api/shell/discovery/sessions",
      shellSurfaceHref: "/discovery",
      upstreamRoute: "orchestrate/sessions",
      shellIds:
        shellDiscoverySessionsSnapshot?.sessions.map((session) => session.id) ?? [],
      shellError:
        shellDiscoverySessions.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Discovery sessions snapshot",
              shellDiscoverySessions.reason
            )
          : shellDiscoverySessionsSnapshot?.sessionsError ?? null,
      upstreamIds:
        upstreamSessions.status === "fulfilled"
          ? upstreamSessions.value.map((session) => session.id)
          : [],
      upstreamError:
        upstreamSessions.status === "rejected"
          ? formatUpstreamErrorMessage("Quorum sessions", upstreamSessions.reason)
          : null,
    }),
    buildIdParityRecord({
      key: "discoveryIdeas",
      label: "Discovery ideas",
      upstream: "quorum",
      shellRoute: "/api/shell/discovery/ideas",
      shellSurfaceHref: "/discovery/ideas",
      upstreamRoute: buildUpstreamRoute("orchestrate/discovery/ideas", ideaQuery),
      shellIds:
        shellDiscoveryIdeasSnapshot?.ideas.map((idea) => idea.idea_id) ?? [],
      shellError:
        shellDiscoveryIdeas.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Discovery ideas snapshot",
              shellDiscoveryIdeas.reason
            )
          : shellDiscoveryIdeasSnapshot?.ideasError ?? null,
      upstreamIds:
        upstreamIdeas.status === "fulfilled"
          ? upstreamIdeas.value.ideas.map((idea) => idea.idea_id)
          : [],
      upstreamError:
        upstreamIdeas.status === "rejected"
          ? formatUpstreamErrorMessage("Discovery ideas", upstreamIdeas.reason)
          : null,
    }),
    buildIdParityRecord({
      key: "discoveryBoardSurface",
      label: "Discovery board overview",
      upstream: "composite",
      shellRoute: "/api/shell/discovery/board",
      shellSurfaceHref: buildDiscoveryBoardScopeHref(routeScope),
      upstreamRoute: "composite/discovery-board",
      shellIds: buildDiscoveryBoardSurfaceIds({
        scoreboard: shellDiscoveryBoardSnapshot?.scoreboard,
        leaderboard: shellDiscoveryBoardSnapshot?.leaderboard,
        nextPair: shellDiscoveryBoardSnapshot?.nextPair,
        swipeQueue: shellDiscoveryBoardSnapshot?.swipeQueue,
        simulationIdeas: shellDiscoveryBoardSnapshot?.simulationIdeas ?? [],
      }),
      shellError:
        shellDiscoveryBoard.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Discovery board snapshot",
              shellDiscoveryBoard.reason
            )
          : joinNonEmptyDetails(
              shellDiscoveryBoardSnapshot?.scoreboardError,
              shellDiscoveryBoardSnapshot?.rankingError,
              shellDiscoveryBoardSnapshot?.swipeQueueError,
              shellDiscoveryBoardSnapshot?.simulationIdeasError
            ),
      upstreamIds: buildDiscoveryBoardSurfaceIds({
        scoreboard:
          upstreamDiscoveryTraceScoreboardResult.status === "fulfilled"
            ? upstreamDiscoveryTraceScoreboardResult.value
            : null,
        leaderboard:
          upstreamDiscoveryBoardLeaderboard.status === "fulfilled"
            ? upstreamDiscoveryBoardLeaderboard.value
            : null,
        nextPair:
          upstreamDiscoveryBoardNextPair.status === "fulfilled"
            ? upstreamDiscoveryBoardNextPair.value.pair ?? null
            : null,
        swipeQueue:
          upstreamDiscoveryBoardSwipeQueue.status === "fulfilled"
            ? upstreamDiscoveryBoardSwipeQueue.value
            : null,
        simulationIdeas:
          upstreamDiscoveryBoardIdeas.status === "fulfilled"
            ? sortBoardOverviewSimulationIdeas(
                upstreamDiscoveryBoardIdeas.value.ideas.filter(
                  (idea) => idea.validation_state !== "archived"
                )
              ).slice(0, 6)
            : [],
      }),
      upstreamError: joinNonEmptyDetails(
        upstreamDiscoveryTraceScoreboardResult.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Discovery observability scoreboard",
              upstreamDiscoveryTraceScoreboardResult.reason
            )
          : null,
        upstreamDiscoveryBoardLeaderboard.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Ranking leaderboard",
              upstreamDiscoveryBoardLeaderboard.reason
            )
          : null,
        upstreamDiscoveryBoardNextPair.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Ranking next pair",
              upstreamDiscoveryBoardNextPair.reason
            )
          : null,
        upstreamDiscoveryBoardSwipeQueue.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Swipe queue",
              upstreamDiscoveryBoardSwipeQueue.reason
            )
          : null,
        upstreamDiscoveryBoardIdeas.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Discovery ideas",
              upstreamDiscoveryBoardIdeas.reason
            )
          : null
      ),
    }),
    buildIdParityRecord({
      key: "discoveryBoardRankingSurface",
      label: "Discovery board ranking",
      upstream: "composite",
      shellRoute: "/api/shell/discovery/board/ranking",
      shellSurfaceHref: buildDiscoveryBoardRankingScopeHref(routeScope),
      upstreamRoute: "composite/discovery-board/ranking",
      shellIds: buildDiscoveryRankingIds({
        leaderboard: shellDiscoveryBoardRankingSnapshot?.leaderboard,
        nextPair: shellDiscoveryBoardRankingSnapshot?.nextPair,
        archive: shellDiscoveryBoardRankingSnapshot?.archive,
      }),
      shellError:
        shellDiscoveryBoardRanking.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Discovery ranking snapshot",
              shellDiscoveryBoardRanking.reason
            )
          : joinNonEmptyDetails(
              shellDiscoveryBoardRankingSnapshot?.leaderboardError,
              shellDiscoveryBoardRankingSnapshot?.nextPairError,
              shellDiscoveryBoardRankingSnapshot?.archiveError
            ),
      upstreamIds: buildDiscoveryRankingIds({
        leaderboard:
          upstreamDiscoveryRankingLeaderboard.status === "fulfilled"
            ? upstreamDiscoveryRankingLeaderboard.value
            : null,
        nextPair:
          upstreamDiscoveryRankingNextPair.status === "fulfilled"
            ? upstreamDiscoveryRankingNextPair.value.pair ?? null
            : null,
        archive:
          upstreamDiscoveryRankingArchive.status === "fulfilled"
            ? upstreamDiscoveryRankingArchive.value
            : null,
      }),
      upstreamError: joinNonEmptyDetails(
        upstreamDiscoveryRankingLeaderboard.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Ranking leaderboard",
              upstreamDiscoveryRankingLeaderboard.reason
            )
          : null,
        upstreamDiscoveryRankingNextPair.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Ranking next pair",
              upstreamDiscoveryRankingNextPair.reason
            )
          : null,
        upstreamDiscoveryRankingArchive.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Ranking archive",
              upstreamDiscoveryRankingArchive.reason
            )
          : null
      ),
    }),
    buildIdParityRecord({
      key: "discoveryBoardArchiveSurface",
      label: "Discovery board archive",
      upstream: "composite",
      shellRoute: "/api/shell/discovery/board/archive",
      shellSurfaceHref: buildDiscoveryBoardArchiveScopeHref(routeScope),
      upstreamRoute: "composite/discovery-board/archive",
      shellIds: buildDiscoveryBoardHistoryIds({
        archive: shellDiscoveryBoardArchiveSnapshot?.archive,
        leaderboard: shellDiscoveryBoardArchiveSnapshot?.leaderboard,
        ideas: shellDiscoveryBoardArchiveSnapshot?.ideas ?? [],
      }),
      shellError:
        shellDiscoveryBoardArchive.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Discovery archive snapshot",
              shellDiscoveryBoardArchive.reason
            )
          : joinNonEmptyDetails(
              shellDiscoveryBoardArchiveSnapshot?.archiveError,
              shellDiscoveryBoardArchiveSnapshot?.leaderboardError,
              shellDiscoveryBoardArchiveSnapshot?.ideasError
            ),
      upstreamIds: buildDiscoveryBoardHistoryIds({
        archive:
          upstreamDiscoveryArchiveArchive.status === "fulfilled"
            ? upstreamDiscoveryArchiveArchive.value
            : null,
        leaderboard:
          upstreamDiscoveryArchiveLeaderboard.status === "fulfilled"
            ? upstreamDiscoveryArchiveLeaderboard.value
            : null,
        ideas:
          upstreamDiscoveryArchiveIdeas.status === "fulfilled"
            ? upstreamDiscoveryArchiveIdeas.value.ideas
            : [],
      }),
      upstreamError: joinNonEmptyDetails(
        upstreamDiscoveryArchiveArchive.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Ranking archive",
              upstreamDiscoveryArchiveArchive.reason
            )
          : null,
        upstreamDiscoveryArchiveLeaderboard.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Ranking leaderboard",
              upstreamDiscoveryArchiveLeaderboard.reason
            )
          : null,
        upstreamDiscoveryArchiveIdeas.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Discovery ideas",
              upstreamDiscoveryArchiveIdeas.reason
            )
          : null
      ),
    }),
    buildIdParityRecord({
      key: "discoveryBoardFinalsSurface",
      label: "Discovery board finals",
      upstream: "composite",
      shellRoute: "/api/shell/discovery/board/finals",
      shellSurfaceHref: buildDiscoveryBoardFinalsScopeHref(routeScope),
      upstreamRoute: "composite/discovery-board/finals",
      shellIds: buildDiscoveryBoardHistoryIds({
        archive: shellDiscoveryBoardFinalsSnapshot?.archive,
        leaderboard: shellDiscoveryBoardFinalsSnapshot?.leaderboard,
        ideas: shellDiscoveryBoardFinalsSnapshot?.ideas ?? [],
      }),
      shellError:
        shellDiscoveryBoardFinals.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Discovery finals snapshot",
              shellDiscoveryBoardFinals.reason
            )
          : joinNonEmptyDetails(
              shellDiscoveryBoardFinalsSnapshot?.archiveError,
              shellDiscoveryBoardFinalsSnapshot?.leaderboardError,
              shellDiscoveryBoardFinalsSnapshot?.ideasError
            ),
      upstreamIds: buildDiscoveryBoardHistoryIds({
        archive:
          upstreamDiscoveryFinalsArchive.status === "fulfilled"
            ? upstreamDiscoveryFinalsArchive.value
            : null,
        leaderboard:
          upstreamDiscoveryFinalsLeaderboard.status === "fulfilled"
            ? upstreamDiscoveryFinalsLeaderboard.value
            : null,
        ideas:
          upstreamDiscoveryFinalsIdeas.status === "fulfilled"
            ? upstreamDiscoveryFinalsIdeas.value.ideas
            : [],
      }),
      upstreamError: joinNonEmptyDetails(
        upstreamDiscoveryFinalsArchive.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Ranking archive",
              upstreamDiscoveryFinalsArchive.reason
            )
          : null,
        upstreamDiscoveryFinalsLeaderboard.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Ranking leaderboard",
              upstreamDiscoveryFinalsLeaderboard.reason
            )
          : null,
        upstreamDiscoveryFinalsIdeas.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Discovery ideas",
              upstreamDiscoveryFinalsIdeas.reason
            )
          : null
      ),
    }),
    buildIdParityRecord({
      key: "discoveryBoardSimulationsSurface",
      label: "Discovery board simulations",
      upstream: "composite",
      shellRoute: "/api/shell/discovery/board/simulations",
      shellSurfaceHref: buildDiscoveryBoardSimulationsScopeHref(routeScope),
      upstreamRoute: buildUpstreamRoute("orchestrate/discovery/ideas", boardIdeasQuery),
      shellIds: buildDiscoverySimulationSurfaceIds(
        shellDiscoveryBoardSimulationsSnapshot?.ideas ?? []
      ),
      shellError:
        shellDiscoveryBoardSimulations.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Discovery simulation snapshot",
              shellDiscoveryBoardSimulations.reason
            )
          : shellDiscoveryBoardSimulationsSnapshot?.ideasError ?? null,
      upstreamIds:
        upstreamDiscoveryBoardIdeas.status === "fulfilled"
          ? buildDiscoverySimulationSurfaceIds(
              upstreamDiscoveryBoardIdeas.value.ideas.filter(
                (idea) => idea.validation_state !== "archived"
              )
            )
          : [],
      upstreamError:
        upstreamDiscoveryBoardIdeas.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Discovery ideas",
              upstreamDiscoveryBoardIdeas.reason
            )
          : null,
    }),
    buildIdParityRecord({
      key: "discoveryAuthoringQueue",
      label: "Discovery authoring queue",
      upstream: "composite",
      shellRoute: "/api/shell/discovery/authoring",
      shellSurfaceHref: "/discovery/authoring",
      upstreamRoute: "composite/discovery-authoring",
      shellIds:
        shellDiscoveryAuthoringQueueSnapshot?.records.map((record) => record.key) ?? [],
      shellError:
        shellDiscoveryAuthoringQueue.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Discovery authoring queue snapshot",
              shellDiscoveryAuthoringQueue.reason
            )
          : shellDiscoveryAuthoringQueueSnapshot?.error ?? null,
      upstreamIds:
        upstreamDiscoveryAuthoringChainData.status === "fulfilled"
          ? buildDiscoveryAuthoringQueueRecords(
              upstreamDiscoveryAuthoringChainData.value
            ).map((record) => record.key)
          : [],
      upstreamError:
        upstreamDiscoveryAuthoringChainData.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Discovery authoring chain snapshot",
              upstreamDiscoveryAuthoringChainData.reason
            )
          : snapshotErrorsDetail(upstreamDiscoveryAuthoringChainSnapshot?.errors),
    }),
    buildIdParityRecord({
      key: "discoveryReviewQueue",
      label: "Discovery review queue",
      upstream: "composite",
      shellRoute: "/api/shell/discovery/review",
      shellSurfaceHref: "/discovery/review",
      upstreamRoute: "composite/review-center/discovery-lane",
      shellIds:
        upstreamDiscoveryReviewSnapshot?.records.map((record) => record.key) ?? [],
      shellError:
        upstreamDiscoveryReview.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Discovery review snapshot",
              upstreamDiscoveryReview.reason
            )
          : upstreamDiscoveryReviewSnapshot?.error ?? null,
      upstreamIds:
        shellReviewCenterSnapshot?.discovery.records.map((record) => record.key) ?? [],
      upstreamError:
        shellReviewCenter.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Review center snapshot",
              shellReviewCenter.reason
            )
          : shellReviewCenterSnapshot?.discovery.error ?? null,
    }),
    buildIdParityRecord({
      key: "discoveryTracesSurface",
      label: "Discovery traces surface",
      upstream: "composite",
      shellRoute: "/api/shell/discovery/traces",
      shellSurfaceHref: buildDiscoveryTracesScopeHref(),
      upstreamRoute: "composite/discovery-traces",
      shellIds:
        shellDiscoveryTracesSnapshot?.traces?.traces.map((trace) => trace.idea_id) ?? [],
      shellError:
        shellDiscoveryTraces.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Discovery traces snapshot",
              shellDiscoveryTraces.reason
            )
          : joinNonEmptyDetails(
              shellDiscoveryTracesSnapshot?.scoreboardError,
              shellDiscoveryTracesSnapshot?.tracesError
            ),
      upstreamIds:
        upstreamDiscoveryTraceSnapshot?.traces.map((trace) => trace.idea_id) ?? [],
      upstreamError: joinNonEmptyDetails(
        upstreamDiscoveryTraceScoreboardResult.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Discovery observability scoreboard",
              upstreamDiscoveryTraceScoreboardResult.reason
            )
          : null,
        upstreamDiscoveryTraceSnapshotResult.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Discovery traces",
              upstreamDiscoveryTraceSnapshotResult.reason
            )
          : null
      ),
    }),
    buildIdParityRecord({
      key: "discoveryReplaySurface",
      label: "Discovery replay surface",
      upstream: "composite",
      shellRoute: "/api/shell/discovery/replays",
      shellSurfaceHref: buildDiscoveryReplayScopeHref(),
      upstreamRoute: "composite/discovery-replays",
      shellIds: shellDiscoveryReplaySnapshot?.sessions.map((session) => session.id) ?? [],
      shellError:
        shellDiscoveryReplays.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Discovery replay snapshot",
              shellDiscoveryReplays.reason
            )
          : shellDiscoveryReplaySnapshot?.sessionsError ?? null,
      upstreamIds:
        upstreamSessions.status === "fulfilled"
          ? upstreamSessions.value.slice(0, 12).map((session) => session.id)
          : [],
      upstreamError:
        upstreamSessions.status === "rejected"
          ? formatUpstreamErrorMessage("Quorum sessions", upstreamSessions.reason)
          : null,
    }),
    buildIdParityRecord({
      key: "executionProjects",
      label: "Execution projects",
      upstream: "autopilot",
      shellRoute: "/api/shell/execution/workspace",
      shellSurfaceHref: "/execution",
      upstreamRoute: "projects/",
      shellIds:
        shellExecutionWorkspaceSnapshot?.projects.map((project) => project.id) ?? [],
      shellError:
        shellExecutionWorkspace.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Execution workspace snapshot",
              shellExecutionWorkspace.reason
            )
          : shellExecutionWorkspaceSnapshot?.projectsError ?? null,
      upstreamIds:
        upstreamProjects.status === "fulfilled"
          ? upstreamProjects.value.projects.map((project) => project.id)
          : [],
      upstreamError:
        upstreamProjects.status === "rejected"
          ? formatUpstreamErrorMessage("Execution projects", upstreamProjects.reason)
          : null,
    }),
    buildIdParityRecord({
      key: "executionIntakeSessions",
      label: "Execution intake sessions",
      upstream: "autopilot",
      shellRoute: "/api/shell/execution/intake",
      shellSurfaceHref: "/execution/intake",
      upstreamRoute: "intake/sessions",
      shellIds:
        shellExecutionIntakeSnapshot?.intakeSessions.map((session) => session.id) ??
        [],
      shellError:
        shellExecutionIntake.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Execution intake snapshot",
              shellExecutionIntake.reason
            )
          : shellExecutionIntakeSnapshot?.intakeSessionsError ?? null,
      upstreamIds:
        upstreamIntakeSessions.status === "fulfilled"
          ? upstreamIntakeSessions.value.sessions.map((session) => session.id)
          : [],
      upstreamError:
        upstreamIntakeSessions.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Execution intake sessions",
              upstreamIntakeSessions.reason
            )
          : null,
    }),
    buildIdParityRecord({
      key: "executionIssues",
      label: "Execution issues",
      upstream: "autopilot",
      shellRoute: "/api/shell/execution/review",
      shellSurfaceHref: "/execution/review?filter=issues",
      upstreamRoute: buildUpstreamRoute(
        "execution-plane/issues",
        openIssuesQuery
      ),
      shellIds:
        shellExecutionAttentionSnapshot?.issues.map((issue) => issue.id) ?? [],
      shellError:
        shellExecutionAttentionData.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Execution attention snapshot",
              shellExecutionAttentionData.reason
            )
          : findCategoryError(shellExecutionAttentionSnapshot?.errors ?? [], [
              "Execution issues",
            ]),
      upstreamIds:
        upstreamIssues.status === "fulfilled"
          ? upstreamIssues.value.issues.map((issue) => issue.id)
          : [],
      upstreamError:
        upstreamIssues.status === "rejected"
          ? formatUpstreamErrorMessage("Execution issues", upstreamIssues.reason)
          : null,
    }),
    buildIdParityRecord({
      key: "executionApprovals",
      label: "Execution approvals",
      upstream: "autopilot",
      shellRoute: "/api/shell/execution/review",
      shellSurfaceHref: "/execution/review?filter=approvals",
      upstreamRoute: buildUpstreamRoute(
        "execution-plane/approvals",
        pendingApprovalsQuery
      ),
      shellIds:
        shellExecutionAttentionSnapshot?.approvals.map((approval) => approval.id) ??
        [],
      shellError:
        shellExecutionAttentionData.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Execution attention snapshot",
              shellExecutionAttentionData.reason
            )
          : findCategoryError(shellExecutionAttentionSnapshot?.errors ?? [], [
              "Execution approvals",
            ]),
      upstreamIds:
        upstreamApprovals.status === "fulfilled"
          ? upstreamApprovals.value.approvals.map((approval) => approval.id)
          : [],
      upstreamError:
        upstreamApprovals.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Execution approvals",
              upstreamApprovals.reason
            )
          : null,
    }),
    buildIdParityRecord({
      key: "executionRuntimes",
      label: "Execution tool permissions",
      upstream: "autopilot",
      shellRoute: "/api/shell/execution/review",
      shellSurfaceHref: "/execution/review?filter=runtimes",
      upstreamRoute: buildUpstreamRoute(
        "execution-plane/tool-permission-runtimes",
        pendingRuntimesQuery
      ),
      shellIds:
        shellExecutionAttentionSnapshot?.runtimes.map((runtime) => runtime.id) ?? [],
      shellError:
        shellExecutionAttentionData.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Execution attention snapshot",
              shellExecutionAttentionData.reason
            )
          : findCategoryError(shellExecutionAttentionSnapshot?.errors ?? [], [
              "Tool permissions",
            ]),
      upstreamIds:
        upstreamRuntimes.status === "fulfilled"
          ? upstreamRuntimes.value.runtimes.map((runtime) => runtime.id)
          : [],
      upstreamError:
        upstreamRuntimes.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Execution tool permissions",
              upstreamRuntimes.reason
            )
          : null,
    }),
    buildIdParityRecord({
      key: "executionReviewQueue",
      label: "Execution review queue",
      upstream: "composite",
      shellRoute: "/api/shell/execution/review",
      shellSurfaceHref: "/execution/review",
      upstreamRoute: "composite/review-center/execution-lane",
      shellIds:
        upstreamExecutionReviewSnapshot?.records.map((record) => record.key) ?? [],
      shellError:
        upstreamExecutionReview.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Execution review snapshot",
              upstreamExecutionReview.reason
            )
          : upstreamExecutionReviewSnapshot?.error ?? null,
      upstreamIds:
        shellReviewCenterSnapshot?.execution.records.map((record) => record.key) ?? [],
      upstreamError:
        shellReviewCenter.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Review center snapshot",
              shellReviewCenter.reason
            )
          : shellReviewCenterSnapshot?.execution.error ?? null,
    }),
    buildIdParityRecord({
      key: "dashboardAttentionQueue",
      label: "Dashboard attention queue",
      upstream: "composite",
      shellRoute: "/api/shell/dashboard",
      shellSurfaceHref: "/dashboard",
      upstreamRoute: "composite/dashboard/attention",
      shellIds: shellDashboardSnapshot
        ? buildAttentionRecordKeys({
            discoveryFeed: shellDashboardSnapshot.discoveryFeed,
            projects: shellDashboardSnapshot.projects,
            intakeSessions: shellDashboardSnapshot.intakeSessions,
            approvals: shellDashboardSnapshot.approvals,
            issues: shellDashboardSnapshot.issues,
            runtimes: shellDashboardSnapshot.runtimes,
            chains: shellDashboardSnapshot.chains,
          })
        : [],
      shellError:
        shellDashboard.status === "rejected"
          ? formatUpstreamErrorMessage("Dashboard snapshot", shellDashboard.reason)
          : collectCategoryErrors(shellDashboardSnapshot?.errors, [
              "Discovery inbox",
              "Discovery ideas",
              "Discovery dossier",
              "Discovery dossiers",
              "Execution projects",
              "Execution intake sessions",
              "Execution issues",
              "Execution approvals",
              "Tool permissions",
            ]),
      upstreamIds:
        upstreamDashboardFeed.status === "fulfilled" &&
        upstreamDashboardChainData.status === "fulfilled"
          ? buildAttentionRecordKeys({
              discoveryFeed: upstreamDashboardFeed.value,
              projects: upstreamDashboardChainData.value.projects,
              intakeSessions: upstreamDashboardChainData.value.intakeSessions,
              approvals: upstreamDashboardChainData.value.approvals,
              issues: upstreamDashboardChainData.value.issues,
              runtimes: upstreamDashboardChainData.value.runtimes,
              chains: upstreamDashboardChainData.value.chains,
            })
          : [],
      upstreamError: joinNonEmptyDetails(
        upstreamDashboardFeed.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Dashboard discovery inbox",
              upstreamDashboardFeed.reason
            )
          : null,
        upstreamDashboardChainData.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Dashboard chain graph snapshot",
              upstreamDashboardChainData.reason
            )
          : snapshotErrorsDetail(upstreamDashboardChainSnapshot?.errors)
      ),
    }),
    buildIdParityRecord({
      key: "dashboardReviewPressure",
      label: "Dashboard review pressure",
      upstream: "composite",
      shellRoute: "/api/shell/dashboard",
      shellSurfaceHref: "/dashboard",
      upstreamRoute: "composite/dashboard/review-pressure",
      shellIds: shellDashboardSnapshot
        ? buildShellReviewPressureSummary({
            discoveryRecords: shellDashboardSnapshot.reviewCenter.discovery.records,
            executionRecords: shellDashboardSnapshot.reviewCenter.execution.records,
            chains: shellDashboardSnapshot.chains,
          }).hotspots.map((hotspot) => hotspot.chain.key)
        : [],
      shellError:
        shellDashboard.status === "rejected"
          ? formatUpstreamErrorMessage("Dashboard snapshot", shellDashboard.reason)
          : joinNonEmptyDetails(
              collectCategoryErrors(shellDashboardSnapshot?.errors, [
                "Discovery ideas",
                "Discovery dossier",
                "Discovery dossiers",
                "Execution projects",
                "Execution intake sessions",
                "Execution issues",
                "Execution approvals",
                "Tool permissions",
              ]),
              snapshotErrorsDetail(shellDashboardSnapshot?.reviewCenter.errors)
            ),
      upstreamIds:
        shellReviewCenter.status === "fulfilled" &&
        upstreamDashboardChainData.status === "fulfilled"
          ? buildShellReviewPressureSummary({
              discoveryRecords: shellReviewCenter.value.discovery.records,
              executionRecords: shellReviewCenter.value.execution.records,
              chains: upstreamDashboardChainData.value.chains,
            }).hotspots.map((hotspot) => hotspot.chain.key)
          : [],
      upstreamError: joinNonEmptyDetails(
        shellReviewCenter.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Review center snapshot",
              shellReviewCenter.reason
            )
          : snapshotErrorsDetail(shellReviewCenterSnapshot?.errors),
        upstreamDashboardChainData.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Dashboard chain graph snapshot",
              upstreamDashboardChainData.reason
            )
          : snapshotErrorsDetail(upstreamDashboardChainSnapshot?.errors)
      ),
    }),
    buildIdParityRecord({
      key: "inboxAttentionQueue",
      label: "Inbox attention queue",
      upstream: "composite",
      shellRoute: "/api/shell/inbox",
      shellSurfaceHref: "/inbox",
      upstreamRoute: "composite/inbox/attention",
      shellIds: shellInboxSnapshot
        ? buildAttentionRecordKeys({
            discoveryFeed: shellInboxSnapshot.discoveryFeed,
            projects: shellInboxSnapshot.projects,
            intakeSessions: shellInboxSnapshot.intakeSessions,
            approvals: shellInboxSnapshot.approvals,
            issues: shellInboxSnapshot.issues,
            runtimes: shellInboxSnapshot.runtimes,
            chains: shellInboxSnapshot.chains,
          })
        : [],
      shellError:
        shellInbox.status === "rejected"
          ? formatUpstreamErrorMessage("Inbox snapshot", shellInbox.reason)
          : collectCategoryErrors(shellInboxSnapshot?.errors, [
              "Discovery inbox",
              "Discovery ideas",
              "Discovery dossier",
              "Discovery dossiers",
              "Execution projects",
              "Execution intake sessions",
              "Execution issues",
              "Execution approvals",
              "Tool permissions",
            ]),
      upstreamIds:
        upstreamInboxFeed.status === "fulfilled" &&
        shellExecutionAttentionData.status === "fulfilled"
          ? buildAttentionRecordKeys({
              discoveryFeed: upstreamInboxFeed.value,
              projects: shellExecutionAttentionData.value.projects,
              intakeSessions: shellExecutionAttentionData.value.intakeSessions,
              approvals: shellExecutionAttentionData.value.approvals,
              issues: shellExecutionAttentionData.value.issues,
              runtimes: shellExecutionAttentionData.value.runtimes,
              chains: shellExecutionAttentionData.value.chains,
            })
          : [],
      upstreamError: joinNonEmptyDetails(
        upstreamInboxFeed.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Inbox discovery feed",
              upstreamInboxFeed.reason
            )
          : null,
        shellExecutionAttentionData.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Chain graph snapshot",
              shellExecutionAttentionData.reason
            )
          : snapshotErrorsDetail(shellExecutionAttentionSnapshot?.errors)
      ),
    }),
    buildIdParityRecord({
      key: "portfolioChains",
      label: "Portfolio chains",
      upstream: "composite",
      shellRoute: "/api/shell/portfolio",
      shellSurfaceHref: "/portfolio",
      upstreamRoute: "composite/chain-graph",
      shellIds: shellPortfolioSnapshot?.records.map((record) => record.key) ?? [],
      shellError:
        shellPortfolio.status === "rejected"
          ? formatUpstreamErrorMessage("Portfolio snapshot", shellPortfolio.reason)
          : null,
      upstreamIds:
        shellExecutionAttentionSnapshot?.chains.map((record) => record.key) ?? [],
      upstreamError:
        shellExecutionAttentionData.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Chain graph snapshot",
              shellExecutionAttentionData.reason
            )
          : snapshotErrorsDetail(shellExecutionAttentionSnapshot?.errors),
    }),
    buildIdParityRecord({
      key: "reviewCenterDiscovery",
      label: "Review center discovery lane",
      upstream: "composite",
      shellRoute: "/api/shell/review",
      shellSurfaceHref: "/review?lane=discovery",
      upstreamRoute: "composite/review-center/discovery",
      shellIds:
        shellReviewCenterSnapshot?.discovery.records.map((record) => record.key) ?? [],
      shellError:
        shellReviewCenter.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Review center snapshot",
              shellReviewCenter.reason
            )
          : null,
      upstreamIds:
        upstreamDiscoveryReviewSnapshot?.records.map((record) => record.key) ?? [],
      upstreamError:
        upstreamDiscoveryReview.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Discovery review snapshot",
              upstreamDiscoveryReview.reason
            )
          : upstreamDiscoveryReviewSnapshot?.error ?? null,
    }),
    buildIdParityRecord({
      key: "reviewCenterExecution",
      label: "Review center execution lane",
      upstream: "composite",
      shellRoute: "/api/shell/review",
      shellSurfaceHref: "/review?lane=execution",
      upstreamRoute: "composite/review-center/execution",
      shellIds:
        shellReviewCenterSnapshot?.execution.records.map((record) => record.key) ?? [],
      shellError:
        shellReviewCenter.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Review center snapshot",
              shellReviewCenter.reason
            )
          : null,
      upstreamIds:
        upstreamExecutionReviewSnapshot?.records.map(
          (record: (typeof upstreamExecutionReviewSnapshot.records)[number]) =>
            record.key
        ) ?? [],
      upstreamError:
        upstreamExecutionReview.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Execution review snapshot",
              upstreamExecutionReview.reason
            )
          : upstreamExecutionReviewSnapshot?.error ?? null,
    }),
    buildIdParityRecord({
      key: "reviewCenterTotal",
      label: "Review center combined queue",
      upstream: "composite",
      shellRoute: "/api/shell/review",
      shellSurfaceHref: "/review",
      upstreamRoute: "composite/review-center/all",
      shellIds: [
        ...(shellReviewCenterSnapshot?.discovery.records.map(
          (record) => `discovery:${record.key}`
        ) ?? []),
        ...(shellReviewCenterSnapshot?.execution.records.map(
          (record) => `execution:${record.key}`
        ) ?? []),
      ],
      shellError:
        shellReviewCenter.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Review center snapshot",
              shellReviewCenter.reason
            )
          : null,
      upstreamIds: [
        ...(upstreamDiscoveryReviewSnapshot?.records.map(
          (record) => `discovery:${record.key}`
        ) ?? []),
        ...(upstreamExecutionReviewSnapshot?.records.map(
          (record: (typeof upstreamExecutionReviewSnapshot.records)[number]) =>
            `execution:${record.key}`
        ) ?? []),
      ],
      upstreamError:
        joinNonEmptyDetails(
          upstreamDiscoveryReview.status === "rejected"
            ? formatUpstreamErrorMessage(
                "Discovery review snapshot",
                upstreamDiscoveryReview.reason
              )
            : upstreamDiscoveryReviewSnapshot?.error ?? null,
          upstreamExecutionReview.status === "rejected"
            ? formatUpstreamErrorMessage(
                "Execution review snapshot",
                upstreamExecutionReview.reason
              )
            : upstreamExecutionReviewSnapshot?.error ?? null
        ),
    }),
  ];

  const discoverySessionTargetId = firstNonEmptyId(
    options.discoverySessionId,
    firstSessionId(shellDiscoverySessionsSnapshot, upstreamSessions)
  );
  const discoveryIdeaTargetId = firstNonEmptyId(
    options.discoveryIdeaId,
    firstIdeaId(shellDiscoveryIdeasSnapshot, upstreamIdeas)
  );
  const executionProjectTargetId = firstNonEmptyId(
    routeScope.projectId,
    firstProjectId(shellExecutionWorkspaceSnapshot, upstreamProjects)
  );
  const executionIntakeTargetId = firstNonEmptyId(
    routeScope.intakeSessionId,
    firstIntakeSessionId(shellExecutionIntakeSnapshot, upstreamIntakeSessions)
  );

  const drilldownTasks: Array<Promise<ShellParityAuditDrilldown>> = [];

  drilldownTasks.push(
    buildDiscoveryBoardOverviewDrilldown({ routeScope }),
    buildDiscoveryBoardRankingDrilldown({ routeScope }),
    buildDiscoveryBoardArchiveDrilldown({ routeScope }),
    buildDiscoveryBoardFinalsDrilldown({ routeScope })
  );

  if (discoverySessionTargetId) {
    drilldownTasks.push(
      buildDiscoverySessionDrilldown({
        targetId: discoverySessionTargetId,
        routeScope,
      })
    );
    drilldownTasks.push(
      buildDiscoveryReplaySessionDrilldown({
        targetId: discoverySessionTargetId,
        routeScope,
      })
    );
  }
  if (discoveryIdeaTargetId) {
    drilldownTasks.push(
      buildDiscoveryIdeaDrilldown({
        targetId: discoveryIdeaTargetId,
        routeScope,
      })
    );
    drilldownTasks.push(
      buildDiscoveryTraceIdeaDrilldown({
        targetId: discoveryIdeaTargetId,
        routeScope,
      })
    );
    drilldownTasks.push(
      Promise.resolve(
        buildDiscoveryAuthoringIdeaDrilldown({
          targetId: discoveryIdeaTargetId,
          routeScope,
          shellAuthoringQueueResult: shellDiscoveryAuthoringQueue,
          upstreamAuthoringChainResult: upstreamDiscoveryAuthoringChainData,
        })
      ),
      buildDiscoveryBoardSimulationIdeaDrilldown({
        targetId: discoveryIdeaTargetId,
        routeScope,
      })
    );
  }
  if (executionProjectTargetId) {
    drilldownTasks.push(
      buildExecutionProjectDrilldown({
        targetId: executionProjectTargetId,
        routeScope,
      })
    );
  }
  if (executionIntakeTargetId) {
    drilldownTasks.push(
      buildExecutionIntakeDrilldown({
        targetId: executionIntakeTargetId,
        routeScope,
      })
    );
  }
  if (hasShellRouteScope(routeScope)) {
    drilldownTasks.push(
      Promise.resolve(
        buildScopedDashboardAttentionDrilldown({
          routeScope,
          shellDashboardResult: shellDashboard,
          upstreamDashboardFeedResult: upstreamDashboardFeed,
          upstreamDashboardChainDataResult: upstreamDashboardChainData,
        })
      ),
      Promise.resolve(
        buildScopedInboxAttentionDrilldown({
          routeScope,
          shellInboxResult: shellInbox,
          upstreamInboxFeedResult: upstreamInboxFeed,
          upstreamChainGraphResult: shellExecutionAttentionData,
        })
      ),
      Promise.resolve(
        buildScopedDiscoveryReviewQueueDrilldown({
          routeScope,
          shellDiscoveryReviewResult: upstreamDiscoveryReview,
          reviewCenterResult: shellReviewCenter,
        })
      ),
      Promise.resolve(
        buildScopedExecutionReviewQueueDrilldown({
          routeScope,
          shellExecutionReviewResult: upstreamExecutionReview,
          reviewCenterResult: shellReviewCenter,
        })
      ),
      Promise.resolve(
        buildScopedDiscoveryAuthoringQueueDrilldown({
          routeScope,
          shellAuthoringQueueResult: shellDiscoveryAuthoringQueue,
          upstreamAuthoringChainResult: upstreamDiscoveryAuthoringChainData,
        })
      ),
      Promise.resolve(
        buildScopedPortfolioCompositeDrilldown({
          routeScope,
          shellPortfolioResult: shellPortfolio,
          upstreamChainGraphResult: shellExecutionAttentionData,
        })
      ),
      Promise.resolve(
        buildScopedReviewCenterDiscoveryDrilldown({
          routeScope,
          shellReviewCenterResult: shellReviewCenter,
          upstreamDiscoveryReviewResult: upstreamDiscoveryReview,
        })
      ),
      Promise.resolve(
        buildScopedReviewCenterExecutionDrilldown({
          routeScope,
          shellReviewCenterResult: shellReviewCenter,
          upstreamExecutionReviewResult: upstreamExecutionReview,
        })
      )
    );
  }

  const drilldowns = await Promise.all(drilldownTasks);

  const errors = [
    ...records
      .filter((record) => record.status === "error")
      .map((record) => `${record.label}: ${record.detail}`),
    ...drilldowns
      .filter((record) => record.status === "error")
      .map((record) => `${record.label}: ${record.detail}`),
  ];

  return {
    generatedAt: new Date().toISOString(),
    records,
    drilldowns,
    summary: buildStatusSummary(records),
    drilldownSummary: buildStatusSummary(drilldowns),
    errors,
    loadState: errors.length > 0 ? "error" : "ready",
  };
}
