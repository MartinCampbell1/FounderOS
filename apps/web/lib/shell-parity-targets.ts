import type {
  QuorumDiscoveryIdea,
  QuorumIdeaTraceBundle,
  QuorumSessionSummary,
  ShellParityTargetCoverage,
  ShellParityTargetRecord,
  ShellParityTargetsSnapshot,
} from "@founderos/api-clients";
import type { ShellChainRecord } from "@/lib/chain-graph";

import { loadShellChainGraphSnapshotData } from "@/lib/chain-graph-data";
import { buildDiscoveryTracesSnapshot } from "@/lib/discovery-history";
import {
  buildDiscoveryIdeaScopeHref,
  buildDiscoverySessionScopeHref,
  buildExecutionIntakeScopeHref,
  buildExecutionProjectScopeHref,
  normalizeShellRouteScope,
  normalizeShellSettingsParityTargets,
  type ShellRouteScope,
  type ShellSettingsParityTargets,
} from "@/lib/route-scope";
import { requestUpstreamJson, formatUpstreamErrorMessage } from "@/lib/upstream";

function normalizeValue(value: string | null | undefined) {
  return (value || "").trim();
}

function buildRecord(args: {
  key: ShellParityTargetRecord["key"];
  label: string;
  value: string;
  source: string;
  shellSurfaceHref: string;
}): ShellParityTargetRecord {
  return {
    key: args.key,
    label: args.label,
    value: args.value,
    available: Boolean(args.value),
    source: args.source,
    shellSurfaceHref: args.shellSurfaceHref,
  };
}

function traceBundleByIdeaId(traces: QuorumIdeaTraceBundle[]) {
  return new Map(traces.map((trace) => [trace.idea_id, trace]));
}

type ShellParityTargetCandidate = {
  kind: "chain" | "fallback";
  routeScope: ShellRouteScope;
  parityTargets: ShellSettingsParityTargets;
  projectSource: string;
  intakeSource: string;
  sessionSource: string;
  ideaSource: string;
  projectStatus: string;
  attentionTotal: number;
  swipeState: string;
  scenarioLabel: string;
  score: number;
  recencyScore: number;
};

function isCommittedSwipeState(value: string) {
  return ["yes", "now"].includes(normalizeValue(value));
}

function isReviewSwipeState(value: string) {
  return normalizeValue(value) === "maybe";
}

function resolvedProjectStatus(record: ShellChainRecord | null) {
  if (!record || !record.project) {
    return "";
  }

  if (record.project.paused || normalizeValue(record.project.status) === "paused") {
    return "paused";
  }

  return normalizeValue(record.project.status);
}

function resolvedAttentionTotal(record: ShellChainRecord | null) {
  return Number(record?.attention?.total || 0);
}

function resolvedSwipeState(record: ShellChainRecord | null) {
  return record?.kind === "linked" ? normalizeValue(record.idea.swipe_state) : "";
}

function buildScenarioLabel(args: {
  projectStatus: string;
  attentionTotal: number;
  swipeState: string;
}) {
  const projectLabel = args.projectStatus || "unscoped";
  const attentionLabel = args.attentionTotal > 0 ? "attention" : "clean";
  const swipeLabel = isCommittedSwipeState(args.swipeState)
    ? "committed"
    : isReviewSwipeState(args.swipeState)
      ? "review"
      : args.swipeState || "unknown";

  return `${projectLabel}|${attentionLabel}|${swipeLabel}`;
}

function isCompleteLinkedChainCandidate(candidate: ShellParityTargetCandidate) {
  return Boolean(
    candidate.kind === "chain" &&
      candidate.routeScope.projectId &&
      candidate.routeScope.intakeSessionId &&
      candidate.parityTargets.discoverySessionId &&
      candidate.parityTargets.discoveryIdeaId
  );
}

function candidateRecencyScore(record: ShellChainRecord | null) {
  if (!record) {
    return 0;
  }

  return Math.max(
    Date.parse(record.project?.last_activity_at ?? "") || 0,
    Date.parse(record.intakeSession?.updated_at ?? "") || 0,
    Date.parse(record.idea?.updated_at || record.idea?.created_at || "") || 0
  );
}

function candidateScore(candidate: ShellParityTargetCandidate) {
  return (
    (candidate.routeScope.projectId ? 160 : 0) +
    (candidate.routeScope.intakeSessionId ? 90 : 0) +
    (candidate.parityTargets.discoveryIdeaId ? 85 : 0) +
    (candidate.parityTargets.discoverySessionId ? 70 : 0)
  );
}

function buildChainCandidate(
  record: ShellChainRecord,
  traceBundles: Map<string, QuorumIdeaTraceBundle>
): ShellParityTargetCandidate {
  const ideaId = record.kind === "linked" ? record.idea.idea_id : "";
  const ideaTrace = ideaId ? traceBundles.get(ideaId) ?? null : null;
  const discoverySessionId = normalizeValue(ideaTrace?.linked_session_ids[0]);
  const routeScope = normalizeShellRouteScope({
    projectId:
      normalizeValue(record.project?.id) ||
      normalizeValue(record.intakeSession?.linked_project_id),
    intakeSessionId:
      normalizeValue(record.intakeSessionId) ||
      normalizeValue(record.intakeSession?.id),
  });
  const parityTargets = normalizeShellSettingsParityTargets({
    discoverySessionId,
    discoveryIdeaId: ideaId,
  });

  const projectStatus = resolvedProjectStatus(record);
  const attentionTotal = resolvedAttentionTotal(record);
  const swipeState = resolvedSwipeState(record);
  const candidate: ShellParityTargetCandidate = {
    kind: "chain",
    routeScope,
    parityTargets,
    projectSource:
      record.project || record.intakeSession?.linked_project_id
        ? record.kind === "linked"
          ? "linked discovery chain"
          : record.kind === "intake-linked"
            ? "linked intake chain"
            : "orphan execution project"
        : "unavailable",
    intakeSource:
      record.intakeSessionId || record.intakeSession?.id
        ? record.kind === "linked"
          ? "linked discovery chain"
          : "linked intake chain"
        : "unavailable",
    sessionSource: discoverySessionId
      ? "linked discovery trace"
      : "unavailable",
    ideaSource: ideaId
      ? "linked discovery chain"
      : "unavailable",
    projectStatus,
    attentionTotal,
    swipeState,
    scenarioLabel: buildScenarioLabel({
      projectStatus,
      attentionTotal,
      swipeState,
    }),
    score: 0,
    recencyScore: candidateRecencyScore(record),
  };
  candidate.score = candidateScore(candidate);
  return candidate;
}

function buildFallbackCandidate(args: {
  chains: ShellChainRecord[];
  ideas: QuorumDiscoveryIdea[];
  sessions: QuorumSessionSummary[];
  traceBundles: Map<string, QuorumIdeaTraceBundle>;
}): ShellParityTargetCandidate {
  const firstChainWithProject =
    args.chains.find((record) => normalizeValue(record.project?.id)) ?? null;
  const firstIntakeChain =
    args.chains.find(
      (record) =>
        normalizeValue(record.intakeSessionId) ||
        normalizeValue(record.intakeSession?.id)
    ) ?? null;
  const tracedIdea =
    [...args.traceBundles.values()].find(
      (trace) =>
        normalizeValue(trace.idea_id) &&
        trace.linked_session_ids.some((sessionId) => normalizeValue(sessionId))
    ) ??
    [...args.traceBundles.values()].find((trace) => normalizeValue(trace.idea_id)) ??
    null;
  const firstIdea = args.ideas[0] ?? null;
  const firstSession = args.sessions[0] ?? null;
  const tracedSessionId = normalizeValue(tracedIdea?.linked_session_ids[0]);
  const fallbackTraceSessionId = normalizeValue(tracedIdea?.linked_session_ids[0]);
  const candidate: ShellParityTargetCandidate = {
    kind: "fallback",
    routeScope: normalizeShellRouteScope({
      projectId:
        normalizeValue(firstChainWithProject?.project?.id) ||
        normalizeValue(firstChainWithProject?.intakeSession?.linked_project_id),
      intakeSessionId:
        normalizeValue(firstIntakeChain?.intakeSessionId) ||
        normalizeValue(firstIntakeChain?.intakeSession?.id),
    }),
    parityTargets: normalizeShellSettingsParityTargets({
      discoverySessionId: tracedSessionId || fallbackTraceSessionId || firstSession?.id,
      discoveryIdeaId: tracedIdea?.idea_id || firstIdea?.idea_id,
    }),
    projectSource: firstChainWithProject
      ? "chain graph fallback"
      : "unavailable",
    intakeSource: firstIntakeChain
      ? "chain graph fallback"
      : "unavailable",
    sessionSource: tracedSessionId
      ? "discovery trace bundle"
      : fallbackTraceSessionId
        ? "discovery trace bundle"
        : firstSession
          ? "discovery session list"
          : "unavailable",
    ideaSource: tracedIdea
      ? "discovery trace bundle"
      : firstIdea
        ? "discovery idea list"
        : "unavailable",
    projectStatus: resolvedProjectStatus(firstChainWithProject),
    attentionTotal: resolvedAttentionTotal(firstChainWithProject),
    swipeState: resolvedSwipeState(firstChainWithProject),
    scenarioLabel: buildScenarioLabel({
      projectStatus: resolvedProjectStatus(firstChainWithProject),
      attentionTotal: resolvedAttentionTotal(firstChainWithProject),
      swipeState: resolvedSwipeState(firstChainWithProject),
    }),
    score: 0,
    recencyScore: Math.max(
      candidateRecencyScore(firstChainWithProject),
      candidateRecencyScore(firstIntakeChain),
      Date.parse(firstIdea?.updated_at || firstIdea?.created_at || "") || 0
    ),
  };
  candidate.score = candidateScore(candidate);
  return candidate;
}

function preferredTargetCandidate(candidates: ShellParityTargetCandidate[]) {
  return [...candidates]
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return right.recencyScore - left.recencyScore;
    })[0] ?? null;
}

function buildCoverage(
  candidates: ShellParityTargetCandidate[],
  preferredCandidate: ShellParityTargetCandidate | null
): ShellParityTargetCoverage {
  const completeLinkedChains = candidates.filter(isCompleteLinkedChainCandidate);
  const scenarioLabels = [...new Set(completeLinkedChains.map((candidate) => candidate.scenarioLabel))]
    .filter(Boolean)
    .sort();

  return {
    chosenCandidateKind: preferredCandidate?.kind ?? "none",
    chosenCandidateScore: preferredCandidate?.score ?? 0,
    candidateCount: candidates.length,
    linkedChainCandidateCount: candidates.filter(
      (candidate) => candidate.kind === "chain"
    ).length,
    completeLinkedChainCount: completeLinkedChains.length,
    completeLinkedScenarioVariantCount: scenarioLabels.length,
    completeLinkedScenarioLabels: scenarioLabels,
    projectCandidateCount: candidates.filter(
      (candidate) => Boolean(candidate.routeScope.projectId)
    ).length,
    intakeCandidateCount: candidates.filter(
      (candidate) => Boolean(candidate.routeScope.intakeSessionId)
    ).length,
    discoverySessionCandidateCount: candidates.filter(
      (candidate) => Boolean(candidate.parityTargets.discoverySessionId)
    ).length,
    discoveryIdeaCandidateCount: candidates.filter(
      (candidate) => Boolean(candidate.parityTargets.discoveryIdeaId)
    ).length,
    operatorAttentionChainCount: completeLinkedChains.filter(
      (candidate) => candidate.attentionTotal > 0
    ).length,
    cleanExecutionChainCount: completeLinkedChains.filter(
      (candidate) => candidate.attentionTotal === 0
    ).length,
    pausedProjectChainCount: completeLinkedChains.filter(
      (candidate) => candidate.projectStatus === "paused"
    ).length,
    idleProjectChainCount: completeLinkedChains.filter(
      (candidate) => candidate.projectStatus === "idle"
    ).length,
    founderCommittedChainCount: completeLinkedChains.filter((candidate) =>
      isCommittedSwipeState(candidate.swipeState)
    ).length,
    founderReviewChainCount: completeLinkedChains.filter((candidate) =>
      isReviewSwipeState(candidate.swipeState)
    ).length,
  };
}

function collectSnapshotErrors(errors: Array<string | null | undefined>) {
  return errors
    .map((error) => normalizeValue(error))
    .filter(Boolean);
}

export async function buildShellParityTargetsSnapshot(): Promise<ShellParityTargetsSnapshot> {
  const [
    discoverySessionsResult,
    chainDataResult,
    discoveryTracesSnapshot,
  ] = await Promise.allSettled([
    requestUpstreamJson<QuorumSessionSummary[]>("quorum", "orchestrate/sessions"),
    loadShellChainGraphSnapshotData({
      discoveryIdeaLimit: 100,
      includeArchivedProjects: true,
      discoveryStages: ["handed_off", "executed", "simulated"],
    }),
    buildDiscoveryTracesSnapshot(null, { traceLimit: 48 }),
  ]);
  const sessions =
    discoverySessionsResult.status === "fulfilled" ? discoverySessionsResult.value : [];
  const chainData =
    chainDataResult.status === "fulfilled"
      ? chainDataResult.value
      : {
          ideas: [],
          dossiers: [],
          projects: [],
          intakeSessions: [],
          issues: [],
          approvals: [],
          runtimes: [],
          chains: [],
          errors: [
            formatUpstreamErrorMessage("Discovery chain graph", chainDataResult.reason),
          ],
          loadState: "error" as const,
        };
  const tracesSnapshot =
    discoveryTracesSnapshot.status === "fulfilled"
      ? discoveryTracesSnapshot.value
      : null;
  const traceBundles = traceBundleByIdeaId(tracesSnapshot?.traces?.traces ?? []);
  const chainCandidates = chainData.chains.map((record) =>
    buildChainCandidate(record, traceBundles)
  );
  const fallbackCandidate = buildFallbackCandidate({
    chains: chainData.chains,
    ideas: chainData.ideas,
    sessions,
    traceBundles,
  });
  const candidates = [...chainCandidates, fallbackCandidate];
  const preferredCandidate = preferredTargetCandidate(candidates);
  const coverage = buildCoverage(candidates, preferredCandidate);
  const routeScope = preferredCandidate?.routeScope ?? normalizeShellRouteScope(null);
  const parityTargets =
    preferredCandidate?.parityTargets ??
    normalizeShellSettingsParityTargets(null);
  const projectSource = preferredCandidate?.projectSource ?? "unavailable";
  const intakeSource = preferredCandidate?.intakeSource ?? "unavailable";
  const sessionSource = preferredCandidate?.sessionSource ?? "unavailable";
  const ideaSource = preferredCandidate?.ideaSource ?? "unavailable";

  const errors = collectSnapshotErrors([
    discoverySessionsResult.status === "fulfilled"
      ? null
      : formatUpstreamErrorMessage("Quorum sessions", discoverySessionsResult.reason),
    ...chainData.errors,
    discoveryTracesSnapshot.status === "fulfilled"
      ? discoveryTracesSnapshot.value.tracesError
      : formatUpstreamErrorMessage(
          "Discovery traces",
          discoveryTracesSnapshot.reason
        ),
  ]);

  const records: ShellParityTargetRecord[] = [
    buildRecord({
      key: "project",
      label: "Execution project",
      value: routeScope.projectId,
      source: projectSource,
      shellSurfaceHref: buildExecutionProjectScopeHref(routeScope.projectId, routeScope),
    }),
    buildRecord({
      key: "intakeSession",
      label: "Execution intake session",
      value: routeScope.intakeSessionId,
      source: intakeSource,
      shellSurfaceHref: buildExecutionIntakeScopeHref(routeScope.intakeSessionId, routeScope),
    }),
    buildRecord({
      key: "discoverySession",
      label: "Discovery session",
      value: parityTargets.discoverySessionId,
      source: sessionSource,
      shellSurfaceHref: buildDiscoverySessionScopeHref(
        parityTargets.discoverySessionId,
        routeScope
      ),
    }),
    buildRecord({
      key: "discoveryIdea",
      label: "Discovery idea",
      value: parityTargets.discoveryIdeaId,
      source: ideaSource,
      shellSurfaceHref: buildDiscoveryIdeaScopeHref(parityTargets.discoveryIdeaId, routeScope),
    }),
  ];

  return {
    generatedAt: new Date().toISOString(),
    routeScope,
    parityTargets,
    records,
    coverage,
    errors,
    loadState: "ready",
  };
}
