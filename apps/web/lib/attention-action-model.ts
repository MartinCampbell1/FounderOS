import type {
  AutopilotExecutionApprovalRecord,
  AutopilotExecutionIssueRecord,
  AutopilotToolPermissionRuntimeRecord,
  QuorumDiscoveryInboxItem,
} from "@founderos/api-clients";

import {
  runDiscoveryInboxAction,
  type DiscoveryMutationEffect,
} from "@/lib/discovery-mutations";
import {
  allowExecutionRuntime,
  approveExecutionApproval,
  denyExecutionRuntime,
  rejectExecutionApproval,
  resolveExecutionIssue,
  type ExecutionMutationEffect,
} from "@/lib/execution-mutations";
import type { ShellExecutionSourceContext } from "@/lib/execution-source";
import type { ShellRouteScope } from "@/lib/route-scope";
import type { ShellMutationEffect } from "@/lib/shell-mutation-effects";

export type AttentionActionResult =
  | ShellMutationEffect<unknown>
  | DiscoveryMutationEffect
  | ExecutionMutationEffect<unknown>;

type DiscoveryAttentionActionArgs =
  | {
      plane: "discovery";
      action: "resolve" | "accept" | "ignore";
      item: QuorumDiscoveryInboxItem;
      routeScope?: Partial<ShellRouteScope> | null;
      source?: string;
    }
  | {
      plane: "discovery";
      action: "compare";
      item: QuorumDiscoveryInboxItem;
      compareIdeaId: string;
      note: string;
      routeScope?: Partial<ShellRouteScope> | null;
      source?: string;
    }
  | {
      plane: "discovery";
      action: "edit";
      item: QuorumDiscoveryInboxItem;
      editText: string;
      routeScope?: Partial<ShellRouteScope> | null;
      source?: string;
    }
  | {
      plane: "discovery";
      action: "respond";
      item: QuorumDiscoveryInboxItem;
      responseText: string;
      routeScope?: Partial<ShellRouteScope> | null;
      source?: string;
    };

type ExecutionAttentionActionArgs =
  | {
      plane: "execution";
      action: "resolve-issue";
      issue: Pick<AutopilotExecutionIssueRecord, "id">;
      sourceContext: ShellExecutionSourceContext;
      routeScope?: Partial<ShellRouteScope> | null;
      source?: string;
    }
  | {
      plane: "execution";
      action: "approve" | "reject";
      approval: Pick<AutopilotExecutionApprovalRecord, "id">;
      sourceContext: ShellExecutionSourceContext;
      routeScope?: Partial<ShellRouteScope> | null;
      source?: string;
    }
  | {
      plane: "execution";
      action: "allow" | "deny";
      runtime: Pick<AutopilotToolPermissionRuntimeRecord, "id">;
      sourceContext: ShellExecutionSourceContext;
      routeScope?: Partial<ShellRouteScope> | null;
      source?: string;
    };

export type AttentionActionArgs =
  | DiscoveryAttentionActionArgs
  | ExecutionAttentionActionArgs;

export async function runAttentionAction(
  args: AttentionActionArgs
): Promise<AttentionActionResult> {
  if (args.plane === "discovery") {
    return runDiscoveryInboxAction(args);
  }

  switch (args.action) {
    case "resolve-issue":
      return resolveExecutionIssue({
        issue: args.issue,
        sourceContext: args.sourceContext,
        routeScope: args.routeScope,
        source: args.source,
      });
    case "approve":
      return approveExecutionApproval({
        approval: args.approval,
        sourceContext: args.sourceContext,
        routeScope: args.routeScope,
        source: args.source,
      });
    case "reject":
      return rejectExecutionApproval({
        approval: args.approval,
        sourceContext: args.sourceContext,
        routeScope: args.routeScope,
        source: args.source,
      });
    case "allow":
      return allowExecutionRuntime({
        runtime: args.runtime,
        sourceContext: args.sourceContext,
        routeScope: args.routeScope,
        source: args.source,
      });
    case "deny":
      return denyExecutionRuntime({
        runtime: args.runtime,
        sourceContext: args.sourceContext,
        routeScope: args.routeScope,
        source: args.source,
      });
  }
}
