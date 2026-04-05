# FounderOS Unified Shell Handoff

Date: 2026-04-04

## Purpose

This file is a repo-local handoff for continuing the FounderOS unification work in a new dialog without relying on a very long chat thread.

The codebase already contains most of the functional unification. The main remaining work is hardening, richer live scenarios, final cleanup, and then a dedicated UI/UX pass.

## Current Status

- Functional unification progress: about 92-95%
- Product-ready progress: about 70-75%
- Remaining functional work: about 5-8%
- Remaining product polish/design/hardening: about 20-25%

## What Is Already Done

### 1. Shell-first architecture

- The browser-facing contract is centered on `/api/shell/*`.
- Legacy browser-facing routes like `/api/settings`, `/api/health`, `/api/operator-preferences`, `/api/handoffs/execution-brief`, `/api/_quorum/*`, `/api/_autopilot/*` were pushed behind shell seams or deprecated with `410`.
- Same-origin shell routes now own reads and writes across discovery, execution, review, runtime, handoffs, parity, and operator preferences.

### 2. Unified shell surfaces

The unified shell already has shell-native routes for:

- `/dashboard`
- `/review`
- `/discovery`
- `/discovery/ideas`
- `/discovery/ideas/[ideaId]`
- `/discovery/ideas/[ideaId]/authoring`
- `/discovery/authoring`
- `/discovery/review`
- `/discovery/traces`
- `/discovery/traces/[ideaId]`
- `/discovery/replays`
- `/discovery/replays/[sessionId]`
- `/discovery/board`
- `/discovery/board/ranking`
- `/discovery/board/archive`
- `/discovery/board/finals`
- `/discovery/board/simulations`
- `/discovery/board/simulations/[ideaId]`
- `/discovery/sessions/[sessionId]`
- `/execution`
- `/execution/review`
- `/execution/intake`
- `/execution/intake/[sessionId]`
- `/execution/projects/[projectId]`
- `/execution/handoffs/[handoffId]`
- `/portfolio`
- `/inbox`
- `/settings`

### 3. Cross-plane model

- Shared chain graph exists across discovery and execution.
- Cross-plane review pressure exists across dashboard, portfolio, inbox, and review routes.
- Route-owned scope exists across the shell via `project_id`, `intake_session_id`, and now also `session_id` and `idea_id` for parity/debug targeting.
- Operator preferences are persisted and visible to the server.
- Remembered review lane/preset memory exists and is applied to review entry points.

### 4. Live parity and hardening

The stack now supports one-command startup and hardening:

- Quorum
- Autopilot
- Web shell

This already exists through:

- `<local FounderOS checkout>/scripts/run-stack.mjs`
- `<local FounderOS checkout>/scripts/run-live-review-suite.mjs`
- `<local FounderOS checkout>/scripts/run-live-hardening-suite.mjs`

There is now deterministic stack seeding for:

- complete linked chains
- operator-rich attention
- multi-chain scenario diversity
- review presets
- review pressure actions
- settings parity links

### 5. Live verification already built

Important live harnesses now exist:

- `<local FounderOS checkout>/apps/web/scripts/smoke-shell-contract.mjs`
- `<local FounderOS checkout>/apps/web/scripts/check-live-parity.mjs`
- `<local FounderOS checkout>/apps/web/scripts/check-live-review-actions.mjs`
- `<local FounderOS checkout>/apps/web/scripts/check-live-review-batch-routes.mjs`
- `<local FounderOS checkout>/apps/web/scripts/check-live-review-memory.mjs`
- `<local FounderOS checkout>/apps/web/scripts/check-live-review-pressure-actions.mjs`
- `<local FounderOS checkout>/apps/web/scripts/check-live-review-pressure-entry-links.mjs`
- `<local FounderOS checkout>/apps/web/scripts/check-live-review-playbook.mjs`
- `<local FounderOS checkout>/apps/web/scripts/check-live-review-preset-suite.mjs`
- `<local FounderOS checkout>/apps/web/scripts/check-live-settings-parity-links.mjs`

### 6. Important recent hardening work

- Stack-backed live parity is green on seeded linked chains.
- Strict full-chain parity is green.
- Operator-rich parity is green.
- Diverse multi-chain scenario parity is green.
- Live review single-action coverage is green.
- Live preset suite coverage is green.
- Live review pressure action coverage is green.
- Settings parity/debug links were added as a dedicated live-checked surface.
- Autopilot file-backed persistence was hardened with atomic writes to eliminate transient state corruption during stack-backed tests.

## Latest Confirmed Verification

Latest confirmed green commands before or during this handoff:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test --workspace @founderos/web`
- `npm run test:live-parity:stack`
- `npm run test:live-review-actions:stack`
- `npm run test:live-review-preset-suite:stack`
- `npm run test:live-review-pressure-actions:stack`
- `npm run test:live-settings-parity-links:stack`
- `npm run test:live-hardening:stack`

During handoff preparation, `npm run test:live-hardening:stack` was re-run to completion and passed green with:

- `Shell contract smoke`
- `Live parity stack`
- `Live review suite`
- `Settings parity links`

Reported result:

- `status: "ok"`
- `stepCount: 4`
- `totalDurationMs: 142287`

## Recommended Resume Point

If continuing in a new dialog, start from this block:

1. Reconfirm the full hardening suite:
   - `npm run test:live-hardening:stack`
2. If green, move to the remaining functional hardening:
   - strengthen route-native batch-selection live coverage on review routes
   - expand richer multi-chain operator scenarios
   - reduce remaining duplicated glue around review/action surfaces
3. Only after that, start the dedicated UI/UX pass

## Highest-Signal Next Tasks

### A. Finish the last functional hardening slice

Focus on route-native review screens, not more plumbing:

- validate and harden real batch-selection behavior on:
  - `/review`
  - `/discovery/review`
  - `/execution/review`
- expand live coverage so these routes are tested as real selection-driven UIs, not just preset-driven flows

### B. Expand richer live datasets

The current parity/hardening stack is strong, but still deterministic and controlled. Next useful step:

- run richer multi-chain states
- include more varied discovery review shapes
- include more varied execution issue/approval/runtime mixtures
- catch content regressions that only show up on denser states

### C. Cleanup and compression of internal glue

There is still some tail work left in:

- route-entry helpers
- review action wrappers
- parity/debug entry propagation
- screen-local reconciliation glue

This is no longer architecture work. It is mostly cleanup and consistency work.

### D. Then do the UI pass

Important product note from the user:

- The current UI is not acceptable yet.
- For future UI work on newly introduced shell elements, use 21st.dev / 21st MCP first instead of improvising low-quality shell UI.
- Do not do an AI-slop redesign.
- Do not do a generic poor white-background enterprise look.
- The UI pass should happen after the remaining functional unification/hardening block is closed.

## Key Files To Read First In A New Dialog

### Runtime, stack, and verification

- `<local FounderOS checkout>/scripts/run-stack.mjs`
- `<local FounderOS checkout>/scripts/run-live-review-suite.mjs`
- `<local FounderOS checkout>/scripts/run-live-hardening-suite.mjs`
- `<local FounderOS checkout>/scripts/seed-parity-linked-chain.mjs`
- `<local FounderOS checkout>/autopilot/scripts/seed_parity_operator_attention.py`
- `<local FounderOS checkout>/apps/web/scripts/smoke-shell-contract.mjs`
- `<local FounderOS checkout>/apps/web/scripts/check-live-parity.mjs`
- `<local FounderOS checkout>/apps/web/scripts/check-live-review-actions.mjs`
- `<local FounderOS checkout>/apps/web/scripts/check-live-review-preset-suite.mjs`
- `<local FounderOS checkout>/apps/web/scripts/check-live-review-pressure-actions.mjs`
- `<local FounderOS checkout>/apps/web/scripts/check-live-settings-parity-links.mjs`

### Shell runtime, parity, and settings

- `<local FounderOS checkout>/apps/web/lib/shell-parity-audit.ts`
- `<local FounderOS checkout>/apps/web/lib/shell-parity-targets.ts`
- `<local FounderOS checkout>/apps/web/lib/settings-parity-targets.ts`
- `<local FounderOS checkout>/apps/web/lib/live-parity-commands.ts`
- `<local FounderOS checkout>/apps/web/lib/route-scope.ts`
- `<local FounderOS checkout>/apps/web/lib/settings.ts`
- `<local FounderOS checkout>/apps/web/components/settings/settings-workspace.tsx`
- `<local FounderOS checkout>/apps/web/app/api/shell/parity/route.ts`
- `<local FounderOS checkout>/apps/web/app/api/shell/parity-targets/route.ts`
- `<local FounderOS checkout>/apps/web/app/api/shell/contract/route.ts`
- `<local FounderOS checkout>/apps/web/app/api/shell/runtime/route.ts`

### Review and attention surfaces

- `<local FounderOS checkout>/apps/web/lib/review-center.ts`
- `<local FounderOS checkout>/apps/web/lib/review-pressure.ts`
- `<local FounderOS checkout>/apps/web/lib/attention-records.ts`
- `<local FounderOS checkout>/apps/web/lib/attention-action-model.ts`
- `<local FounderOS checkout>/apps/web/components/review/review-workspace.tsx`
- `<local FounderOS checkout>/apps/web/components/discovery/discovery-review-workspace.tsx`
- `<local FounderOS checkout>/apps/web/components/execution/execution-review-workspace.tsx`
- `<local FounderOS checkout>/apps/web/components/review/review-pressure-panel.tsx`
- `<local FounderOS checkout>/apps/web/components/dashboard/dashboard-workspace.tsx`
- `<local FounderOS checkout>/apps/web/components/portfolio/portfolio-workspace.tsx`
- `<local FounderOS checkout>/apps/web/components/inbox/inbox-workspace.tsx`

### Discovery and execution model layers

- `<local FounderOS checkout>/apps/web/lib/discovery.ts`
- `<local FounderOS checkout>/apps/web/lib/execution.ts`
- `<local FounderOS checkout>/apps/web/lib/chain-graph.ts`
- `<local FounderOS checkout>/apps/web/lib/chain-graph-data.ts`
- `<local FounderOS checkout>/apps/web/lib/discovery-authoring-queue.ts`
- `<local FounderOS checkout>/apps/web/lib/discovery-review.ts`
- `<local FounderOS checkout>/apps/web/lib/discovery-history.ts`
- `<local FounderOS checkout>/apps/web/lib/discovery-board.ts`
- `<local FounderOS checkout>/apps/web/lib/discovery-board-detail.ts`

### Storage hardening

- `<local FounderOS checkout>/autopilot/autopilot/core/atomic_io.py`
- `<local FounderOS checkout>/autopilot/autopilot/core/project_store.py`
- `<local FounderOS checkout>/autopilot/autopilot/core/intake_sessions.py`
- `<local FounderOS checkout>/autopilot/autopilot/core/execution_plane.py`
- `<local FounderOS checkout>/autopilot/tests/test_project_store.py`

## Commands Worth Keeping Handy

### Core

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test --workspace @founderos/web`

### Stack startup

- `npm run dev:stack`
- `npm run serve:stack`

### Live parity and hardening

- `npm run test:live-parity:stack`
- `npm run test:live-review-actions:stack`
- `npm run test:live-review-batch-routes:stack`
- `npm run test:live-review-memory:stack`
- `npm run test:live-review-pressure-actions:stack`
- `npm run test:live-review-pressure-entry-links:stack`
- `npm run test:live-review-playbook:stack`
- `npm run test:live-review-preset-suite:stack`
- `npm run test:live-settings-parity-links:stack`
- `npm run test:live-review-suite:stack`
- `npm run test:live-hardening:stack`

### Scoped parity knobs

These are already supported by the harnesses:

- `FOUNDEROS_PARITY_ALLOW_BLOCKED=1`
- `FOUNDEROS_PARITY_REQUIRE_COMPLETE_CHAIN=1`
- `FOUNDEROS_PARITY_REQUIRE_OPERATOR_DATA=1`
- `FOUNDEROS_PARITY_REQUIRE_DIVERSE_SCENARIOS=1`
- `FOUNDEROS_PARITY_PROJECT_ID=...`
- `FOUNDEROS_PARITY_INTAKE_SESSION_ID=...`
- `FOUNDEROS_PARITY_DISCOVERY_SESSION_ID=...`
- `FOUNDEROS_PARITY_DISCOVERY_IDEA_ID=...`

## Known Constraints

- In this workspace snapshot, `<local FounderOS checkout>` is not currently backed by a visible `.git` directory, so git-based status/branch handoff is not available from this environment.
- Local stack tests assume working Python virtualenvs for:
  - `<local FounderOS checkout>/quorum/.venv`
  - `<local FounderOS checkout>/autopilot/.venv`
- The main remaining risk is no longer architectural integration. It is quality drift, richer scenario coverage, and the still-missing UI pass.

## Suggested First Prompt For A New Dialog

Use something close to this:

> Read `<local FounderOS checkout>/HANDOFF_2026-04-04_UNIFIED_SHELL.md`, inspect the referenced files, confirm current state from code, then continue from the recommended next block without restarting architecture work from scratch.
