# FounderOS

FounderOS is the release coordinator for the local-first FounderOS stack. The root repository
publishes the unified shell, shared packages, release docs, and the pinned `autopilot` and
`quorum` runtime topology required to run the product end-to-end from a clean checkout.

## Repository Layout

- `apps/web`: unified shell and operator UI
- `apps/autopilot-api`: root workspace wrapper for the Autopilot runtime
- `apps/quorum-api`: root workspace wrapper for the Quorum runtime
- `packages/*`: shared API clients, UI primitives, config, linting, and TS presets
- `founderos_contracts/*`: canonical cross-plane Python contracts
- `scripts/*`: bootstrap, stack startup, and release verification helpers
- `autopilot`: pinned execution-plane runtime submodule
- `quorum`: pinned orchestration and discovery runtime submodule

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

Both bootstrap and stack startup fail non-zero when required runtime roots or entrypoints are
missing.

## Production Boundaries

This repository is the release coordinator for the FounderOS stack, not a standalone
single-repo production deploy unit.

- `autopilot` and `quorum` remain pinned runtime inputs via git submodules.
- production release verification must always cover the root repo and both pinned submodules together.
- high-risk shell diagnostics and mutation routes under `/api/shell/*` should be treated as
  admin-only surfaces in production.
- the local execution-brief handoff filesystem store is a development bridge, not a durable
  shared production datastore.

## Toolchains

- Node.js `>=20`
- npm `>=10`
- Python `3.13` for `quorum`
- Python `3.13+` for `autopilot` unless the submodule README says otherwise

Use `.env.example` as the baseline env contract for local and pre-prod setup.

## Bootstrap

Prepare the pinned local stack:

```bash
bash scripts/bootstrap_founderos_local.sh
```

Bootstrap validates the runtime roots, creates both Python virtual environments, installs
`founderos_contracts` into both backends, installs root Node dependencies, and runs import/build
smoke checks before returning success.

## Run Locally

Start the integrated local stack:

```bash
npm run dev:stack
```

Default local endpoints:

- shell: `http://127.0.0.1:3737`
- quorum: `http://127.0.0.1:8800`
- autopilot: `http://127.0.0.1:8420/api`

## Verification

Run the release-candidate checks from the candidate commit:

```bash
bash scripts/bootstrap_founderos_local.sh
npm run build
npm run verify:fast
npm run test
python3 -m pytest founderos_contracts/tests -q
```

`npm run verify:fast` is the fast release-seam suite. `npm run typecheck` remains the
TypeScript-only workspace check.

The mandatory CI gate for the exact candidate commit lives in
`.github/workflows/release-acceptance.yml`.

## Public Docs

Canonical public release docs:

- [Truth matrix](docs/founderos-truth-matrix.md)
- [Release checklist](docs/release-checklist.md)
- [Release debug playbook](docs/release-debug-playbook.md)
- [Change log](CHANGELOG.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)

Compatibility aliases for conventional repo navigation:

- [docs/truth-matrix.md](docs/truth-matrix.md)
- [CHECKLIST.md](CHECKLIST.md)

## Release Contract

FounderOS is release-ready only when all of the following are true for the same commit:

1. Recursive submodule checkout succeeds.
2. Bootstrap succeeds without partial-failure state.
3. `npm run build`, `npm run verify:fast`, and `npm run test` all pass.
4. The public docs surface above exists at the advertised paths.
5. `Release Acceptance` is green on the exact shipping commit.

## License

This repository is released under the MIT License. See [LICENSE](LICENSE).
