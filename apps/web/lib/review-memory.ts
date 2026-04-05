import type {
  ShellPreferences,
  ShellReviewLane,
  ShellReviewMemoryBucket,
  ShellReviewMemoryPreferences,
  ShellReviewPassPreference,
} from "@founderos/api-clients";

import type { ShellExecutionAttentionRecord } from "@/lib/attention-records";
import type { ShellChainRecord } from "@/lib/chain-graph";
import type { DiscoveryReviewFilter } from "@/lib/discovery-review-model";
import type { ExecutionReviewFilter } from "@/lib/execution-review-model";

import {
  DEFAULT_SHELL_REVIEW_MEMORY_PREFERENCES,
} from "@/lib/shell-preferences-contract";
import { reviewPresetDefinition } from "@/lib/review-presets";
import {
  buildDiscoveryReviewScopeHref,
  buildExecutionReviewScopeHref,
  buildReviewScopeHref,
  hasShellRouteScope,
  type ShellRouteScope,
} from "@/lib/route-scope";

type ReviewMemoryChainRef = Pick<ShellChainRecord, "kind" | "project" | "intakeSessionId"> & {
  projectId?: string | null;
};
type ReviewMemoryExecutionChainKind = ShellExecutionAttentionRecord["source"]["chainKind"];

const REVIEW_LANE_LABELS: Record<ShellReviewLane, string> = {
  all: "All review",
  discovery: "Discovery",
  execution: "Execution",
  authoring: "Authoring",
  trace: "Trace",
  handoff: "Handoff",
  followthrough: "Follow-through",
  issues: "Issues",
  approvals: "Approvals",
  runtimes: "Tool review",
  decisions: "Decisions",
  critical: "Critical",
  linked: "Linked",
  intake: "Intake",
};

export function reviewMemoryBucketLabel(bucket: ShellReviewMemoryBucket) {
  if (bucket === "linked") {
    return "Linked chains";
  }
  if (bucket === "intakeLinked") {
    return "Intake-origin chains";
  }
  if (bucket === "orphanProject") {
    return "Orphan execution projects";
  }
  return "Global review";
}

export function reviewMemoryBucketFromChainKind(
  chainKind?: ReviewMemoryExecutionChainKind | ShellChainRecord["kind"] | null
): ShellReviewMemoryBucket {
  if (chainKind === "linked") {
    return "linked";
  }
  if (chainKind === "intake-linked") {
    return "intakeLinked";
  }
  if (chainKind === "orphan-project") {
    return "orphanProject";
  }
  return "global";
}

export function describeReviewPassPreference(pass: ShellReviewPassPreference) {
  const presetLabel = pass.preset ? reviewPresetDefinition(pass.preset)?.label ?? pass.preset : null;
  return presetLabel
    ? `${REVIEW_LANE_LABELS[pass.lane]} lane + ${presetLabel}`
    : `${REVIEW_LANE_LABELS[pass.lane]} lane`;
}

export function resolveReviewMemoryBucket(args: {
  scope?: Partial<ShellRouteScope> | null;
  chainRecords?: ReviewMemoryChainRef[];
  executionChainKinds?: ReviewMemoryExecutionChainKind[];
}): ShellReviewMemoryBucket {
  if (!hasShellRouteScope(args.scope)) {
    return "global";
  }

  const projectId = (args.scope?.projectId || "").trim();
  const intakeSessionId = (args.scope?.intakeSessionId || "").trim();
  const matchedChain = (args.chainRecords || []).find((record) => {
    const chainProjectId = (record.projectId || record.project?.id || "").trim();
    if (projectId && chainProjectId !== projectId) {
      return false;
    }
    if (intakeSessionId && record.intakeSessionId !== intakeSessionId) {
      return false;
    }
    return Boolean(projectId || intakeSessionId);
  });

  if (matchedChain) {
    return reviewMemoryBucketFromChainKind(matchedChain.kind);
  }

  const resolvedExecutionKinds = Array.from(
    new Set(
      (args.executionChainKinds || []).filter(
        (kind): kind is Exclude<ReviewMemoryExecutionChainKind, "unlinked"> =>
          Boolean(kind) && kind !== "unlinked"
      )
    )
  );
  if (resolvedExecutionKinds.length === 1) {
    return reviewMemoryBucketFromChainKind(resolvedExecutionKinds[0]);
  }

  if (projectId && intakeSessionId) {
    return "linked";
  }

  if (intakeSessionId && !projectId) {
    return "intakeLinked";
  }

  if (projectId) {
    return "orphanProject";
  }

  return "global";
}

export function resolveRememberedReviewPass(
  preferences: Pick<ShellPreferences, "reviewMemory">,
  bucket?: ShellReviewMemoryBucket | null
) {
  const memoryBucket = bucket ?? "global";
  return preferences.reviewMemory[memoryBucket];
}

export function updateRememberedReviewPass(
  reviewMemory: ShellReviewMemoryPreferences,
  bucket: ShellReviewMemoryBucket,
  pass: ShellReviewPassPreference
): ShellReviewMemoryPreferences {
  return {
    ...reviewMemory,
    [bucket]: {
      lane: pass.lane,
      preset: pass.preset,
    },
  };
}

export function defaultRememberedReviewPass(bucket: ShellReviewMemoryBucket) {
  return DEFAULT_SHELL_REVIEW_MEMORY_PREFERENCES[bucket];
}

export function buildRememberedReviewScopeHref(args: {
  scope?: Partial<ShellRouteScope> | null;
  preferences: Pick<ShellPreferences, "reviewMemory">;
  bucket?: ShellReviewMemoryBucket | null;
}) {
  const pass = resolveRememberedReviewPass(args.preferences, args.bucket);
  return buildReviewScopeHref(
    args.scope,
    pass.lane === "all" ? null : pass.lane,
    pass.preset
  );
}

export function discoveryReviewFilterFromRememberedPass(
  pass: ShellReviewPassPreference,
  bucket?: ShellReviewMemoryBucket | null
): DiscoveryReviewFilter {
  if (pass.lane === "discovery") {
    return "all";
  }
  if (pass.lane === "authoring") {
    return "authoring";
  }
  if (pass.lane === "trace") {
    return "trace";
  }
  if (pass.lane === "handoff") {
    return "handoff";
  }
  if (pass.lane === "followthrough") {
    return "execution";
  }
  if (pass.lane === "linked") {
    return "linked";
  }
  if (pass.lane === "execution") {
    return "execution";
  }
  if (pass.preset === "discovery-pass") {
    return "authoring";
  }
  if (
    pass.preset === "chain-pass" &&
    (bucket === "linked" || bucket === "intakeLinked")
  ) {
    return "linked";
  }
  if (pass.preset === "decision-pass") {
    return "execution";
  }
  if (bucket === "linked") {
    return "linked";
  }
  return "all";
}

export function executionReviewFilterFromRememberedPass(
  pass: ShellReviewPassPreference,
  bucket?: ShellReviewMemoryBucket | null
): ExecutionReviewFilter {
  if (pass.lane === "execution") {
    return "all";
  }
  if (pass.lane === "issues") {
    return "issues";
  }
  if (pass.lane === "approvals") {
    return "approvals";
  }
  if (pass.lane === "runtimes") {
    return "runtimes";
  }
  if (pass.lane === "decisions") {
    return "decisions";
  }
  if (pass.lane === "intake") {
    return "intake";
  }
  if (pass.lane === "linked") {
    return "linked";
  }
  if (
    (pass.lane === "handoff" ||
      pass.lane === "trace" ||
      pass.lane === "authoring") &&
    bucket === "linked"
  ) {
    return "linked";
  }
  if (pass.lane === "followthrough") {
    if (bucket === "intakeLinked") {
      return "intake";
    }
    if (bucket === "linked") {
      return "linked";
    }
  }
  if (pass.lane === "critical" || pass.preset === "critical-pass") {
    return "issues";
  }
  if (pass.preset === "decision-pass") {
    return "decisions";
  }
  if (
    pass.preset === "chain-pass" &&
    (bucket === "linked" || bucket === "intakeLinked")
  ) {
    return bucket === "intakeLinked" ? "intake" : "linked";
  }
  if (pass.preset === "discovery-pass" && bucket === "linked") {
    return "linked";
  }
  if (bucket === "linked") {
    return "linked";
  }
  return "all";
}

export function reviewPassFromDiscoveryReviewFilter(
  filter: DiscoveryReviewFilter
): ShellReviewPassPreference {
  if (filter === "authoring") {
    return { lane: "authoring", preset: "discovery-pass" };
  }
  if (filter === "trace") {
    return { lane: "trace", preset: "discovery-pass" };
  }
  if (filter === "handoff") {
    return { lane: "handoff", preset: "discovery-pass" };
  }
  if (filter === "execution") {
    return { lane: "followthrough", preset: "chain-pass" };
  }
  if (filter === "linked") {
    return { lane: "linked", preset: "chain-pass" };
  }
  if (filter === "replay") {
    return { lane: "trace", preset: "discovery-pass" };
  }
  return { lane: "discovery", preset: null };
}

export function reviewPassFromExecutionReviewFilter(
  filter: ExecutionReviewFilter
): ShellReviewPassPreference {
  if (filter === "issues") {
    return { lane: "issues", preset: "critical-pass" };
  }
  if (filter === "approvals") {
    return { lane: "approvals", preset: "decision-pass" };
  }
  if (filter === "runtimes") {
    return { lane: "runtimes", preset: "decision-pass" };
  }
  if (filter === "decisions") {
    return { lane: "decisions", preset: "decision-pass" };
  }
  if (filter === "intake") {
    return { lane: "intake", preset: "decision-pass" };
  }
  if (filter === "linked") {
    return { lane: "linked", preset: "chain-pass" };
  }
  return { lane: "execution", preset: null };
}

export function buildUnifiedReviewScopeHrefFromDiscoveryFilter(
  scope: Partial<ShellRouteScope> | null | undefined,
  filter: DiscoveryReviewFilter
) {
  const pass = reviewPassFromDiscoveryReviewFilter(filter);
  return buildReviewScopeHref(scope, pass.lane === "all" ? null : pass.lane, pass.preset);
}

export function buildUnifiedReviewScopeHrefFromExecutionFilter(
  scope: Partial<ShellRouteScope> | null | undefined,
  filter: ExecutionReviewFilter
) {
  const pass = reviewPassFromExecutionReviewFilter(filter);
  return buildReviewScopeHref(scope, pass.lane === "all" ? null : pass.lane, pass.preset);
}

export function buildRememberedDiscoveryReviewScopeHref(args: {
  scope?: Partial<ShellRouteScope> | null;
  preferences: Pick<ShellPreferences, "reviewMemory">;
  bucket?: ShellReviewMemoryBucket | null;
}) {
  const pass = resolveRememberedReviewPass(args.preferences, args.bucket);
  return buildDiscoveryReviewScopeHref(
    args.scope,
    discoveryReviewFilterFromRememberedPass(pass, args.bucket)
  );
}

export function buildRememberedExecutionReviewScopeHref(args: {
  scope?: Partial<ShellRouteScope> | null;
  preferences: Pick<ShellPreferences, "reviewMemory">;
  bucket?: ShellReviewMemoryBucket | null;
}) {
  const pass = resolveRememberedReviewPass(args.preferences, args.bucket);
  return buildExecutionReviewScopeHref(
    args.scope,
    executionReviewFilterFromRememberedPass(pass, args.bucket)
  );
}
