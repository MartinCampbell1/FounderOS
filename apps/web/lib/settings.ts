import type {
  ShellOperatorPreferencesSnapshot,
  ShellSettingsSnapshot,
} from "@founderos/api-clients";
import { resolveFounderOSShellConfig } from "@founderos/config";

import { getShellNamespaceForUpstream } from "@/lib/gateway-contract";
import {
  buildShellOperatorPreferencesSnapshot,
  DEFAULT_SHELL_PREFERENCES,
} from "@/lib/shell-preferences-contract";

function buildUpstreamHealthUrl(baseUrl: string) {
  return new URL("health", `${baseUrl}/`).toString();
}

export function buildShellSettingsSnapshot(
  operatorControls: ShellOperatorPreferencesSnapshot = buildShellOperatorPreferencesSnapshot(
    DEFAULT_SHELL_PREFERENCES,
    "default"
  )
): ShellSettingsSnapshot {
  const resolvedConfig = resolveFounderOSShellConfig(process.env);
  const quorum = resolvedConfig.upstreams.quorum;
  const autopilot = resolvedConfig.upstreams.autopilot;

  return {
    generatedAt: new Date().toISOString(),
    operatorControls,
    runtime: resolvedConfig.runtime,
    upstreams: [
      {
        ...quorum,
        shellNamespace: getShellNamespaceForUpstream("quorum"),
        healthUrl: buildUpstreamHealthUrl(quorum.baseUrl),
      },
      {
        ...autopilot,
        shellNamespace: getShellNamespaceForUpstream("autopilot"),
        healthUrl: buildUpstreamHealthUrl(autopilot.baseUrl),
      },
    ],
    validation: {
      status: resolvedConfig.issues.length > 0 ? "warning" : "ok",
      issues: resolvedConfig.issues,
    },
    gatewayRoutes: [
      {
        route: "/api/shell/runtime",
        method: "GET",
        owner: "apps/web",
        purpose:
          "Shell-owned runtime snapshot for shell chrome, settings refresh, and browser-facing control-plane diagnostics.",
        upstream: "shell",
      },
      {
        route: "/api/shell/contract",
        method: "GET",
        owner: "apps/web",
        purpose:
          "Shell-owned contract audit snapshot covering key live shell seams, degraded upstream-read paths, and deprecated browser-route redirects.",
        upstream: "shell",
      },
      {
        route: "/api/shell/parity",
        method: "GET",
        owner: "apps/web",
        purpose:
          "Shell-owned parity audit snapshot comparing key shell snapshots and composite shell surfaces with direct upstream reads, route-level sample ids, filtered execution review collections, and scope-aware detail drilldowns when Quorum and Autopilot are reachable.",
        upstream: "shell",
      },
      {
        route: "/api/shell/parity-targets",
        method: "GET",
        owner: "apps/web",
        purpose:
          "Shell-owned live target resolver for scoped parity, returning the current execution project/intake pair plus discovery session and idea ids that can seed route-level parity checks.",
        upstream: "shell",
      },
      {
        route: "/api/shell/operator-preferences",
        method: "GET/PUT",
        owner: "apps/web",
        purpose: "Cookie-backed shell operator controls for refresh cadence and sidebar state.",
        upstream: "shell",
      },
      {
        route: "/api/shell/dashboard",
        method: "GET",
        owner: "apps/web",
        purpose: "Shell-owned dashboard snapshot for client refresh and polling.",
        upstream: "shell",
      },
      {
        route: "/api/shell/review",
        method: "GET",
        owner: "apps/web",
        purpose:
          "Shell-owned unified review snapshot that composes discovery review and execution review into one cross-plane operator route.",
        upstream: "shell",
      },
      {
        route: "/api/shell/inbox",
        method: "GET",
        owner: "apps/web",
        purpose: "Shell-owned inbox snapshot for client refresh and polling.",
        upstream: "shell",
      },
      {
        route: "/api/shell/portfolio",
        method: "GET",
        owner: "apps/web",
        purpose: "Shell-owned portfolio snapshot for client refresh and polling.",
        upstream: "shell",
      },
      {
        route: "/api/shell/discovery/sessions",
        method: "GET",
        owner: "apps/web",
        purpose: "Shell-owned discovery session list/detail snapshot for client refresh and polling.",
        upstream: "shell",
      },
      {
        route: "/api/shell/discovery/ideas",
        method: "GET",
        owner: "apps/web",
        purpose: "Shell-owned discovery idea list/dossier snapshot for client refresh and polling.",
        upstream: "shell",
      },
      {
        route: "/api/shell/discovery/authoring",
        method: "GET",
        owner: "apps/web",
        purpose:
          "Shell-owned discovery authoring queue snapshot covering dossier coverage gaps, chain-linked readiness, and authoring backlog review.",
        upstream: "shell",
      },
      {
        route: "/api/shell/discovery/review",
        method: "GET",
        owner: "apps/web",
        purpose:
          "Shell-owned discovery review snapshot covering authoring gaps, trace activity, replay-linked context, handoff readiness, and operator review actions on one route-owned surface.",
        upstream: "shell",
      },
      {
        route: "/api/shell/discovery/board",
        method: "GET",
        owner: "apps/web",
        purpose:
          "Shell-owned FounderOS board snapshot covering discovery scoreboard, ranking, swipe queue, and simulation lane.",
        upstream: "shell",
      },
      {
        route: "/api/shell/discovery/board/ranking",
        method: "GET",
        owner: "apps/web",
        purpose:
          "Shell-owned ranking detail snapshot covering leaderboard, adaptive next pair, and archive history.",
        upstream: "shell",
      },
      {
        route: "/api/shell/discovery/board/archive",
        method: "GET",
        owner: "apps/web",
        purpose:
          "Shell-owned archive frontier snapshot covering archive checkpoints, occupied niches, prompt evolution, and archive candidates.",
        upstream: "shell",
      },
      {
        route: "/api/shell/discovery/board/finals",
        method: "GET",
        owner: "apps/web",
        purpose:
          "Shell-owned finals preparation snapshot covering ranking finalists, archive context, and finals candidate review.",
        upstream: "shell",
      },
      {
        route: "/api/shell/discovery/board/simulations",
        method: "GET",
        owner: "apps/web",
        purpose:
          "Shell-owned simulation review snapshot covering discovery candidates plus persona and market lab reports.",
        upstream: "shell",
      },
      {
        route: "/api/shell/discovery/traces",
        method: "GET",
        owner: "apps/web",
        purpose:
          "Shell-owned discovery observability snapshot covering scoreboards, recent traces, and idea-level trace detail.",
        upstream: "shell",
      },
      {
        route: "/api/shell/discovery/replays",
        method: "GET",
        owner: "apps/web",
        purpose:
          "Shell-owned discovery replay snapshot covering recent sessions and debate replay detail.",
        upstream: "shell",
      },
      {
        route: "/api/shell/discovery/inbox",
        method: "GET",
        owner: "apps/web",
        purpose: "Shell-owned discovery inbox feed seam for typed browser clients that still need raw review records.",
        upstream: "shell",
      },
      {
        route: "/api/shell/discovery/events/[sessionId]",
        method: "GET",
        owner: "apps/web",
        purpose: "Shell-owned SSE seam for discovery session events.",
        upstream: "shell",
      },
      {
        route: "/api/shell/discovery/actions/*",
        method: "ANY",
        owner: "apps/web",
        purpose:
          "Shell-owned discovery mutation seam for session control, review actions, execution-brief export, and adjacent action flows.",
        upstream: "shell",
      },
      {
        route: "/api/shell/execution/workspace",
        method: "GET",
        owner: "apps/web",
        purpose: "Shell-owned execution project list/detail snapshot for client refresh and polling.",
        upstream: "shell",
      },
      {
        route: "/api/shell/execution/intake",
        method: "GET",
        owner: "apps/web",
        purpose: "Shell-owned execution intake snapshot for client refresh and resume flows.",
        upstream: "shell",
      },
      {
        route: "/api/shell/execution/handoffs/[handoffId]",
        method: "GET",
        owner: "apps/web",
        purpose: "Shell-owned execution handoff snapshot for client refresh and launch preset hydration.",
        upstream: "shell",
      },
      {
        route: "/api/shell/execution/attention",
        method: "GET",
        owner: "apps/web",
        purpose:
          "Shell-owned execution attention seam for issues, approvals, and tool-permission runtimes.",
        upstream: "shell",
      },
      {
        route: "/api/shell/execution/review",
        method: "GET",
        owner: "apps/web",
        purpose:
          "Shell-owned execution review snapshot covering issues, approvals, tool-permission prompts, and chain-aware operator actions on one route-owned surface.",
        upstream: "shell",
      },
      {
        route: "/api/shell/execution/actions/*",
        method: "ANY",
        owner: "apps/web",
        purpose:
          "Shell-owned execution mutation seam for intake, project lifecycle, approvals, tool permissions, and adjacent control-plane actions.",
        upstream: "shell",
      },
      {
        route: "/api/shell/handoffs/execution-brief/*",
        method: "GET/POST",
        owner: "apps/web",
        purpose: "Shell-owned discovery to execution handoff store.",
        upstream: "shell",
      },
    ],
    shellContracts: [
      {
        label: "Route ownership",
        owner: "apps/web",
        detail: "App Router owns shell routes, layout, gateway routes, and shell-native composites.",
      },
      {
        label: "Browser fetch layer",
        owner: "packages/api-clients",
        detail:
          "Typed browser-facing fetch helpers now sit above shell-owned snapshot and action routes instead of binding the browser to internal upstream proxy paths.",
      },
      {
        label: "Visual primitives",
        owner: "packages/ui",
        detail: "Shared cards, badges, buttons, theme provider, and shell styling live here.",
      },
      {
        label: "Backend source of truth",
        owner: "quorum/ + autopilot/",
        detail: "Both upstream applications still own their backend semantics and remain intact behind the gateway.",
      },
    ],
    migrationStatus: [
      {
        key: "dashboard-overview",
        label: "Cross-plane dashboard",
        status: "live",
        href: "/dashboard",
        detail:
          "Shell-native overview now server-primes gateway health, discovery activity, execution load, attention state, a normalized chain graph, and a shell-owned review-center snapshot before client polling resumes through `/api/shell/dashboard`, with a dedicated cross-plane review-pressure panel that exposes unified lane links, hotspot chains, and direct batch triage actions on top of the existing discovery pulse, scoped discovery attention, authoring-readiness gaps, and execution review triage cards.",
      },
      {
        key: "discovery-routes",
        label: "Discovery sessions and dossiers",
        status: "live",
        href: "/discovery",
        detail:
          "Session monitor, reconnecting SSE overlay, inbox, and idea dossier routes now run through shell-owned URLs and clients, with list/detail discovery snapshots unified behind the shell server path, discovery session and idea entry surfaces both exposing chain-linked summary cards and chain loader warnings, idea routes carrying linked execution-chain context from the normalized chain graph, discovery-side invalidations targeted by session and idea resource where available, discovery session controls and inbox review actions sharing one discovery action dispatcher, shared derived state helpers, and the shared UI mutation runner, reads and mutations routed through `/api/shell/discovery/*`, cookie-backed operator preferences now server-seeding remembered review defaults on `/discovery/sessions/[sessionId]` and `/discovery/ideas/[ideaId]`, and execution-chain scope preserved through discovery lists, monitors, and cross-plane returns.",
      },
      {
        key: "discovery-board",
        label: "FounderOS discovery board",
        status: "live",
        href: "/discovery/board",
        detail:
          "The old FounderOS board container is now replaced by a shell-native route with a server-seeded first snapshot, same-origin refresh through `/api/shell/discovery/board`, and shared discovery mutation semantics for ranking compare and swipe queue actions, while board links preserve execution-chain scope back into dossiers, dashboard, inbox, and portfolio.",
      },
      {
        key: "discovery-board-details",
        label: "Ranking, archive, finals, and simulation detail routes",
        status: "live",
        href: "/discovery/board/ranking",
        detail:
          "Ranking detail, archive frontier, finals resolution, and simulation review now live as dedicated shell-native routes, with first-render snapshots from `/api/shell/discovery/board/ranking`, `/api/shell/discovery/board/archive`, `/api/shell/discovery/board/finals`, and `/api/shell/discovery/board/simulations`, shared discovery mutation effects for compare, archive, finals, and simulation runs, direct authoring-route links from deep analysis surfaces, cookie-backed operator preferences now server-seeding remembered review links on the board detail family before hydration, and route-owned scope preserved into dossier, authoring, dashboard, inbox, and portfolio returns.",
      },
      {
        key: "discovery-history",
        label: "Trace and replay history routes",
        status: "live",
        href: "/discovery/traces",
        detail:
          "Discovery observability and debate replay now live as shell-native history routes, with first-render snapshots from `/api/shell/discovery/traces` and `/api/shell/discovery/replays`, idea-level trace detail and session replay detail both route-addressable, cookie-backed operator preferences now server-seeding remembered review links on `/discovery/traces/[ideaId]` and `/discovery/replays/[sessionId]`, direct authoring-route links from idea trace detail, and route-owned scope preserved while moving back into sessions, dossiers, authoring, dashboard, and inbox.",
      },
      {
        key: "discovery-authoring",
        label: "Discovery dossier authoring route",
        status: "live",
        href: "/discovery/ideas",
        detail:
          "Idea-level authoring now lives at `/discovery/ideas/[ideaId]/authoring`, reusing the shell-seeded dossier snapshot from `/api/shell/discovery/ideas` and the existing discovery action seam for evidence, validation, decision, and timeline writes, with resource-aware invalidation on `discoveryIdeaId`, a shared authoring-readiness summary folded into linked chain records, cookie-backed operator preferences now server-seeding remembered review links on the authoring detail route before hydration, and execution-chain scope preserved on return into dashboard, inbox, portfolio, discovery board details, traces, and execution-linked routes.",
      },
      {
        key: "discovery-authoring-queue",
        label: "Discovery authoring queue",
        status: "live",
        href: "/discovery/authoring",
        detail:
          "A dedicated shell-native queue now surfaces dossier authoring coverage gaps at `/discovery/authoring`, server-seeded from `/api/shell/discovery/authoring`, reusing the same discovery source of truth and normalized chain graph as dashboard, portfolio, and inbox, while preserving execution-chain scope on returns into dossier detail, authoring detail, inbox, portfolio, dashboard, and execution-linked routes.",
      },
      {
        key: "review-center",
        label: "Unified review center",
        status: "live",
        href: "/review",
        detail:
          "A new shell-native `/review` route now composes discovery review and execution review into one scoped operator surface, server-seeded from `/api/shell/review`, with route-owned lane links through `?lane=...`, route-owned playbooks through `?preset=...`, inline confirm/reopen/handoff and resolve/approve/reject/allow/deny quick actions, visible-card batch triage, preset-driven operator passes for discovery, critical issues, decision gates, and full chain review, plus remembered operator defaults per chain type through the cookie-backed shell preference snapshot, all reusing the existing shell mutation pipelines while still deep-linking back into the plane-specific `/discovery/review` and `/execution/review` queues instead of flattening their semantics.",
      },
      {
        key: "discovery-review-queue",
        label: "Discovery review queue",
        status: "live",
        href: "/discovery/review",
        detail:
          "A dedicated shell-native review lane now surfaces authoring gaps, trace signals, replay-linked context, and handoff readiness at `/discovery/review`, server-seeded from `/api/shell/discovery/review`, with route-owned filters through `?filter=...`, per-record confirm/reopen and handoff actions, plus visible-card batch confirm/reopen triage for discovery review records, all writing back through the existing discovery decision and timeline seams while preserving scoped returns into the unified `/review` center as well as traces, replays, dossier authoring, dashboard, inbox, and execution-linked routes.",
      },
      {
        key: "execution-routes",
        label: "Execution workspace and intake",
        status: "live",
        href: "/execution",
        detail:
          "Project list, project workspace, intake, brief handoff, execution attention seams, and the new execution review lane now run through the shell gateway, with route-owned scope preserved across list, detail, intake, handoff, and review surfaces, execution lifecycle/intake/handoff/review/inbox actions sharing one helper-driven mutation contract, one shared UI mutation runner, shared local reconciliation for intake session and handoff project state, filter-aware triage links for `issues`, `decisions`, and `runtimes`, cookie-backed operator preferences now server-seeding remembered execution and unified review entry links on project, intake, and handoff detail routes, `/execution` resolving the active scoped project on the server instead of client auto-jumping after hydration, and both refresh and control mutations re-entering through `/api/shell/execution/*` before control returns to dashboard, portfolio, inbox, or settings.",
      },
      {
        key: "execution-review-queue",
        label: "Execution review queue",
        status: "live",
        href: "/execution/review",
        detail:
          "A dedicated shell-native operator lane now surfaces execution issues, approvals, and tool-permission prompts at `/execution/review`, server-seeded from `/api/shell/execution/review`, with route-owned filters through `?filter=...`, per-record resolve, approve, reject, allow, and deny actions, plus visible-card batch triage for issue resolution and approval/runtime decisions, all staying on the same shell-owned mutation pipeline as inbox and project routes while preserving chain-aware returns into execution, `/review`, dashboard, inbox, portfolio, and settings.",
      },
      {
        key: "portfolio-links",
        label: "Portfolio linking",
        status: "live",
        href: "/portfolio",
        detail:
          "Cross-plane links now trace a normalized chain graph `idea -> brief -> intake -> project -> attention -> outcome`, with a server-seeded first portfolio snapshot, route-owned execution-chain scope, same-origin client refresh through `/api/shell/portfolio`, discovery authoring-readiness visible directly on linked chain cards, direct scoped `/settings` jumps from portfolio chain cards into parity/debug context, and a shared review-pressure layer that now reuses the shell review-center snapshot to expose unified lane links, hotspot chains, and direct batch triage actions instead of only per-card execution blocker badges.",
      },
      {
        key: "inbox-queue",
        label: "Unified inbox",
        status: "live",
        href: "/inbox",
        detail:
          "Discovery inbox items, execution issues, approvals, and tool-permission prompts share one shell queue, with first-render data seeded from the shell server path, subsequent refresh handled through `/api/shell/inbox`, execution provenance now resolved through the same normalized chain graph used by dashboard and portfolio, discovery attention items able to inherit execution-chain scope when their idea is already linked, authoring-readiness surfaced on chain-linked discovery cards with direct jumps into `/discovery/ideas/[ideaId]/authoring`, cross-plane attention actions dispatched through one shell-level action model instead of screen-local per-plane handlers, and direct scoped returns into the new unified `/review` center.",
      },
      {
        key: "settings-surface",
        label: "Shell settings surface",
        status: "live",
        href: "/settings",
        detail:
          "Settings now expose runtime config, shell route families, migration coverage, and a server-seeded shell runtime snapshot through `/api/shell/runtime`, while the older `/api/settings` and `/api/health` fragments now return `410 Gone` and point callers back to the shell-owned runtime contract, with route-owned scope links still preserving execution-chain context into dashboard and inbox.",
      },
      {
        key: "env-validation",
        label: "Env validation package",
        status: "live",
        href: "/settings",
        detail: "Shared config resolution now lives in `packages/config` with fallback validation for host, port, and upstream URLs.",
      },
      {
        key: "control-plane-settings",
        label: "Persistent operator controls",
        status: "live",
        href: "/settings",
        detail:
          "Shell-owned operator controls now sync refresh profile and desktop sidebar behavior through a cookie-backed same-origin route and pre-hydration shell bootstrap.",
      },
    ],
    developerWorkflow: {
      workspace: "/Users/martin/FounderOS",
      commands: [
        {
          label: "Run the shell",
          command: "npm run start --workspace @founderos/web",
          detail: "Starts the production shell on the configured host and port.",
        },
        {
          label: "Validate the shell",
          command: "npm run typecheck && npm run lint && npm run build",
          detail: "Current minimum verification loop before route-level runtime checks.",
        },
        {
          label: "Start unified local stack",
          command: "npm run dev:stack",
          detail:
            "Starts Quorum, Autopilot, and the unified shell together, waits for upstream health plus `/api/shell/runtime`, then keeps the full local stack attached under one bootstrap command.",
        },
        {
          label: "Serve unified local stack",
          command: "npm run serve:stack",
          detail:
            "Boots the production-style local stack, auto-building the shell when needed, auto-selecting free shell and upstream ports when the defaults are occupied, then waits for Quorum, Autopilot, and shell runtime health before reporting the stack ready.",
        },
        {
          label: "Check shell runtime snapshot",
          command: `curl -i ${resolvedConfig.runtime.origin}/api/shell/runtime`,
          detail:
            "Confirms the current shell runtime snapshot, including operator controls, config, and gateway availability, through the one browser-facing control-plane seam.",
        },
        {
          label: "Smoke the shell contract",
          command: "npm run test --workspace @founderos/web",
          detail:
            "Starts the production shell, checks the key `/api/shell/*` seams, verifies `/api/shell/contract` and `/api/shell/parity`, and confirms that legacy browser routes now return `410 Gone` with the correct shell namespace.",
        },
        {
          label: "Check live upstream parity",
          command:
            "FOUNDEROS_PARITY_ALLOW_BLOCKED=1 npm run test:live-parity --workspace @founderos/web",
          detail:
            "Starts the production shell, calls `/api/shell/parity`, reports blocked versus drift separately, and supports optional `FOUNDEROS_PARITY_PROJECT_ID`, `FOUNDEROS_PARITY_INTAKE_SESSION_ID`, `FOUNDEROS_PARITY_DISCOVERY_SESSION_ID`, `FOUNDEROS_PARITY_DISCOVERY_IDEA_ID`, `FOUNDEROS_PARITY_REQUIRE_COMPLETE_CHAIN=1`, and `FOUNDEROS_PARITY_MIN_COMPLETE_CHAIN_COUNT=<n>` env vars for scoped detail parity and richer multi-chain enforcement.",
        },
        {
          label: "Run stack-backed live parity",
          command:
            "FOUNDEROS_PARITY_ALLOW_BLOCKED=1 npm run test:live-parity:stack",
          detail:
            "Starts Quorum, Autopilot, and the production shell together on an isolated local port set, seeds multiple deterministic linked chains plus execution attention and discovery daemon/review records into isolated state, waits for both upstream health checks and `/api/shell/runtime`, and then runs the existing live parity harness against that already-running shell instead of booting a second shell process. `FOUNDEROS_PARITY_CHAIN_COUNT` can raise or lower the seeded chain count when needed.",
        },
        {
          label: "Run full stack-backed review suite",
          command: "npm run test:live-review-suite:stack",
          detail:
            "Runs the full operator hardening suite in sequence: remembered review defaults, single review actions, route-native batch review flows, overview-native review-pressure actions, SSR review-pressure entry links, scoped review playbook, and the multi-chain preset suite. Set `FOUNDEROS_REVIEW_SUITE_ONLY=memory,actions,batch-routes,pressure-actions,pressure-entry-links,playbook,preset-suite` to run only a chosen subset.",
        },
        {
          label: "Run full live hardening suite",
          command: "npm run test:live-hardening:stack",
          detail:
            "Runs the complete shell acceptance stack in one pass: production-mode shell contract smoke, strict stack-backed live parity, and the full stack-backed review suite. Set `FOUNDEROS_HARDENING_SUITE_ONLY=contract,parity,review` to narrow that top-level suite to a chosen subset.",
        },
        {
          label: "Run stack-backed live review actions",
          command: "npm run test:live-review-actions:stack",
          detail:
            "Starts the same isolated local stack, seeds deterministic linked chains plus explicit review/action targets, runs strict live parity first, executes shell-owned discovery and execution review mutations end-to-end, and then reruns live parity to confirm the shell stays in sync after those write paths.",
        },
        {
          label: "Run stack-backed review memory",
          command: "npm run test:live-review-memory:stack",
          detail:
            "Starts the same isolated local stack, seeds four deterministic linked chains, writes cookie-backed remembered review defaults, verifies the resulting SSR route-entry links and server-rendered review state, and reruns strict parity before and after the remembered-pass contract.",
        },
        {
          label: "Run stack-backed batch review routes",
          command: "npm run test:live-review-batch-routes:stack",
          detail:
            "Starts the same isolated local stack, seeds four deterministic linked chains with route-native review roles, runs strict live parity first, executes visible-card batch triage across `/review`, `/discovery/review`, and `/execution/review`, verifies those actions propagate through review, inbox, dashboard, and portfolio, and then reruns strict parity without relaxing operator-rich or scenario-rich checks.",
        },
        {
          label: "Run stack-backed review pressure actions",
          command: "npm run test:live-review-pressure-actions:stack",
          detail:
            "Starts the same isolated local stack, seeds four deterministic linked chains with overview triage roles, runs strict live parity first, executes dashboard lane actions plus portfolio hotspot actions through the same shell-owned discovery and execution write seams that power the review-pressure panels, verifies the resulting changes propagate through review, inbox, dashboard, and portfolio, and then reruns strict parity without relaxing operator-rich or scenario-rich checks.",
        },
        {
          label: "Run stack-backed review pressure entry links",
          command: "npm run test:live-review-pressure-entry-links:stack",
          detail:
            "Starts the same isolated local stack, seeds four deterministic linked chains with overview triage roles, runs strict live parity first, verifies the SSR entry links emitted by the shared review-pressure panel on dashboard and portfolio, follows those scoped review links into `/review`, `/discovery/review`, and `/execution/review`, and then reruns strict parity to confirm the route-entry contract stays in sync with upstream state.",
        },
        {
          label: "Run stack-backed settings parity links",
          command: "npm run test:live-settings-parity-links:stack",
          detail:
            "Starts the same isolated local stack, seeds four deterministic linked chains with review-suite targets, runs strict live parity first, verifies the SSR `Open scoped settings` links emitted by dashboard, portfolio, review, discovery review, execution review, discovery authoring, and discovery traces, follows those links into `/settings`, and confirms the resulting settings pages server-render route scope, resolved parity targets, and scoped parity playbooks for the chosen chain.",
        },
        {
          label: "Run stack-backed review playbook",
          command: "npm run test:live-review-playbook:stack",
          detail:
            "Starts the same isolated local stack, seeds deterministic linked chains plus explicit review/action targets, runs strict live parity first, executes the shell-owned unified review playbook flow with `FOUNDEROS_REVIEW_PRESET=chain-pass`, verifies discovery decisions and execution attention all propagate through review, inbox, dashboard, and portfolio, and then reruns strict parity to confirm the shell still matches upstream after the preset-driven operator pass.",
        },
        {
          label: "Run stack-backed preset suite",
          command: "npm run test:live-review-preset-suite:stack",
          detail:
            "Starts the same isolated local stack, seeds four deterministic linked chains with distinct discovery, critical-issue, and decision-playbook roles, runs strict parity first, executes `discovery-pass`, `critical-pass`, and `decision-pass` on different scoped chains, verifies shell surfaces reconcile after each preset, and then reruns strict multi-chain parity without relaxing operator-rich or scenario-rich requirements.",
        },
      ],
      notes: [
        {
          label: "Browser boundary",
          detail:
            "Browser traffic should enter the shell through same-origin shell routes instead of calling :8800 or :8420 directly or depending on internal proxy paths.",
        },
        {
          label: "Config ownership",
          detail: "Current settings are code- and env-backed. This route is descriptive rather than mutable.",
        },
        {
          label: "Internal gateway layer",
          detail:
            "Legacy raw upstream proxy routes, the older shell runtime fragments (`/api/settings`, `/api/health`), and the older non-namespaced shell control routes (`/api/operator-preferences`, `/api/handoffs/execution-brief/*`) now return `410 Gone` and point callers back to `/api/shell/*` and `/api/shell/runtime`, so internal transport details no longer masquerade as public browser contracts.",
        },
        {
          label: "Shell contract smoke",
          detail:
            "The web workspace now includes a production-mode smoke script that boots the built shell, validates the key `/api/shell/*` seams, confirms that deprecated browser routes still advertise the expected shell namespace redirects, and checks that contract, parity audit, and parity target routes all respond.",
        },
        {
          label: "Upstream parity audit",
          detail:
            "The new `/api/shell/parity` route compares key shell snapshots against direct upstream reads, includes route-level sample ids and mismatch hints, aligns execution review checks with the same `open` and `pending` filters used by the shell, now audits composite shell layers like `/dashboard`, `/inbox`, `/portfolio`, `/review`, `/discovery/authoring`, `/discovery/review`, `/execution/review`, `/discovery/traces`, `/discovery/replays`, and the discovery board family `/discovery/board`, `/discovery/board/ranking`, `/discovery/board/archive`, `/discovery/board/finals`, `/discovery/board/simulations` in addition to raw discovery and execution feeds, and adds scope-aware detail drilldowns for project, intake, session, dossier, authoring, review, trace, replay, and board simulation targets, with `/settings` able to accept `project_id`, `intake_session_id`, `session_id`, and `idea_id` or auto-discover them through `/api/shell/parity-targets` so operators can jump straight from discovery or execution detail routes into the affected parity target.",
        },
        {
          label: "Live parity harness",
          detail:
            "The web workspace now includes `npm run test:live-parity --workspace @founderos/web`, which boots the production shell, checks `/api/shell/parity`, fails on drift or shell errors, auto-discovers live scoped ids through `/api/shell/parity-targets` when explicit env vars are absent, can either fail or only report `blocked` upstream reads depending on `FOUNDEROS_PARITY_ALLOW_BLOCKED=1`, can require one fully linked `project + intake + session + idea` target via `FOUNDEROS_PARITY_REQUIRE_COMPLETE_CHAIN=1`, can additionally require multiple complete linked chains via `FOUNDEROS_PARITY_MIN_COMPLETE_CHAIN_COUNT=<n>`, can additionally require non-empty operator queues via `FOUNDEROS_PARITY_REQUIRE_OPERATOR_DATA=1`, can additionally require scenario diversity across those linked chains via `FOUNDEROS_PARITY_REQUIRE_DIVERSE_SCENARIOS=1`, plus the root-level `npm run test:live-parity:stack` bootstrap that starts Quorum, Autopilot, and the shell first on clean local ports, seeds multiple deterministic linked discovery/execution chains plus operator-rich attention data into isolated parity-only state, varies those chains into clean idle and blocked paused operator scenarios by default, allows overriding the seeded chain count through `FOUNDEROS_PARITY_CHAIN_COUNT=<n>`, and then points the same parity harness at the already-running shell via `FOUNDEROS_PARITY_BASE_URL` with full-chain, multi-chain, operator-rich, and scenario-rich parity required by default.",
        },
        {
          label: "Live review action harness",
          detail:
            "The web workspace now also includes `npm run test:live-review-actions --workspace @founderos/web`, which uses the shell-owned discovery and execution action seams to accept one discovery inbox item plus resolve one issue, approve one execution approval, and allow one pending tool-permission runtime, then verifies the follow-up shell reads moved those records out of the open and pending feeds. The root-level `npm run test:live-review-actions:stack` bootstrap seeds deterministic action targets, runs strict parity before and after those write-path checks, and keeps the full roundtrip isolated from any ambient local state.",
        },
        {
          label: "Live review batch-route harness",
          detail:
            "The web workspace now also includes `npm run test:live-review-batch-routes --workspace @founderos/web`, which replays the same visible-card batch semantics used by `/review`, `/discovery/review`, and `/execution/review`: it filters the live shell snapshots with the same route-owned lane and filter rules, confirms discovery review records through unified and discovery-specific batch triage, resolves execution issues through execution-review issue batches, approves decision gates through execution-review decision batches, and then verifies those records disappear from review, inbox, dashboard, and portfolio rollups. The root-level `npm run test:live-review-batch-routes:stack` bootstrap seeds four deterministic linked chains with route-specific review roles, runs strict parity before and after the batch flow, and keeps the whole roundtrip isolated from ambient local state.",
        },
        {
          label: "Live review memory harness",
          detail:
            "The web workspace now also includes `npm run test:live-review-memory --workspace @founderos/web`, which writes cookie-backed remembered review defaults through `/api/shell/operator-preferences`, then verifies those saved `lane` and `preset` values reappear in SSR route-entry links on `/inbox` and in the server-rendered initial state for `/review`, `/discovery/review`, and `/execution/review`, including the linked-chain filter mapping that derives execution review back to `linked` while discovery review stays on `handoff`. The root-level `npm run test:live-review-memory:stack` bootstrap reuses the four-chain review suite seed, keeps parity strict before and after the remembered-memory pass, and validates that cookie-backed review defaults affect server-rendered shell routes, not just hydrated client state.",
        },
        {
          label: "Live review pressure harness",
          detail:
            "The web workspace now also includes `npm run test:live-review-pressure-actions --workspace @founderos/web`, which replays the same overview triage semantics used by the dashboard and portfolio review-pressure panels: it confirms linked discovery review work through the dashboard lane selection model, resolves critical execution issues through a portfolio hotspot chain, approves decision gates and allows tool prompts through a second portfolio hotspot chain, and then verifies those actions propagated through unified review, execution review, inbox, dashboard, portfolio, and strict live parity. The root-level `npm run test:live-review-pressure-actions:stack` bootstrap reuses the four-chain review suite seed, keeps parity strict before and after the overview-native triage pass, and validates that the shell rollups stay in sync with upstream state.",
        },
        {
          label: "Live review pressure entry harness",
          detail:
            "The web workspace now also includes `npm run test:live-review-pressure-entry-links --workspace @founderos/web`, which replays the same SSR route-entry contract used by the shared review-pressure panel on dashboard and portfolio: it confirms the remembered review-center links, preset chips, and hotspot `Triage whole chain` links render with the expected scoped `lane` and `preset` params, follows those links into `/review`, `/discovery/review`, and `/execution/review`, and verifies the destination routes server-render the expected preset and batch-triage state. The root-level `npm run test:live-review-pressure-entry-links:stack` bootstrap reuses the four-chain review suite seed, keeps parity strict before and after the SSR entry-link pass, and validates that the overview routes and their review destinations stay aligned.",
        },
        {
          label: "Live settings parity-link harness",
          detail:
            "The web workspace now also includes `npm run test:live-settings-parity-links --workspace @founderos/web`, which follows the SSR `Open scoped settings` links emitted by dashboard, portfolio, review, discovery review, execution review, discovery authoring, and discovery traces, then verifies that each resulting `/settings` page keeps the same scoped project and intake params, surfaces the expected discovery idea or session targets, and server-renders both `Resolved parity targets` and `Scoped parity playbooks`. The root-level `npm run test:live-settings-parity-links:stack` bootstrap reuses the four-chain review suite seed, keeps parity strict before and after the SSR settings-entry pass, and validates that the operator debug loop stays aligned with the same linked chain model used by review and parity.",
        },
        {
          label: "Live review playbook harness",
          detail:
            "The web workspace now also includes `npm run test:live-review-playbook --workspace @founderos/web`, which uses the same shell-owned review seams as the unified `/review` preset runner to execute a scoped operator pass such as `FOUNDEROS_REVIEW_PRESET=chain-pass`, confirms new discovery review decisions are written into the linked dossier, verifies execution issues, approvals, and tool-permission prompts disappear from review, inbox, dashboard, and portfolio rollups, and leaves strict parity green after the playbook. The root-level `npm run test:live-review-playbook:stack` bootstrap seeds deterministic linked-chain review targets, runs strict parity before and after the preset flow, and keeps the whole roundtrip isolated from ambient local state.",
        },
        {
          label: "Live review preset suite",
          detail:
            "The web workspace now also includes `npm run test:live-review-preset-suite --workspace @founderos/web`, which reuses the same shell-owned preset seams to run `discovery-pass`, `critical-pass`, and `decision-pass` sequentially against deterministic scoped targets supplied through `FOUNDEROS_REVIEW_SUITE_TARGETS_JSON`, and asserts that at least one operator-bearing linked chain still remains for strict parity afterwards. The root-level `npm run test:live-review-preset-suite:stack` bootstrap seeds four deterministic linked chains with dedicated preset roles, keeps post-suite parity strict instead of relaxing operator-rich or scenario-rich checks, and verifies the shell still matches upstream after multi-chain preset triage.",
        },
        {
          label: "Live review suite",
          detail:
            "The repo root now also exposes `npm run test:live-review-suite:stack`, which runs the full stack-backed operator suite end-to-end instead of making engineers stitch together six or seven separate commands by hand. It executes remembered review defaults, direct review actions, route-native batch triage, dashboard and portfolio review-pressure actions, SSR review-pressure entry-link checks, the scoped `chain-pass` review playbook, and the multi-chain preset suite sequentially, while preserving the same strict parity and scenario-rich requirements used by the individual harnesses. `FOUNDEROS_REVIEW_SUITE_ONLY=memory,actions,batch-routes,pressure-actions,pressure-entry-links,playbook,preset-suite` can narrow that suite to a targeted subset.",
        },
        {
          label: "Live hardening suite",
          detail:
            "The repo root now also exposes `npm run test:live-hardening:stack`, which runs the production shell contract smoke, strict stack-backed live parity, the full stack-backed review suite, and the SSR settings parity-link harness as one top-level acceptance pass instead of making engineers remember four separate validation tracks. `FOUNDEROS_HARDENING_SUITE_ONLY=contract,parity,review,settings` can narrow that top-level suite to a targeted subset while still using the same underlying scripts.",
        },
        {
          label: "Unified local stack bootstrap",
          detail:
            "The repo root now exposes `npm run dev:stack` and `npm run serve:stack`, which start Quorum, Autopilot, and the unified shell in one process tree, choose free local ports when the defaults are busy, wait for the upstream `/health` endpoints and `/api/shell/runtime`, prefix child logs by service, and tear the stack down together on exit instead of relying on three separate terminals.",
        },
        {
          label: "Scoped parity playbooks",
        detail:
            "The settings route now derives route-aware live parity commands for the current `project_id`, `intake_session_id`, `session_id`, and `idea_id` context, shows the resolved live ids auto-discovered through `/api/shell/parity-targets`, surfaces target coverage diagnostics including scenario diversity across linked chains, and lets operators run either a blocked-tolerant inspection pass, a strict drift check, a full linked-chain parity requirement, an operator-rich parity requirement, a stricter multi-chain parity requirement, or a scenario-rich parity requirement without reconstructing env flags by hand.",
        },
        {
            label: "Operator controls",
            detail:
              "Refresh cadence, desktop sidebar behavior, and remembered review playbooks now sync through `/api/shell/operator-preferences`, with browser state mirrored into a shell-visible cookie snapshot, applied before hydration, and folded into `/api/shell/runtime` for shell chrome, plane-specific review defaults, the generic review-entry links on discovery and execution operator routes, the deep discovery detail routes, and the execution intake/handoff/project detail routes that now server-seed remembered review context.",
          },
        {
          label: "Initial render path",
          detail:
            "`/dashboard`, `/review`, `/settings`, `/inbox`, `/portfolio`, `/discovery`, `/discovery/authoring`, `/discovery/review`, `/discovery/board`, `/discovery/board/ranking`, `/discovery/board/archive`, `/discovery/board/finals`, `/discovery/board/simulations`, `/discovery/traces`, `/discovery/replays`, `/discovery/ideas`, `/discovery/ideas/[ideaId]/authoring`, `/execution`, `/execution/review`, `/execution/intake`, and the discovery/execution detail and handoff routes now render with server-seeded first snapshots, while the shell chrome and settings surface share `/api/shell/runtime`, dashboard, unified review, portfolio, inbox, discovery authoring queue, discovery review queue, and execution review queue now share normalized shell read models, and the browser-side refresh paths re-enter the shell through `/api/shell/*` snapshot routes instead of direct cross-plane reads.",
        },
        {
          label: "Scoped control-plane links",
          detail:
            "`/portfolio`, `/settings`, `/dashboard`, `/review`, `/inbox`, `/execution`, `/execution/review`, `/execution/intake`, `/execution/handoffs`, `/discovery`, `/discovery/authoring`, `/discovery/review`, `/discovery/board`, `/discovery/board/ranking`, `/discovery/board/archive`, `/discovery/board/finals`, `/discovery/board/simulations`, `/discovery/traces`, `/discovery/replays`, `/discovery/ideas`, `/discovery/ideas/[ideaId]/authoring`, and `/discovery/sessions` now preserve `project_id` and `intake_session_id` in-shell, and the unified shell navigation keeps that context while moving between execution-chain surfaces.",
        },
      ],
    },
  };
}
