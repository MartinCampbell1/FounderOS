# Contributing

## Scope

This repository coordinates the shell workspace plus the pinned `autopilot` and `quorum`
submodules. Keep changes scoped to the layer that actually owns the behavior.

## Setup

1. Clone with submodules:

```bash
git clone --recurse-submodules <repo-url>
cd FounderOS
```

2. Bootstrap the integrated stack:

```bash
bash scripts/bootstrap_founderos_local.sh
```

3. Review the subproject docs before making backend-only changes:

- `autopilot/README.md`
- `quorum/README.md`

## Local Validation

For root-level shell or shared-package changes:

```bash
npm run build
npm run typecheck
```

For release-surface changes:

```bash
npm run test:release-contract
```

For backend-specific changes, run the relevant test commands in `quorum` or `autopilot`.

## Pull Requests

- Keep PRs narrow and explain which layer changed.
- Include the verification commands you actually ran.
- Avoid committing local state, archived scratch notes, or machine-specific paths.
