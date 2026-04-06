# FounderOS

FounderOS is the public coordinator repository for the local-first FounderOS stack.
It publishes the shell, shared packages, and the pinned backend topology needed to run the
system end-to-end from a clean checkout.

## What This Repository Contains

- `apps/web`: the unified shell and operator UI
- `apps/autopilot-api`: root workspace wrapper for the Autopilot runtime
- `apps/quorum-api`: root workspace wrapper for the Quorum runtime
- `packages/*`: shared API clients, UI primitives, config, linting, and TypeScript presets
- `scripts/*`: bootstrap, stack startup, and release verification helpers
- `founderos_contracts/*`: canonical cross-plane Python contracts

## What This Repository Does Not Vendor Directly

The backend runtime code is not copied into the root history. FounderOS pins it via public git
submodules:

- `autopilot`: execution plane runtime
- `quorum`: orchestration and discovery runtime

That topology is intentional. The root repository is the release coordinator, and the pinned
submodule commits are part of the release artifact.

## Clone Contract

Clean checkout must work with either of these flows:

```bash
git clone --recurse-submodules <repo-url>
cd FounderOS
```

or, after an existing clone:

```bash
git submodule update --init --recursive
```

If required runtime roots or entrypoints are missing, both bootstrap and stack startup fail
non-zero with explicit diagnostics.

## Toolchains

- Node.js `>=20`
- npm `>=10`
- Python `3.13` recommended for `quorum`
- Python `3.14` works in parts of `autopilot`, but follow each subproject README when in doubt

## Bootstrap

Bootstrap prepares the full local stack from the pinned release topology:

```bash
bash scripts/bootstrap_founderos_local.sh
```

It performs these checks in order:

1. syncs and initializes git submodules
2. validates required runtime roots and package metadata
3. creates Python virtual environments for `quorum` and `autopilot`
4. installs `founderos_contracts` into both runtimes
5. installs root Node workspace dependencies
6. runs import/build smoke checks and exits non-zero on failure

Copy the local environment template if you need overrides:

```bash
cp .env.example .env.local
```

## Run Locally

Start the integrated local stack:

```bash
npm run dev:stack
```

Default local endpoints:

- shell: `http://127.0.0.1:3737`
- quorum: `http://127.0.0.1:8800`
- autopilot: `http://127.0.0.1:8420/api`

## Smoke, Build, and Test

Release-candidate verification uses these commands from a clean checkout:

```bash
bash scripts/bootstrap_founderos_local.sh
npm run build
npm run typecheck
npm run test
```

Shared-contract regression tests also run in the release-acceptance workflow:

```bash
python -m pytest founderos_contracts/tests -q
```

The mandatory CI gate for that contract lives in
`.github/workflows/release-acceptance.yml`.

## Repository Layout

```text
apps/
  web/            Next.js shell
  autopilot-api/  wrapper package for local autopilot runtime
  quorum-api/     wrapper package for local quorum runtime
packages/
  api-clients/    typed client contracts
  config/         shared env/config resolution
  ui/             shared UI primitives
autopilot/        pinned public git submodule
quorum/           pinned public git submodule
scripts/          stack bootstrap and verification helpers
founderos_contracts/
                  canonical shared Python contracts
docs/             public release docs and archived internal notes
```

## Known Limitations

- The root repo depends on successful checkout of the pinned `autopilot` and `quorum`
  submodule commits.
- Backend static typing is not yet enforced across the full Python surface; root quality
  signals currently rely on smoke tests, `ruff`, and targeted regression suites.
- Historical handoff and audit notes are preserved under `docs/archive/internal/` for
  traceability, but they are not public release truth.

## Release Readiness Criteria

FounderOS is release-ready only when all of the following are true for the exact candidate commit:

1. clean clone plus recursive submodule init succeeds
2. bootstrap succeeds with no hidden partial-failure state
3. `npm run build`, `npm run typecheck`, and `npm run test` all pass
4. the truth matrix matches the verified code and release topology
5. the release-acceptance workflow is green on the candidate commit

## Public Docs

- [Truth matrix](docs/founderos-truth-matrix.md)
- [Release checklist](docs/release-checklist.md)
- [Change log](CHANGELOG.md)
- [autopilot README](autopilot/README.md)
- [quorum README](quorum/README.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)

## License

This repository is released under the MIT License. See [LICENSE](LICENSE).
