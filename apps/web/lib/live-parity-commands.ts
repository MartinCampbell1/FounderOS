import type { ShellWorkflowCommandRecord } from "@founderos/api-clients";

import {
  buildShellParityAuditScopeHref,
  normalizeShellRouteScope,
  normalizeShellSettingsParityTargets,
  type ShellRouteScope,
  type ShellSettingsParityTargets,
} from "@/lib/route-scope";

type LiveParityCommandOptions = {
  origin?: string | null;
  routeScope?: Partial<ShellRouteScope> | null;
  parityTargets?: Partial<ShellSettingsParityTargets> | null;
};

function quoteShellValue(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function buildParityEnvVars(args: {
  routeScope: ShellRouteScope;
  parityTargets: ShellSettingsParityTargets;
  includeAllowBlocked?: boolean;
  includeRequireCompleteChain?: boolean;
  includeRequireOperatorData?: boolean;
  includeRequireDiverseScenarios?: boolean;
  minCompleteChainCount?: number;
}) {
  const envs: string[] = [];

  if (args.includeAllowBlocked) {
    envs.push("FOUNDEROS_PARITY_ALLOW_BLOCKED=1");
  }
  if (args.includeRequireCompleteChain) {
    envs.push("FOUNDEROS_PARITY_REQUIRE_COMPLETE_CHAIN=1");
  }
  if (args.includeRequireOperatorData) {
    envs.push("FOUNDEROS_PARITY_REQUIRE_OPERATOR_DATA=1");
  }
  if (args.includeRequireDiverseScenarios) {
    envs.push("FOUNDEROS_PARITY_REQUIRE_DIVERSE_SCENARIOS=1");
  }
  if (
    Number.isInteger(args.minCompleteChainCount) &&
    (args.minCompleteChainCount ?? 0) > 0
  ) {
    envs.push(
      `FOUNDEROS_PARITY_MIN_COMPLETE_CHAIN_COUNT=${String(args.minCompleteChainCount)}`
    );
  }
  if (args.routeScope.projectId) {
    envs.push(
      `FOUNDEROS_PARITY_PROJECT_ID=${quoteShellValue(args.routeScope.projectId)}`
    );
  }
  if (args.routeScope.intakeSessionId) {
    envs.push(
      `FOUNDEROS_PARITY_INTAKE_SESSION_ID=${quoteShellValue(args.routeScope.intakeSessionId)}`
    );
  }
  if (args.parityTargets.discoverySessionId) {
    envs.push(
      `FOUNDEROS_PARITY_DISCOVERY_SESSION_ID=${quoteShellValue(args.parityTargets.discoverySessionId)}`
    );
  }
  if (args.parityTargets.discoveryIdeaId) {
    envs.push(
      `FOUNDEROS_PARITY_DISCOVERY_IDEA_ID=${quoteShellValue(args.parityTargets.discoveryIdeaId)}`
    );
  }

  return envs;
}

function buildScopeSummary(
  routeScope: ShellRouteScope,
  parityTargets: ShellSettingsParityTargets
) {
  const labels: string[] = [];

  if (routeScope.projectId) {
    labels.push(`project ${routeScope.projectId}`);
  }
  if (routeScope.intakeSessionId) {
    labels.push(`intake ${routeScope.intakeSessionId}`);
  }
  if (parityTargets.discoverySessionId) {
    labels.push(`session ${parityTargets.discoverySessionId}`);
  }
  if (parityTargets.discoveryIdeaId) {
    labels.push(`idea ${parityTargets.discoveryIdeaId}`);
  }

  return labels.length > 0 ? labels.join(" + ") : "global shell surfaces";
}

export function buildLiveParityWorkflowCommands({
  origin,
  routeScope,
  parityTargets,
}: LiveParityCommandOptions): ShellWorkflowCommandRecord[] {
  const normalizedRouteScope = normalizeShellRouteScope(routeScope);
  const normalizedParityTargets = normalizeShellSettingsParityTargets(parityTargets);
  const scopeSummary = buildScopeSummary(
    normalizedRouteScope,
    normalizedParityTargets
  );
  const parityPath = buildShellParityAuditScopeHref(
    normalizedRouteScope,
    normalizedParityTargets
  );
  const parityUrl = origin ? `${origin}${parityPath}` : parityPath;
  const blockedInspectPrefix = buildParityEnvVars({
    routeScope: normalizedRouteScope,
    parityTargets: normalizedParityTargets,
    includeAllowBlocked: true,
  });
  const actionPrefix = buildParityEnvVars({
    routeScope: normalizedRouteScope,
    parityTargets: normalizedParityTargets,
  });
  const playbookPrefix = buildParityEnvVars({
    routeScope: normalizedRouteScope,
    parityTargets: normalizedParityTargets,
  });
  const strictPrefix = buildParityEnvVars({
    routeScope: normalizedRouteScope,
    parityTargets: normalizedParityTargets,
  });
  const completeChainPrefix = buildParityEnvVars({
    routeScope: normalizedRouteScope,
    parityTargets: normalizedParityTargets,
    includeRequireCompleteChain: true,
  });
  const operatorRichPrefix = buildParityEnvVars({
    routeScope: normalizedRouteScope,
    parityTargets: normalizedParityTargets,
    includeRequireCompleteChain: true,
    includeRequireOperatorData: true,
  });
  const multiChainPrefix = buildParityEnvVars({
    routeScope: normalizedRouteScope,
    parityTargets: normalizedParityTargets,
    includeRequireCompleteChain: true,
    includeRequireOperatorData: true,
    minCompleteChainCount: 2,
  });
  const scenarioRichPrefix = buildParityEnvVars({
    routeScope: normalizedRouteScope,
    parityTargets: normalizedParityTargets,
    includeRequireCompleteChain: true,
    includeRequireOperatorData: true,
    includeRequireDiverseScenarios: true,
    minCompleteChainCount: 2,
  });

  return [
    {
      label: "Inspect current parity target",
      command: `${blockedInspectPrefix.join(" ")} npm run test:live-parity --workspace @founderos/web`.trim(),
      detail:
        `Runs the live parity harness for ${scopeSummary} and reports blocked upstream reads separately from real shell drift.`,
    },
    {
      label: "Fail on parity drift",
      command: `${strictPrefix.join(" ")} npm run test:live-parity --workspace @founderos/web`.trim(),
      detail:
        `Uses the same target context for ${scopeSummary}, but treats both blocked upstream reads and drift as failures so CI-style parity checks stay strict.`,
    },
    {
      label: "Require full linked chain",
      command: `${completeChainPrefix.join(" ")} npm run test:live-parity --workspace @founderos/web`.trim(),
      detail:
        `Requires one resolved target with project, intake, discovery session, and discovery idea all linked for ${scopeSummary}, and fails fast when auto-discovery only found a partial fallback.`,
    },
    {
      label: "Require operator-rich parity",
      command: `${operatorRichPrefix.join(" ")} npm run test:live-parity --workspace @founderos/web`.trim(),
      detail:
        `Requires the same full linked chain for ${scopeSummary}, plus non-empty execution issues, approvals, tool-permission prompts, and discovery review/operator surfaces so parity covers real operator queues instead of empty-state snapshots.`,
    },
    {
      label: "Require multi-chain parity",
      command: `${multiChainPrefix.join(" ")} npm run test:live-parity --workspace @founderos/web`.trim(),
      detail:
        `Raises the strictness for ${scopeSummary} so parity must find at least two complete linked chains in the live dataset, not just one golden path, while still requiring operator-rich discovery and execution queues.`,
    },
    {
      label: "Require scenario-rich parity",
      command: `${scenarioRichPrefix.join(" ")} npm run test:live-parity --workspace @founderos/web`.trim(),
      detail:
        `Requires the same multi-chain operator-rich coverage for ${scopeSummary}, plus scenario diversity so parity must see both clean idle chains and blocked paused chains with different founder/discovery states instead of duplicated golden paths.`,
    },
    {
      label: "Run scoped live review actions",
      command: `${actionPrefix.join(" ")} npm run test:live-review-actions --workspace @founderos/web`.trim(),
      detail:
        `Runs one deterministic discovery accept plus execution issue-resolve, approval-approve, and tool-permission-allow roundtrip for ${scopeSummary} through shell-owned write seams, then verifies the post-action shell reads reflect those state transitions.`,
    },
    {
      label: "Run scoped review playbook",
      command: `${playbookPrefix.join(" ")} FOUNDEROS_REVIEW_PRESET='chain-pass' npm run test:live-review-playbook --workspace @founderos/web`.trim(),
      detail:
        `Runs the full visible chain-pass triage for ${scopeSummary} through the same shell-owned review seams the unified \`/review\` preset runner uses, confirms discovery review decisions were written into the linked dossier, verifies execution review pressure dropped across review, inbox, dashboard, and portfolio, and leaves strict parity green after the playbook completes.`,
    },
    {
      label: "Fetch scoped parity JSON",
      command: `curl -sS ${quoteShellValue(parityUrl)}`,
      detail:
        "Reads the current `/api/shell/parity` payload directly for this scope so you can inspect drilldowns, sample ids, and mismatch details without launching the full UI flow.",
    },
  ];
}
