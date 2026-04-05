import type {
  ApprovalAttentionRecord,
  IssueAttentionRecord,
  RuntimeAttentionRecord,
} from "@/lib/attention-records";
import type { ShellDiscoveryReviewRecord } from "@/lib/discovery-review";
import type {
  ShellMutationEffect,
} from "@/lib/shell-mutation-effects";
import type { ShellRouteScope } from "@/lib/route-scope";
import type { ShellRouteMutationInvalidation } from "@/lib/use-shell-route-mutation";
import {
  countReviewPresetMatches,
  reviewPresetDefinition,
  type ReviewPresetBuckets,
  type ShellReviewPreset,
} from "@/lib/review-presets";
import {
  runDiscoveryReviewBatchAction,
  runExecutionReviewBatchAction,
} from "@/lib/review-batch-actions";

export interface ReviewPresetEffectData {
  preset: ShellReviewPreset;
  processedKeys: string[];
  successCount: number;
  failureCount: number;
  failureMessages: string[];
  stepCount: number;
}

export type ReviewPresetEffect = ShellMutationEffect<ReviewPresetEffectData> & {
  preset: ShellReviewPreset;
  data: ReviewPresetEffectData;
};

function presetInvalidation(args: {
  preset: ShellReviewPreset;
  routeScope?: Partial<ShellRouteScope> | null;
  planes: Array<"discovery" | "execution">;
  source: string;
}): ShellRouteMutationInvalidation {
  return {
    planes: args.planes,
    scope: args.routeScope,
    source: args.source,
    reason: `review-preset:${args.preset}`,
  };
}

async function maybeRunDiscoveryStep(args: {
  action: "confirm";
  records: ShellDiscoveryReviewRecord[];
  routeScope?: Partial<ShellRouteScope> | null;
  source: string;
}) {
  if (args.records.length === 0) {
    return null;
  }
  return runDiscoveryReviewBatchAction({
    action: args.action,
    records: args.records,
    routeScope: args.routeScope,
    source: args.source,
  });
}

async function maybeRunExecutionIssueStep(args: {
  records: IssueAttentionRecord[];
  routeScope?: Partial<ShellRouteScope> | null;
  source: string;
}) {
  if (args.records.length === 0) {
    return null;
  }
  return runExecutionReviewBatchAction({
    action: "resolve-issue",
    records: args.records,
    routeScope: args.routeScope,
    source: args.source,
  });
}

async function maybeRunExecutionApprovalStep(args: {
  records: ApprovalAttentionRecord[];
  routeScope?: Partial<ShellRouteScope> | null;
  source: string;
}) {
  if (args.records.length === 0) {
    return null;
  }
  return runExecutionReviewBatchAction({
    action: "approve",
    records: args.records,
    routeScope: args.routeScope,
    source: args.source,
  });
}

async function maybeRunExecutionRuntimeStep(args: {
  records: RuntimeAttentionRecord[];
  routeScope?: Partial<ShellRouteScope> | null;
  source: string;
}) {
  if (args.records.length === 0) {
    return null;
  }
  return runExecutionReviewBatchAction({
    action: "allow",
    records: args.records,
    routeScope: args.routeScope,
    source: args.source,
  });
}

export async function runReviewPresetAction(args: {
  preset: ShellReviewPreset;
  buckets: ReviewPresetBuckets;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<ReviewPresetEffect> {
  const definition = reviewPresetDefinition(args.preset);
  const source = args.source || "review-center";
  const actionableCount = countReviewPresetMatches(args.preset, args.buckets);

  if (!definition) {
    throw new Error("Unknown review preset.");
  }
  if (actionableCount <= 0) {
    throw new Error(`No visible review records match the ${definition.label.toLowerCase()}.`);
  }

  const processedKeys = new Set<string>();
  const failureMessages: string[] = [];
  const touchedPlanes = new Set<"discovery" | "execution">();
  let stepCount = 0;

  const runStep = async (
    plane: "discovery" | "execution",
    label: string,
    action: () => Promise<{ data: { processedKeys: string[] } } | null>
  ) => {
    try {
      const effect = await action();
      if (!effect) {
        return;
      }
      touchedPlanes.add(plane);
      stepCount += 1;
      for (const key of effect.data.processedKeys) {
        processedKeys.add(key);
      }
    } catch (error) {
      failureMessages.push(
        `${label}: ${error instanceof Error ? error.message : "Action failed."}`
      );
    }
  };

  if (args.preset === "discovery-pass") {
    await runStep("discovery", "Discovery confirm", () =>
      maybeRunDiscoveryStep({
        action: "confirm",
        records: args.buckets.discoveryRecords,
        routeScope: args.routeScope,
        source,
      })
    );
  } else if (args.preset === "critical-pass") {
    await runStep("execution", "Critical issue resolution", () =>
      maybeRunExecutionIssueStep({
        records: args.buckets.criticalIssueRecords,
        routeScope: args.routeScope,
        source,
      })
    );
  } else if (args.preset === "decision-pass") {
    await runStep("execution", "Approval decisions", () =>
      maybeRunExecutionApprovalStep({
        records: args.buckets.approvalRecords,
        routeScope: args.routeScope,
        source,
      })
    );
    await runStep("execution", "Tool permission decisions", () =>
      maybeRunExecutionRuntimeStep({
        records: args.buckets.runtimeRecords,
        routeScope: args.routeScope,
        source,
      })
    );
  } else {
    await runStep("discovery", "Discovery confirm", () =>
      maybeRunDiscoveryStep({
        action: "confirm",
        records: args.buckets.discoveryRecords,
        routeScope: args.routeScope,
        source,
      })
    );
    await runStep("execution", "Issue resolution", () =>
      maybeRunExecutionIssueStep({
        records: args.buckets.issueRecords,
        routeScope: args.routeScope,
        source,
      })
    );
    await runStep("execution", "Approval decisions", () =>
      maybeRunExecutionApprovalStep({
        records: args.buckets.approvalRecords,
        routeScope: args.routeScope,
        source,
      })
    );
    await runStep("execution", "Tool permission decisions", () =>
      maybeRunExecutionRuntimeStep({
        records: args.buckets.runtimeRecords,
        routeScope: args.routeScope,
        source,
      })
    );
  }

  if (processedKeys.size === 0 && failureMessages.length > 0) {
    throw new Error(failureMessages.join(" "));
  }

  const planes = Array.from(touchedPlanes);

  return {
    preset: args.preset,
    statusMessage: `${definition.label} ran across ${processedKeys.size} visible review records.`,
    errorMessage: failureMessages.length > 0 ? failureMessages.join(" ") : null,
    invalidation:
      planes.length > 0
        ? presetInvalidation({
            preset: args.preset,
            planes,
            routeScope: args.routeScope,
            source,
          })
        : false,
    data: {
      preset: args.preset,
      processedKeys: Array.from(processedKeys),
      successCount: processedKeys.size,
      failureCount: failureMessages.length,
      failureMessages,
      stepCount,
    },
  };
}
