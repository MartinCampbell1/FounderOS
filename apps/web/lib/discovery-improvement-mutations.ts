import {
  activateQuorumImprovementPromptProfile,
  runQuorumImprovementEvolution,
  runQuorumImprovementReflection,
  runQuorumImprovementSelfPlay,
  type QuorumImprovementEvolutionRequest,
  type QuorumImprovementEvolutionResult,
  type QuorumPromptEvolutionProfile,
  type QuorumPromptSelfPlayMatch,
  type QuorumReflectiveEvalReport,
  type QuorumImprovementSelfPlayRequest,
  type QuorumImprovementSessionReflectRequest,
} from "@founderos/api-clients";

import {
  buildDiscoveryImprovementProfileScopeHref,
  type ShellRouteScope,
} from "@/lib/route-scope";
import type { ShellMutationEffect } from "@/lib/shell-mutation-effects";
import type { ShellRouteMutationInvalidation } from "@/lib/use-shell-route-mutation";

export async function activateDiscoveryImprovementProfile(args: {
  profile: Pick<QuorumPromptEvolutionProfile, "profile_id" | "label">;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<ShellMutationEffect<{ profile: QuorumPromptEvolutionProfile }>> {
  const response = await activateQuorumImprovementPromptProfile(
    args.profile.profile_id
  );

  return {
    statusMessage: `Active prompt profile is now ${response.profile.label}.`,
    href: buildDiscoveryImprovementProfileScopeHref(
      response.profile.profile_id,
      args.routeScope
    ),
    navigation: "replace",
    refreshClient: true,
    invalidation: {
      planes: ["discovery"],
      scope: args.routeScope,
      source: args.source || "discovery-improvement",
      reason: "discovery-improvement-activate-profile",
    },
    data: {
      profile: response.profile,
    },
  };
}

function buildDiscoveryInvalidation(
  routeScope?: Partial<ShellRouteScope> | null,
  reason: string = "discovery-improvement-action",
  source: string = "discovery-improvement"
) {
  return {
    planes: ["discovery"],
    scope: routeScope,
    source,
    reason,
  } satisfies ShellRouteMutationInvalidation;
}

export async function runDiscoveryImprovementReflection(args: {
  request: QuorumImprovementSessionReflectRequest;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<ShellMutationEffect<{ reflection: QuorumReflectiveEvalReport }>> {
  const response = await runQuorumImprovementReflection(args.request);

  return {
    statusMessage: `Improvement reflection ${response.reflection.reflection_id} recorded.`,
    refreshClient: true,
    invalidation: buildDiscoveryInvalidation(
      args.routeScope,
      "discovery-improvement-reflect",
      args.source || "discovery-improvement"
    ),
    data: {
      reflection: response.reflection,
    },
  };
}

export async function runDiscoveryImprovementSelfPlay(args: {
  request: QuorumImprovementSelfPlayRequest;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<ShellMutationEffect<{ match: QuorumPromptSelfPlayMatch }>> {
  const response = await runQuorumImprovementSelfPlay(args.request);
  const targetProfileId =
    response.match.winner_profile_id ||
    args.request.left_profile_id ||
    args.request.right_profile_id ||
    null;

  return {
    statusMessage: `Self-play match ${response.match.match_id} completed.`,
    href: targetProfileId
      ? buildDiscoveryImprovementProfileScopeHref(targetProfileId, args.routeScope)
      : null,
    navigation: "replace",
    refreshClient: true,
    invalidation: buildDiscoveryInvalidation(
      args.routeScope,
      "discovery-improvement-self-play",
      args.source || "discovery-improvement"
    ),
    data: {
      match: response.match,
    },
  };
}

export async function runDiscoveryImprovementEvolution(args: {
  request: QuorumImprovementEvolutionRequest;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<ShellMutationEffect<{ result: QuorumImprovementEvolutionResult }>> {
  const response = await runQuorumImprovementEvolution(args.request);
  const targetProfileId =
    response.result.activated_profile_id ||
    response.result.generated_profiles[0]?.profile_id ||
    response.result.seed_profile.profile_id;

  return {
    statusMessage: `Evolution run generated ${response.result.generated_profiles.length} profile variants.`,
    href: targetProfileId
      ? buildDiscoveryImprovementProfileScopeHref(targetProfileId, args.routeScope)
      : null,
    navigation: "replace",
    refreshClient: true,
    invalidation: buildDiscoveryInvalidation(
      args.routeScope,
      "discovery-improvement-evolve",
      args.source || "discovery-improvement"
    ),
    data: {
      result: response.result,
    },
  };
}
