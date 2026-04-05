#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const quorumRoot = join(repoRoot, "quorum");
const autopilotRoot = join(repoRoot, "autopilot");
const webRoot = join(repoRoot, "apps", "web");
const contractPath = join(webRoot, "lib", "shell-browser-contract.json");
const contract = JSON.parse(readFileSync(contractPath, "utf8"));

const quorumBaseUrl = (process.env.QUORUM_API_BASE_URL || "").trim().replace(/\/$/, "");
const autopilotBaseUrl = (process.env.AUTOPILOT_API_BASE_URL || "")
  .trim()
  .replace(/\/$/, "");
const shellBaseUrl = (
  process.env.FOUNDEROS_PARITY_BASE_URL ||
  `http://${process.env.FOUNDEROS_WEB_HOST || "127.0.0.1"}:${process.env.FOUNDEROS_WEB_PORT || "3737"}`
)
  .trim()
  .replace(/\/$/, "");
const quorumPython = (process.env.QUORUM_PYTHON_BIN || "").trim() || "python3";
const autopilotPython = (process.env.AUTOPILOT_PYTHON_BIN || "").trim() || "python3";
const requestedChainCount = Number.parseInt(
  process.env.FOUNDEROS_PARITY_CHAIN_COUNT || "2",
  10
);
const chainCount =
  Number.isInteger(requestedChainCount) && requestedChainCount > 0
    ? requestedChainCount
    : 2;
const reviewSuiteMode =
  process.env.FOUNDEROS_REVIEW_SUITE_MODE === "1" ||
  process.env.FOUNDEROS_REVIEW_SUITE_MODE === "true";

if (!quorumBaseUrl || !autopilotBaseUrl || !shellBaseUrl) {
  console.error(
    "Missing QUORUM_API_BASE_URL, AUTOPILOT_API_BASE_URL, or FOUNDEROS_PARITY_BASE_URL for parity seeding."
  );
  process.exit(1);
}

if (reviewSuiteMode && chainCount < 4) {
  console.error(
    "FOUNDEROS_REVIEW_SUITE_MODE requires at least four linked chains."
  );
  process.exit(1);
}

const seedId = randomUUID().slice(0, 8);
const chainLabels = [
  "alpha",
  "beta",
  "gamma",
  "delta",
  "epsilon",
  "zeta",
  "eta",
  "theta",
];

const reviewSuiteScenarios = [
  {
    key: "idle-clean-committed",
    role: "clean-control",
    seedOperatorAttention: false,
    attentionSeedCount: 0,
    pauseProject: false,
    ideaSwipeState: "yes",
    validationState: "validated",
    evidenceAgeHours: 18,
  },
  {
    key: "paused-discovery-review",
    role: "discovery-pass",
    seedOperatorAttention: false,
    attentionSeedCount: 0,
    pauseProject: true,
    ideaSwipeState: "maybe",
    validationState: "reviewed",
    evidenceAgeHours: 6,
  },
  {
    key: "paused-attention-critical",
    role: "critical-pass",
    seedOperatorAttention: true,
    attentionSeedCount: 2,
    pauseProject: true,
    ideaSwipeState: "maybe",
    validationState: "reviewed",
    evidenceAgeHours: 5,
  },
  {
    key: "paused-attention-committed",
    role: "decision-pass",
    seedOperatorAttention: true,
    attentionSeedCount: 1,
    pauseProject: true,
    ideaSwipeState: "yes",
    validationState: "validated",
    evidenceAgeHours: 4,
  },
];

const extendedReviewSuiteScenarios = [
  {
    key: "idle-attention-review",
    seedOperatorAttention: true,
    attentionSeedCount: 1,
    pauseProject: false,
    ideaSwipeState: "maybe",
    validationState: "reviewed",
    evidenceAgeHours: 3,
  },
  {
    key: "paused-clean-committed",
    seedOperatorAttention: false,
    attentionSeedCount: 0,
    pauseProject: true,
    ideaSwipeState: "yes",
    validationState: "validated",
    evidenceAgeHours: 12,
  },
  {
    key: "idle-clean-review",
    seedOperatorAttention: false,
    attentionSeedCount: 0,
    pauseProject: false,
    ideaSwipeState: "maybe",
    validationState: "reviewed",
    evidenceAgeHours: 8,
  },
  {
    key: "paused-attention-review-heavy",
    seedOperatorAttention: true,
    attentionSeedCount: 3,
    pauseProject: true,
    ideaSwipeState: "maybe",
    validationState: "reviewed",
    evidenceAgeHours: 2,
  },
];

const DISCOVERY_ACTION_KIND_PRIORITY = [
  "handoff_review",
  "simulation_review",
  "debate_review",
  "idea_review",
  "refresh_review",
  "daily_digest",
];

function chainLabel(index) {
  return chainLabels[index] || `chain-${index + 1}`;
}

function buildChainScenario(index, total) {
  if (reviewSuiteMode) {
    const fixedScenario = reviewSuiteScenarios[index];
    if (fixedScenario) {
      return { ...fixedScenario };
    }

    const extendedScenario =
      extendedReviewSuiteScenarios[
        (index - reviewSuiteScenarios.length) % extendedReviewSuiteScenarios.length
      ] || extendedReviewSuiteScenarios[0];

    return {
      role: `extended-${index + 1}`,
      ...extendedScenario,
    };
  }

  const isPrimaryChain = index === total - 1;
  if (isPrimaryChain) {
    return {
      key: "paused-blocked-review",
      role: "primary",
      seedOperatorAttention: true,
      attentionSeedCount: 1,
      pauseProject: true,
      ideaSwipeState: "maybe",
      validationState: "reviewed",
      evidenceAgeHours: 6,
    };
  }

  return {
    key: "idle-clean-committed",
    role: "supporting",
    seedOperatorAttention: false,
    attentionSeedCount: 0,
    pauseProject: false,
    ideaSwipeState: index % 2 === 0 ? "yes" : "now",
    validationState: "validated",
    evidenceAgeHours: 18,
  };
}

function buildOperatorAttentionSeedKey(baseSeedKey, label) {
  return `${baseSeedKey}:action:${label}`;
}

function jsonHeaders() {
  return {
    "content-type": "application/json",
  };
}

function absoluteUrl(baseUrl, path) {
  return new URL(path.replace(/^\//, ""), `${baseUrl}/`).toString();
}

async function fetchJson(baseUrl, path, init = {}) {
  const response = await fetch(absoluteUrl(baseUrl, path), init);
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new Error(
      `Request failed for ${path}: ${response.status} ${response.statusText} ${typeof payload === "string" ? payload : JSON.stringify(payload)}`
    );
  }

  return payload;
}

function isRetriableShellReadError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("502 Bad Gateway") ||
    message.includes("operation was aborted due to timeout")
  );
}

async function fetchJsonWithRetry(baseUrl, path, init = {}, options = {}) {
  const attempts =
    Number.isInteger(options.attempts) && options.attempts > 0
      ? options.attempts
      : 4;
  const delayMs =
    Number.isInteger(options.delayMs) && options.delayMs > 0
      ? options.delayMs
      : 400;

  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await fetchJson(baseUrl, path, init);
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1 || !isRetriableShellReadError(error)) {
        throw error;
      }

      // Give shell-backed reads a moment to settle after the seed burst.
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolveDelay) =>
        setTimeout(resolveDelay, delayMs * (attempt + 1))
      );
    }
  }

  throw lastError;
}

function runJsonCommand({ command, args, cwd, env, label }) {
  return new Promise((resolveResult, rejectResult) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        ...env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.once("error", rejectResult);
    child.once("exit", (code, signal) => {
      if (signal) {
        rejectResult(new Error(`${label} exited from signal ${signal}`));
        return;
      }
      if ((code ?? 1) !== 0) {
        rejectResult(
          new Error(
            `${label} exited with code ${code ?? "unknown"}.\nstdout:\n${stdout}\nstderr:\n${stderr}`
          )
        );
        return;
      }

      try {
        resolveResult(JSON.parse(stdout.trim()));
      } catch (error) {
        rejectResult(
          new Error(
            `${label} returned invalid JSON.\nstdout:\n${stdout}\nstderr:\n${stderr}\nerror:${error instanceof Error ? error.message : String(error)}`
          )
        );
      }
    });
  });
}

function buildProjectPrd(projectName, ideaSummary) {
  return {
    title: projectName,
    description:
      "Synthetic project used to verify full linked-chain parity across the FounderOS unified shell.",
    phases: [
      {
        id: "phase-1",
        title: "Parity Validation",
        goal: "Prove one deterministic linked discovery and execution chain end-to-end.",
      },
    ],
    stories: [
      {
        id: 1,
        phase_id: "phase-1",
        phase_title: "Parity Validation",
        title: "Verify full linked-chain parity",
        description:
          "Keep one idea, discovery session, intake session, and execution project aligned across shell parity audits.",
        acceptance_criteria: [
          "Shell parity resolves one complete linked chain.",
          "The linked chain is visible without fallback target discovery.",
        ],
        blocked_by: [],
        tags: ["parity", "seed", "founderos"],
        role: "backend_worker",
        skill_packs: ["fastapi-backend"],
        connectors: ["shell_exec"],
        status: "open",
      },
    ],
  };
}

async function waitForResolvedMultiChain(expected) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 20000) {
    const snapshot = await fetchJson(shellBaseUrl, contract.liveRoutes.parityTargets);
    const routeScope = snapshot.routeScope || {};
    const parityTargets = snapshot.parityTargets || {};
    const coverage = snapshot.coverage || {};

    if (
      routeScope.projectId === expected.primary.projectId &&
      routeScope.intakeSessionId === expected.primary.intakeSessionId &&
      parityTargets.discoverySessionId === expected.primary.discoverySessionId &&
      parityTargets.discoveryIdeaId === expected.primary.discoveryIdeaId &&
      Number(coverage.completeLinkedChainCount || 0) >= expected.minCompleteChainCount &&
      coverage.chosenCandidateKind === "chain"
    ) {
      return snapshot;
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 400));
  }

  throw new Error(
    `Timed out waiting for shell parity targets to resolve ${expected.minCompleteChainCount} complete linked chains.`
  );
}

async function seedOperatorAttentionSet(projectId, seedKey) {
  return await runJsonCommand({
    label: "autopilot-operator-attention-seed",
    command: autopilotPython,
    args: [
      "scripts/seed_parity_operator_attention.py",
      "--project-id",
      projectId,
      "--seed-key",
      seedKey,
      "--story-id",
      "1",
    ],
    cwd: autopilotRoot,
    env: {
      AUTOPILOT_HOME: process.env.AUTOPILOT_HOME || "",
    },
  });
}

function selectDiscoveryActionTarget(items, primaryIdeaId) {
  const rankedItems = [...items].sort((left, right) => {
    const leftIdeaMatch = left.idea_id === primaryIdeaId ? 0 : 1;
    const rightIdeaMatch = right.idea_id === primaryIdeaId ? 0 : 1;
    if (leftIdeaMatch !== rightIdeaMatch) {
      return leftIdeaMatch - rightIdeaMatch;
    }

    const leftKind = DISCOVERY_ACTION_KIND_PRIORITY.indexOf(left.kind);
    const rightKind = DISCOVERY_ACTION_KIND_PRIORITY.indexOf(right.kind);
    const leftRank = leftKind >= 0 ? leftKind : DISCOVERY_ACTION_KIND_PRIORITY.length;
    const rightRank = rightKind >= 0 ? rightKind : DISCOVERY_ACTION_KIND_PRIORITY.length;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return String(left.item_id).localeCompare(String(right.item_id));
  });

  return (
    rankedItems.find(
      (item) =>
        item.status === "open" &&
        item.interrupt?.config?.allow_accept &&
        item.idea_id === primaryIdeaId
    ) ||
    rankedItems.find(
      (item) => item.status === "open" && item.interrupt?.config?.allow_accept
    ) ||
    null
  );
}

function buildSuiteExecutionTargets(operatorAttentionSeed) {
  if (!operatorAttentionSeed) {
    return null;
  }

  return {
    issue: {
      issueId: operatorAttentionSeed.issue_id,
      projectId: operatorAttentionSeed.project_id,
      seedKey: operatorAttentionSeed.seed_key,
    },
    approval: {
      approvalId: operatorAttentionSeed.approval_id,
      projectId: operatorAttentionSeed.project_id,
      seedKey: operatorAttentionSeed.seed_key,
    },
    runtime: {
      runtimeId: operatorAttentionSeed.approval_runtime_id,
      projectId: operatorAttentionSeed.project_id,
      seedKey: operatorAttentionSeed.seed_key,
    },
  };
}

function buildPresetTarget(args) {
  if (!args.chain) {
    return null;
  }

  return {
    role: args.chain.role,
    scenario: args.chain.scenario,
    routeScope: {
      projectId: args.chain.projectId,
      intakeSessionId: args.chain.intakeSessionId,
    },
    parityTargets: {
      discoverySessionId: args.chain.discoverySessionId,
      discoveryIdeaId: args.chain.ideaId,
    },
    actionTargets: {
      discovery: args.discoveryActionTarget
        ? {
            itemId: args.discoveryActionTarget.item_id,
            ideaId: args.discoveryActionTarget.idea_id || "",
            kind: args.discoveryActionTarget.kind,
            status: args.discoveryActionTarget.status,
          }
        : null,
      execution: buildSuiteExecutionTargets(args.chain.operatorAttentionSeed),
    },
  };
}

async function seedLinkedChain(index) {
  const label = chainLabel(index);
  const scenario = buildChainScenario(index, chainCount);
  const paritySeedKey = `parity-seed:${seedId}:${label}`;
  const projectName = `FounderOS parity linked chain ${seedId} ${label}`;
  const ideaTitle = projectName;
  const ideaSummary =
    `Validate deterministic linked discovery and execution chain ${label} for FounderOS live parity ${seedId}.`;
  const sharedKeywords = [
    "FounderOS",
    "parity",
    "linked",
    "chain",
    "discovery",
    "execution",
    "intake",
    "project",
    seedId,
    label,
  ];
  const sessionTask = `${projectName} ${label} discovery execution intake project parity validation`;
  const intakeSessionId = `intake_${seedId}_${label}`;

  const idea = await fetchJson(quorumBaseUrl, "/orchestrate/discovery/ideas", {
    method: "POST",
    headers: jsonHeaders(),
      body: JSON.stringify({
        title: ideaTitle,
        summary: ideaSummary,
        source: "parity_seed",
        topic_tags: sharedKeywords.map((keyword) => keyword.toLowerCase()),
    }),
  });

  const ideaId = String(idea.idea_id || "").trim();
  if (!ideaId) {
    throw new Error("Discovery seed did not return idea_id.");
  }

  await fetchJson(
    quorumBaseUrl,
    `/orchestrate/discovery/ideas/${encodeURIComponent(ideaId)}/observations`,
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        source: "parity_seed",
        entity: "founderos",
        url: "https://example.com/founderos-parity-seed",
        raw_text: `${ideaSummary} This seed links discovery session, intake session, and execution project.`,
        topic_tags: sharedKeywords.map((keyword) => keyword.toLowerCase()),
        pain_score: 0.88,
        trend_score: 0.72,
        evidence_confidence: "high",
      }),
    }
  );

  await fetchJson(
    quorumBaseUrl,
    `/orchestrate/discovery/ideas/${encodeURIComponent(ideaId)}/validation-reports`,
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        summary:
          "This synthetic chain is intentionally narrow so live parity can verify one fully linked path without external provider dependencies.",
        verdict: "pass",
        findings: [
          "Discovery and execution ids should stay linked.",
          "Parity should not need partial fallback target discovery.",
        ],
        confidence: "high",
      }),
    }
  );

  const brief = await fetchJson(
    quorumBaseUrl,
    `/orchestrate/discovery/ideas/${encodeURIComponent(ideaId)}/execution-brief-candidate`,
    {
      method: "PUT",
      headers: jsonHeaders(),
      body: JSON.stringify({
        title: `${projectName} MVP`,
        prd_summary:
          "Create one deterministic full linked-chain parity scenario for the FounderOS unified shell.",
        acceptance_criteria: [
          "One discovery idea links to one execution project through brief_id.",
          "One intake session links to the same execution project.",
          "One discovery session is trace-linked to the same idea.",
        ],
        recommended_tech_stack: ["FastAPI", "SQLite", "Next.js"],
        confidence: "high",
        effort: "small",
        urgency: "this_week",
        budget_tier: "low",
      }),
    }
  );

  const briefId = String(brief.brief_id || "").trim();
  if (!briefId) {
    throw new Error("Discovery seed did not return brief_id.");
  }

  await fetchJson(
    quorumBaseUrl,
    `/orchestrate/discovery/ideas/${encodeURIComponent(ideaId)}/simulation`,
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        persona_count: 12,
        max_rounds: 3,
      }),
    }
  );

  await fetchJson(
    quorumBaseUrl,
    `/orchestrate/discovery/ideas/${encodeURIComponent(ideaId)}/simulation/lab`,
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        population_size: 60,
        round_count: 3,
        competition_pressure: 0.33,
        network_density: 0.42,
      }),
    }
  );

  await fetchJson(
    quorumBaseUrl,
    `/orchestrate/discovery/ideas/${encodeURIComponent(ideaId)}`,
    {
      method: "PATCH",
      headers: jsonHeaders(),
      body: JSON.stringify({
        last_evidence_refresh_at: new Date(
          Date.now() - scenario.evidenceAgeHours * 60 * 60 * 1000
        ).toISOString(),
        swipe_state: scenario.ideaSwipeState,
        validation_state: scenario.validationState,
      }),
    }
  );

  const intakeSeed = await runJsonCommand({
    label: "autopilot-intake-seed",
    command: autopilotPython,
    args: [
      "scripts/seed_parity_intake_session.py",
      "--session-id",
      intakeSessionId,
      "--title",
      projectName,
      "--summary",
      ideaSummary,
      "--user-message",
      `Create ${projectName} so FounderOS can verify one full linked-chain parity path.`,
      "--assistant-message",
      "Synthetic intake session seeded for live parity.",
    ],
    cwd: autopilotRoot,
    env: {
      AUTOPILOT_HOME: process.env.AUTOPILOT_HOME || "",
    },
  });

  const project = await fetchJson(autopilotBaseUrl, "/projects/", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({
      prd: buildProjectPrd(projectName, ideaSummary),
      project_name: projectName,
      priority: "normal",
      intake_session_id: intakeSeed.session_id,
      task_source: {
        source_kind: "execution_brief",
        external_id: briefId,
        repo: "",
        branch_policy: "isolated_worktree",
        brief_ref: ".agents/tasks/prd.json",
      },
    }),
  });

  const projectId = String(project.project_id || "").trim();
  if (!projectId) {
    throw new Error("Autopilot seed did not return project_id.");
  }

  const operatorAttentionSeeds = [];
  if (scenario.seedOperatorAttention) {
    const attentionSeedCount =
      Number.isInteger(scenario.attentionSeedCount) &&
      scenario.attentionSeedCount > 0
        ? scenario.attentionSeedCount
        : 1;

    for (let index = 0; index < attentionSeedCount; index += 1) {
      const attentionSeedKey =
        index === 0
          ? paritySeedKey
          : buildOperatorAttentionSeedKey(paritySeedKey, `suite-${index + 1}`);
      operatorAttentionSeeds.push(
        await seedOperatorAttentionSet(projectId, attentionSeedKey)
      );
    }
  }
  const operatorAttentionSeed = operatorAttentionSeeds[0] ?? null;

  if (scenario.pauseProject) {
    await fetchJson(autopilotBaseUrl, `/projects/${encodeURIComponent(projectId)}/pause`, {
      method: "POST",
      headers: jsonHeaders(),
    });
  }

  const discoverySession = await runJsonCommand({
    label: "quorum-session-seed",
    command: quorumPython,
    args: [
      "scripts/seed_parity_session.py",
      "--task",
      sessionTask,
      "--user-message",
      `Evaluate ${projectName} across discovery, intake, project, and parity surfaces.`,
      "--assistant-message",
      "Synthetic discovery session seeded for live parity.",
    ],
    cwd: quorumRoot,
    env: {
      MULTI_AGENT_STATE_DB: process.env.MULTI_AGENT_STATE_DB || "",
    },
  });

  return {
    label,
    scenario: scenario.key,
    role: scenario.role,
    paritySeedKey,
    ideaId,
    briefId,
    projectId,
    intakeSessionId: intakeSeed.session_id,
    discoverySessionId: discoverySession.session_id,
    operatorAttentionSeed,
    operatorAttentionSeeds,
  };
}

async function main() {
  const chains = [];
  for (let index = 0; index < chainCount; index += 1) {
    chains.push(await seedLinkedChain(index));
  }

  for (const routineKind of ["hourly_refresh", "daily_digest", "overnight_queue"]) {
    await fetchJson(quorumBaseUrl, "/orchestrate/discovery/daemon/control", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        action: "run_routine",
        routine_kind: routineKind,
      }),
    });
  }

  const primaryChain = chains[chains.length - 1] ?? chains[0];
  const resolvedTargets = await waitForResolvedMultiChain({
    primary: {
      projectId: primaryChain.projectId,
      intakeSessionId: primaryChain.intakeSessionId,
      discoverySessionId: primaryChain.discoverySessionId,
      discoveryIdeaId: primaryChain.ideaId,
    },
    minCompleteChainCount: chainCount,
  });

  const executionActionSeeds =
    primaryChain && primaryChain.projectId
      ? {
          issue: await seedOperatorAttentionSet(
            primaryChain.projectId,
            buildOperatorAttentionSeedKey(primaryChain.paritySeedKey, "issue")
          ),
          approval: await seedOperatorAttentionSet(
            primaryChain.projectId,
            buildOperatorAttentionSeedKey(primaryChain.paritySeedKey, "approval")
          ),
          runtime: await seedOperatorAttentionSet(
            primaryChain.projectId,
            buildOperatorAttentionSeedKey(primaryChain.paritySeedKey, "runtime")
          ),
        }
      : null;

  const discoveryInbox = await fetchJsonWithRetry(
    shellBaseUrl,
    "/api/shell/discovery/inbox?limit=200&status=open"
  );
  const discoveryActionTarget = selectDiscoveryActionTarget(
    Array.isArray(discoveryInbox.items) ? discoveryInbox.items : [],
    primaryChain.ideaId
  );
  const presetTargets = reviewSuiteMode
    ? {
        "discovery-pass": buildPresetTarget({
          chain: chains.find((chain) => chain.role === "discovery-pass") ?? null,
          discoveryActionTarget: selectDiscoveryActionTarget(
            Array.isArray(discoveryInbox.items) ? discoveryInbox.items : [],
            chains.find((chain) => chain.role === "discovery-pass")?.ideaId || ""
          ),
        }),
        "critical-pass": buildPresetTarget({
          chain: chains.find((chain) => chain.role === "critical-pass") ?? null,
          discoveryActionTarget: null,
        }),
        "decision-pass": buildPresetTarget({
          chain: chains.find((chain) => chain.role === "decision-pass") ?? null,
          discoveryActionTarget: null,
        }),
      }
    : null;

  console.log(
    JSON.stringify({
      status: "ok",
      seedId,
      chainCount,
      chains,
      coverage: resolvedTargets.coverage,
      routeScope: resolvedTargets.routeScope,
      parityTargets: resolvedTargets.parityTargets,
      presetTargets,
      actionTargets: {
        discovery: discoveryActionTarget
          ? {
              itemId: discoveryActionTarget.item_id,
              ideaId: discoveryActionTarget.idea_id || "",
              kind: discoveryActionTarget.kind,
              status: discoveryActionTarget.status,
            }
          : null,
        execution: executionActionSeeds
          ? {
              issue: {
                issueId: executionActionSeeds.issue.issue_id,
                projectId: executionActionSeeds.issue.project_id,
                seedKey: executionActionSeeds.issue.seed_key,
              },
              approval: {
                approvalId: executionActionSeeds.approval.approval_id,
                projectId: executionActionSeeds.approval.project_id,
                seedKey: executionActionSeeds.approval.seed_key,
              },
              runtime: {
                runtimeId: executionActionSeeds.runtime.approval_runtime_id,
                projectId: executionActionSeeds.runtime.project_id,
                seedKey: executionActionSeeds.runtime.seed_key,
              },
            }
          : null,
      },
    })
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
