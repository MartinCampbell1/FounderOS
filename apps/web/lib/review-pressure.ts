import type { ShellExecutionAttentionRecord } from "@/lib/attention-records";
import type { ShellChainRecord } from "@/lib/chain-graph";
import type {
  DiscoveryReviewFilter,
} from "@/lib/discovery-review-model";
import type { ShellDiscoveryReviewRecord } from "@/lib/discovery-review";
import type {
  ExecutionReviewFilter,
} from "@/lib/execution-review-model";
import type { ShellReviewCenterLane } from "@/lib/review-center";

import { buildDiscoveryReviewStatsFromRecords } from "@/lib/discovery-review-model";
import { buildExecutionReviewRollupFromAttentionRecords } from "@/lib/execution-review-model";

type PressureTone = "danger" | "warning" | "info" | "success" | "neutral";

export interface ShellReviewPressureLaneSummary {
  key:
    | "authoring"
    | "trace"
    | "handoff"
    | "followthrough"
    | "issues"
    | "approvals"
    | "decisions"
    | "runtimes"
    | "critical"
    | "linked"
    | "intake";
  label: string;
  detail: string;
  count: number;
  tone: PressureTone;
  lane: ShellReviewCenterLane;
  discoveryFilter?: DiscoveryReviewFilter | null;
  executionFilter?: ExecutionReviewFilter | null;
}

export interface ShellReviewPressureHotspot {
  chain: ShellChainRecord;
  score: number;
  totalCount: number;
  discoveryCount: number;
  executionCount: number;
  authoringCount: number;
  traceCount: number;
  handoffCount: number;
  followthroughCount: number;
  issueCount: number;
  approvalCount: number;
  decisionCount: number;
  runtimeCount: number;
  criticalIssueCount: number;
  suggestedLane: ShellReviewCenterLane;
  suggestedLabel: string;
  reason: string;
}

export interface ShellReviewPressureSummary {
  totalCount: number;
  discoveryCount: number;
  executionCount: number;
  linkedCount: number;
  criticalCount: number;
  unlinkedCount: number;
  intakeCount: number;
  lanes: ShellReviewPressureLaneSummary[];
  hotspots: ShellReviewPressureHotspot[];
}

type ChainPressureAccumulator = {
  chain: ShellChainRecord;
  discoveryCount: number;
  executionCount: number;
  authoringCount: number;
  traceCount: number;
  handoffCount: number;
  followthroughCount: number;
  issueCount: number;
  approvalCount: number;
  decisionCount: number;
  runtimeCount: number;
  criticalIssueCount: number;
};

function createChainAccumulator(
  chain: ShellChainRecord
): ChainPressureAccumulator {
  return {
    chain,
    discoveryCount: 0,
    executionCount: 0,
    authoringCount: 0,
    traceCount: 0,
    handoffCount: 0,
    followthroughCount: 0,
    issueCount: 0,
    approvalCount: 0,
    decisionCount: 0,
    runtimeCount: 0,
    criticalIssueCount: 0,
  };
}

function chainMaps(records: ShellChainRecord[]) {
  const byKey = new Map<string, ShellChainRecord>();
  const byProjectId = new Map<string, ShellChainRecord>();
  const byIntakeSessionId = new Map<string, ShellChainRecord>();
  const byBriefId = new Map<string, ShellChainRecord>();

  for (const record of records) {
    byKey.set(record.key, record);
    if (record.project?.id) {
      byProjectId.set(record.project.id, record);
    }
    if (record.intakeSessionId) {
      byIntakeSessionId.set(record.intakeSessionId, record);
    }
    if (record.briefId) {
      byBriefId.set(record.briefId, record);
    }
  }

  return {
    byKey,
    byProjectId,
    byIntakeSessionId,
    byBriefId,
  };
}

function accumulatorForChain(
  map: Map<string, ChainPressureAccumulator>,
  chain: ShellChainRecord | null
) {
  if (!chain) {
    return null;
  }

  const existing = map.get(chain.key);
  if (existing) {
    return existing;
  }

  const created = createChainAccumulator(chain);
  map.set(chain.key, created);
  return created;
}

function discoveryLaneTone(
  key: ShellReviewPressureLaneSummary["key"],
  count: number
): PressureTone {
  if (count <= 0) return "neutral";
  if (key === "authoring") return "warning";
  if (key === "trace") return "info";
  if (key === "handoff") return "success";
  if (key === "followthrough") return "neutral";
  return "warning";
}

function executionLaneTone(
  key: ShellReviewPressureLaneSummary["key"],
  count: number
): PressureTone {
  if (count <= 0) return "neutral";
  if (key === "critical" || key === "issues") return "danger";
  if (key === "decisions" || key === "runtimes") return "warning";
  if (key === "intake") return "info";
  return "neutral";
}

function chainForExecutionRecord(
  record: ShellExecutionAttentionRecord,
  maps: ReturnType<typeof chainMaps>
) {
  return (
    maps.byProjectId.get(record.source.projectId) ??
    (record.source.sourceKind === "intake_session"
      ? maps.byIntakeSessionId.get(record.source.sourceExternalId)
      : null) ??
    (record.source.briefId ? maps.byBriefId.get(record.source.briefId) : null) ??
    null
  );
}

function hotspotScore(accumulator: ChainPressureAccumulator) {
  return (
    accumulator.criticalIssueCount * 48 +
    accumulator.issueCount * 18 +
    accumulator.decisionCount * 16 +
    accumulator.runtimeCount * 12 +
    accumulator.authoringCount * 14 +
    accumulator.traceCount * 11 +
    accumulator.handoffCount * 10 +
    accumulator.followthroughCount * 7
  );
}

function hotspotLane(
  accumulator: ChainPressureAccumulator
): Pick<ShellReviewPressureHotspot, "suggestedLane" | "suggestedLabel" | "reason"> {
  if (accumulator.criticalIssueCount > 0) {
    return {
      suggestedLane: "critical",
      suggestedLabel: "Open critical review",
      reason: `${accumulator.criticalIssueCount} critical execution issues are blocking this chain.`,
    };
  }
  if (accumulator.issueCount > 0) {
    return {
      suggestedLane: "issues",
      suggestedLabel: "Open issue triage",
      reason: `${accumulator.issueCount} execution issues still need operator triage.`,
    };
  }
  if (accumulator.decisionCount > 0) {
    return {
      suggestedLane: "decisions",
      suggestedLabel: "Open decision gates",
      reason: `${accumulator.decisionCount} approvals or tool-permission gates are still waiting.`,
    };
  }
  if (accumulator.authoringCount > 0) {
    return {
      suggestedLane: "authoring",
      suggestedLabel: "Open authoring review",
      reason: `${accumulator.authoringCount} discovery authoring items still block review readiness.`,
    };
  }
  if (accumulator.traceCount > 0) {
    return {
      suggestedLane: "trace",
      suggestedLabel: "Open trace review",
      reason: `${accumulator.traceCount} trace-linked discovery decisions need another pass.`,
    };
  }
  if (accumulator.handoffCount > 0) {
    return {
      suggestedLane: "handoff",
      suggestedLabel: "Open handoff review",
      reason: `${accumulator.handoffCount} discovery dossiers are ready for handoff review.`,
    };
  }
  if (accumulator.followthroughCount > 0) {
    return {
      suggestedLane: "followthrough",
      suggestedLabel: "Open follow-through review",
      reason: `${accumulator.followthroughCount} linked discovery records still need execution follow-through.`,
    };
  }

  return {
    suggestedLane: "linked",
    suggestedLabel: "Open linked review",
    reason: "This chain still carries linked review pressure inside the shell.",
  };
}

export function buildShellReviewPressureSummary(args: {
  discoveryRecords: ShellDiscoveryReviewRecord[];
  executionRecords: ShellExecutionAttentionRecord[];
  chains: ShellChainRecord[];
}): ShellReviewPressureSummary {
  const discoveryStats = buildDiscoveryReviewStatsFromRecords(args.discoveryRecords);
  const executionRollup = buildExecutionReviewRollupFromAttentionRecords(
    args.executionRecords
  );
  const maps = chainMaps(args.chains);
  const chainPressure = new Map<string, ChainPressureAccumulator>();

  for (const record of args.discoveryRecords) {
    const accumulator = accumulatorForChain(chainPressure, record.chain);
    if (!accumulator) {
      continue;
    }

    accumulator.discoveryCount += 1;
    if (record.kind === "authoring") {
      accumulator.authoringCount += 1;
    }
    if (record.kind === "trace-review") {
      accumulator.traceCount += 1;
    }
    if (record.kind === "handoff-ready") {
      accumulator.handoffCount += 1;
    }
    if (record.kind === "execution-followthrough") {
      accumulator.followthroughCount += 1;
    }
  }

  for (const record of args.executionRecords) {
    const accumulator = accumulatorForChain(
      chainPressure,
      chainForExecutionRecord(record, maps)
    );
    if (!accumulator) {
      continue;
    }

    accumulator.executionCount += 1;
    if (record.type === "issue") {
      accumulator.issueCount += 1;
      if (record.issue.severity === "critical") {
        accumulator.criticalIssueCount += 1;
      }
    }
    if (record.type === "approval") {
      accumulator.approvalCount += 1;
      accumulator.decisionCount += 1;
    }
    if (record.type === "runtime") {
      accumulator.runtimeCount += 1;
      accumulator.decisionCount += 1;
    }
  }

  const hotspots = [...chainPressure.values()]
    .map((accumulator) => {
      const totalCount = accumulator.discoveryCount + accumulator.executionCount;
      const suggestion = hotspotLane(accumulator);

      return {
        chain: accumulator.chain,
        score: hotspotScore(accumulator),
        totalCount,
        discoveryCount: accumulator.discoveryCount,
        executionCount: accumulator.executionCount,
        authoringCount: accumulator.authoringCount,
        traceCount: accumulator.traceCount,
        handoffCount: accumulator.handoffCount,
        followthroughCount: accumulator.followthroughCount,
        issueCount: accumulator.issueCount,
        approvalCount: accumulator.approvalCount,
        decisionCount: accumulator.decisionCount,
        runtimeCount: accumulator.runtimeCount,
        criticalIssueCount: accumulator.criticalIssueCount,
        suggestedLane: suggestion.suggestedLane,
        suggestedLabel: suggestion.suggestedLabel,
        reason: suggestion.reason,
      } satisfies ShellReviewPressureHotspot;
    })
    .filter((hotspot) => hotspot.score > 0)
    .sort((left, right) => {
      const scoreDelta = right.score - left.score;
      if (scoreDelta !== 0) {
        return scoreDelta;
      }
      return right.totalCount - left.totalCount;
    });

  const lanes = [
    {
      key: "critical",
      label: "Critical",
      detail: "Execution issues marked critical.",
      count: executionRollup.criticalIssueCount,
      tone: executionLaneTone("critical", executionRollup.criticalIssueCount),
      lane: "critical",
      executionFilter: "issues",
    },
    {
      key: "issues",
      label: "Issues",
      detail: "Execution issues waiting for triage.",
      count: executionRollup.issueCount,
      tone: executionLaneTone("issues", executionRollup.issueCount),
      lane: "issues",
      executionFilter: "issues",
    },
    {
      key: "approvals",
      label: "Approvals",
      detail: "Execution approval prompts waiting for operator input.",
      count: executionRollup.approvalCount,
      tone: executionLaneTone("approvals", executionRollup.approvalCount),
      lane: "approvals",
      executionFilter: "approvals",
    },
    {
      key: "decisions",
      label: "Decisions",
      detail: "Execution approvals and tool gates waiting for operator input.",
      count: executionRollup.decisionCount,
      tone: executionLaneTone("decisions", executionRollup.decisionCount),
      lane: "decisions",
      executionFilter: "decisions",
    },
    {
      key: "runtimes",
      label: "Tool review",
      detail: "Execution tool-permission prompts waiting for review.",
      count: executionRollup.runtimeCount,
      tone: executionLaneTone("runtimes", executionRollup.runtimeCount),
      lane: "runtimes",
      executionFilter: "runtimes",
    },
    {
      key: "authoring",
      label: "Authoring",
      detail: "Discovery dossiers still missing authoring coverage.",
      count: discoveryStats.authoringCount,
      tone: discoveryLaneTone("authoring", discoveryStats.authoringCount),
      lane: "authoring",
      discoveryFilter: "authoring",
    },
    {
      key: "trace",
      label: "Trace",
      detail: "Trace-linked discovery decisions waiting for re-review.",
      count: discoveryStats.traceReviewCount,
      tone: discoveryLaneTone("trace", discoveryStats.traceReviewCount),
      lane: "trace",
      discoveryFilter: "trace",
    },
    {
      key: "handoff",
      label: "Handoff",
      detail: "Discovery dossiers ready for execution handoff review.",
      count: discoveryStats.handoffReadyCount,
      tone: discoveryLaneTone("handoff", discoveryStats.handoffReadyCount),
      lane: "handoff",
      discoveryFilter: "handoff",
    },
    {
      key: "followthrough",
      label: "Follow-through",
      detail: "Discovery-linked execution work still needs follow-through.",
      count: discoveryStats.executionFollowthroughCount,
      tone: discoveryLaneTone(
        "followthrough",
        discoveryStats.executionFollowthroughCount
      ),
      lane: "followthrough",
      discoveryFilter: "execution",
    },
    {
      key: "linked",
      label: "Linked",
      detail: "Review work already tied to the normalized chain graph.",
      count: discoveryStats.linkedCount + executionRollup.chainLinkedCount,
      tone: "info",
      lane: "linked",
      discoveryFilter: "linked",
      executionFilter: "linked",
    },
    {
      key: "intake",
      label: "Intake",
      detail: "Execution review pressure coming from intake-origin projects.",
      count: executionRollup.intakeOriginCount,
      tone: executionLaneTone("intake", executionRollup.intakeOriginCount),
      lane: "intake",
      executionFilter: "intake",
    },
  ] satisfies ShellReviewPressureLaneSummary[];

  return {
    totalCount: discoveryStats.totalCount + executionRollup.totalCount,
    discoveryCount: discoveryStats.totalCount,
    executionCount: executionRollup.totalCount,
    linkedCount: discoveryStats.linkedCount + executionRollup.chainLinkedCount,
    criticalCount: executionRollup.criticalIssueCount,
    unlinkedCount:
      (discoveryStats.totalCount - discoveryStats.linkedCount) +
      (executionRollup.totalCount - executionRollup.chainLinkedCount),
    intakeCount: executionRollup.intakeOriginCount,
    lanes: lanes.filter((lane) => lane.count > 0),
    hotspots: hotspots.slice(0, 4),
  };
}
