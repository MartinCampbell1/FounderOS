# Contributing

## Scope

This repository coordinates multiple parts of the FounderOS stack:

- root shell workspace in `apps/` and `packages/`
- `autopilot` submodule
- `quorum` submodule

Keep changes scoped. If a fix belongs only to `autopilot` or `quorum`, prefer making it in that submodule and documenting any required root-level coordination separately.

## Setup

1. Clone with submodules:

```bash
git clone --recurse-submodules <repo-url>
cd FounderOS
```

2. Install Node dependencies:

```bash
npm install
```

3. Review the subproject setup docs:

- `autopilot/README.md`
- `quorum/README.md`

## Local Validation

For root-level shell changes:

```bash
npm run typecheck
npm run build
```

For integrated local-stack checks:

```bash
npm run dev:stack
```

For backend-specific validation, run the relevant test commands inside `autopilot` or `quorum`.

## Pull Requests

- Keep PRs narrow and explain which layer changed: shell, shared package, quorum, or autopilot.
- Include verification commands you actually ran.
- Avoid committing local state, handoff notes, or machine-specific paths.
