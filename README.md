# FounderOS

FounderOS is the coordinator repository for the local-first FounderOS stack.
It ships the unified operator shell, shared packages, public release docs, and
the pinned runtime topology required to run the product end-to-end from a clean
checkout.

At a high level, FounderOS combines two backend planes:

- `quorum`: discovery, orchestration, and founder-facing intelligence flows
- `autopilot`: execution, project runtime, approvals, audits, and agent activity

The root repository ties those runtimes together behind one shell so operators
can move across discovery, execution, review, and settings without changing
tools or losing route scope.

## What FounderOS Does

FounderOS is an operating shell for the founder workflow, not just a frontend
demo and not just a backend monorepo. The product is organized around a few
core jobs:

- aggregate cross-plane health and workload in one dashboard
- turn discovery sessions, ideas, traces, and research into actionable execution
- track projects, intake sessions, approvals, issues, handoffs, audits, and
  runtime agents
- provide one review surface that keeps discovery pressure and execution
  pressure visible together
- keep operator preferences, parity targets, accounts, and capability checks in
  one settings cluster

The root route redirects to `/dashboard`, and the shell keeps `project_id` and
`intake_session_id` attached while moving through related surfaces.

## Product Surface Map

The Next.js app lives under `apps/web/app/(shell)` and is organized into these
top-level route families:

- `/dashboard`: shell-native operational overview across discovery, execution,
  runtime health, and attention state
- `/inbox`: incoming discovery signal queue
- `/discovery`: sessions, ideas, board, ranking, simulations, archive, finals,
  research, intelligence, improvement, replays, authoring, and discovery review
- `/execution`: projects, intake, issues, approvals, control plane review,
  audits, events, handoffs, and runtime agents
- `/portfolio`: cross-plane portfolio summary view
- `/review`: unified review center spanning discovery and execution
- `/settings`: preferences, accounts, capabilities, parity targets, and runtime
  diagnostics

This structure is deliberate: FounderOS keeps discovery and execution as
distinct planes, then layers shared review and shell tooling across them.

## System Architecture

FounderOS is split into four main layers:

1. Shell application
   `apps/web` is the unified Next.js shell and operator UI. It owns route
   bootstrap, shell-level preferences, shell API seams, and the route grammar
   that connects the product surfaces above.
2. Runtime wrappers
   `apps/quorum-api` and `apps/autopilot-api` are thin root-workspace wrappers
   that start and validate the pinned backend runtimes from this repository.
3. Shared packages
   `packages/ui`, `packages/config`, and `packages/api-clients` provide reusable
   UI primitives, config resolution, and typed client helpers across the shell.
4. Cross-plane contracts
   `founderos_contracts` contains the canonical shared Python contracts used by
   both runtimes.

The repository intentionally does not vendor the Quorum and Autopilot runtime
source into the root history. Instead, the release artifact is defined by the
root repo plus the exact pinned submodule commits.

## Repository Layout

- `apps/web`: unified shell and operator UI
- `apps/autopilot-api`: root workspace wrapper for the Autopilot runtime
- `apps/quorum-api`: root workspace wrapper for the Quorum runtime
- `packages/api-clients`: shared typed clients and transport helpers
- `packages/config`: shared environment and config resolution
- `packages/ui`: shared design tokens and UI primitives
- `packages/eslint-config`: shared lint presets
- `packages/typescript-config`: shared TypeScript presets
- `founderos_contracts/*`: canonical cross-plane Python contracts
- `scripts/*`: bootstrap, stack startup, parity, and release verification
  helpers
- `autopilot`: pinned execution-plane runtime submodule
- `quorum`: pinned orchestration and discovery runtime submodule
- `docs/*`: public docs, frontend handoff notes, and design-source registry

## Clone Contract

FounderOS must bootstrap from a clean checkout with recursive submodules:

```bash
git clone --recurse-submodules <repo-url>
cd FounderOS
```

If the repository was already cloned without submodules:

```bash
git submodule update --init --recursive
```

Both bootstrap and stack startup fail non-zero when required runtime roots or
entrypoints are missing.

## Required Toolchains

- Node.js `>=20`
- npm `>=10`
- Python `3.13` for `quorum`
- Python `3.13+` for `autopilot` unless the submodule README says otherwise

## Bootstrap

Prepare the pinned local stack:

```bash
bash scripts/bootstrap_founderos_local.sh
```

Bootstrap does the full local setup in one pass:

1. syncs and initializes git submodules
2. validates the required runtime roots and package metadata
3. creates `.venv` environments for `quorum` and `autopilot`
4. installs `founderos_contracts` into both runtimes
5. installs root Node workspace dependencies with `npm ci`
6. runs import and build smoke checks before returning success

If bootstrap fails, fix that first. Stack startup and release verification both
assume bootstrap has completed cleanly.

## Run Locally

Start the integrated local stack:

```bash
npm run dev:stack
```

That command runs `node ./scripts/run-stack.mjs dev`, validates the runtime
layout, launches the managed processes, and tears them down when the parent
process exits.

Default local endpoints:

- shell: `http://127.0.0.1:3737`
- quorum: `http://127.0.0.1:8800`
- autopilot: `http://127.0.0.1:8420/api`

Alternative stack modes:

- `npm run serve:stack`: serve mode for the managed stack
- `npm run test:live-parity:stack`: local parity check stack
- `npm run test:live-review-suite`: sequential live review validation suite
- `npm run test:live-hardening:stack`: broader live hardening pass

If you only need the shell package directly:

```bash
npm run dev --workspace @founderos/web
```

## Daily Development Commands

Useful root-level commands:

```bash
npm run build
npm run lint
npm run typecheck
npm run test
```

Useful shell-only commands:

```bash
npm run lint --workspace @founderos/web
npm run typecheck --workspace @founderos/web
npm run test --workspace @founderos/web
```

Frontend parity helpers:

```bash
npm run design:linear:refs
npm run design:linear:tokens
```

Those scripts sync the local Linear reference repos and regenerate token dumps
used during shell-fidelity work.

## Verification

Run the release-candidate checks from the candidate commit:

```bash
bash scripts/bootstrap_founderos_local.sh
npm run build
npm run typecheck
npm run test
python -m pytest founderos_contracts/tests -q
```

The mandatory CI gate for the exact candidate commit lives in
`.github/workflows/release-acceptance.yml`.

## Release Contract

FounderOS is release-ready only when all of the following are true for the same
commit:

1. Recursive submodule checkout succeeds.
2. Bootstrap succeeds without partial-failure state.
3. `npm run build`, `npm run typecheck`, and `npm run test` all pass.
4. The public docs surface below exists at the advertised paths.
5. `Release Acceptance` is green on the exact shipping commit.

## Public Docs

Canonical public release docs:

- [Truth matrix](docs/founderos-truth-matrix.md)
- [Release checklist](docs/release-checklist.md)
- [Change log](CHANGELOG.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)

Compatibility aliases for conventional repo navigation:

- [docs/truth-matrix.md](docs/truth-matrix.md)
- [CHECKLIST.md](CHECKLIST.md)

## Additional Project Docs

- [Frontend handoff](docs/FRONTEND_HANDOFF.md)
- [Frontend design agent brief](docs/FRONTEND_DESIGN_AGENT_BRIEF.md)
- [Linear source registry](docs/LINEAR_SOURCE_REGISTRY.md)

The public docs above define release truth. The extra docs here are helpful
implementation context for ongoing shell and design work.

## License

This repository is released under the MIT License. See [LICENSE](LICENSE).
