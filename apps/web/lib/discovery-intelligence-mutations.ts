import {
  runQuorumRepoDigestAnalysis,
  runQuorumRepoGraphAnalysis,
  type QuorumRepoDigestAnalyzeRequest,
  type QuorumRepoDigestResult,
  type QuorumRepoGraphAnalyzeRequest,
  type QuorumRepoGraphResult,
} from "@founderos/api-clients";

import { buildDiscoveryIntelligenceProfileScopeHref } from "@/lib/route-scope";
import type { ShellMutationEffect } from "@/lib/shell-mutation-effects";
import type { ShellRouteScope } from "@/lib/route-scope";
import type { ShellRouteMutationInvalidation } from "@/lib/use-shell-route-mutation";

function buildDiscoveryInvalidation(
  routeScope?: Partial<ShellRouteScope> | null,
  reason: string = "discovery-intelligence-action",
  source: string = "discovery-intelligence"
) {
  return {
    planes: ["discovery"],
    scope: routeScope,
    source,
    reason,
  } satisfies ShellRouteMutationInvalidation;
}

export async function runDiscoveryRepoDigest(args: {
  request: QuorumRepoDigestAnalyzeRequest;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<ShellMutationEffect<{ result: QuorumRepoDigestResult }>> {
  const result = await runQuorumRepoDigestAnalysis(args.request);
  return {
    statusMessage: result.cache_hit
      ? `Repo digest reused cache for ${result.profile.repo_name}.`
      : `Repo digest analyzed ${result.profile.repo_name}.`,
    href: buildDiscoveryIntelligenceProfileScopeHref(
      result.profile.profile_id,
      args.routeScope
    ),
    navigation: "replace",
    refreshClient: true,
    invalidation: buildDiscoveryInvalidation(
      args.routeScope,
      "discovery-intelligence-repo-digest",
      args.source || "discovery-intelligence"
    ),
    data: {
      result,
    },
  };
}

export async function runDiscoveryRepoGraph(args: {
  request: QuorumRepoGraphAnalyzeRequest;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<ShellMutationEffect<{ result: QuorumRepoGraphResult }>> {
  const result = await runQuorumRepoGraphAnalysis(args.request);
  const profileId = result.repo_dna_profile?.profile_id ?? null;

  return {
    statusMessage: result.cache_hit
      ? `Repo graph reused cache for ${result.repo_name}.`
      : `Repo graph analyzed ${result.repo_name}.`,
    href: profileId
      ? buildDiscoveryIntelligenceProfileScopeHref(profileId, args.routeScope)
      : null,
    navigation: "replace",
    refreshClient: true,
    invalidation: buildDiscoveryInvalidation(
      args.routeScope,
      "discovery-intelligence-repo-graph",
      args.source || "discovery-intelligence"
    ),
    data: {
      result,
    },
  };
}
