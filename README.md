# FounderOS

FounderOS is the umbrella repository for the local-first FounderOS stack:

- `apps/web`: the unified shell and operator UI
- `autopilot`: the execution plane
- `quorum`: the orchestration and discovery plane
- `packages/*`: shared config, UI primitives, and API clients

The root repo is intentionally lightweight and uses git submodules for `autopilot` and `quorum`.
Their pinned commits are part of this repository's release topology, so a clean clone plus
bootstrap is the source-of-truth flow for the full stack.

## Clone

```bash
git clone --recurse-submodules <repo-url>
cd FounderOS
```

If you already cloned the repo without submodules:

```bash
git submodule update --init --recursive
```

## Prerequisites

- Node.js `>=20`
- npm `>=10`
- Python `3.13` recommended for `quorum`
- Python `3.14` is used successfully in parts of `autopilot`, but follow each subproject README when in doubt

## Quick Start

Bootstrap the full local stack. This initializes pinned submodules, creates the Python
virtual environments, installs the Node workspace dependencies, and fails hard if the
runtime planes or smoke checks are incomplete:

```bash
bash scripts/bootstrap_founderos_local.sh
```

Copy the local environment template if you want to override defaults:

```bash
cp .env.example .env.local
```

Then start the integrated local stack:

```bash
npm run dev:stack
```

If you skipped `--recurse-submodules` during clone, the bootstrap script will attempt to
initialize them for you and will stop with a clear error if a required runtime file is
still missing.

Default local endpoints:

- shell: `http://127.0.0.1:3737`
- quorum: `http://127.0.0.1:8800`
- autopilot: `http://127.0.0.1:8420/api`

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
autopilot/        git submodule
quorum/           git submodule
scripts/          stack bootstrap and verification helpers
```

## Project Docs

- [autopilot README](autopilot/README.md)
- [quorum README](quorum/README.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)

## License

This repository is released under the MIT License. See [LICENSE](LICENSE).
