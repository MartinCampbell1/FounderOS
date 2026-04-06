# Changelog

## Unreleased

### Changed

- Hardened the public release contract around pinned `autopilot` and `quorum` submodules.
- Kept bootstrap and stack startup fail-fast when runtime roots or entrypoints are missing.
- Archived internal handoff and audit notes under `docs/archive/internal/` so they no longer
  read like public source-of-truth artifacts.
- Normalized `founderos_contracts` Pydantic list defaults to `Field(default_factory=list)`.

### Fixed

- Removed the stale nested `quorum/next-monorepo` gitlink from the release path so recursive
  submodule checkout can complete without hidden topology failures.

## v0.1.0

- Reserved for the first reproducible public FounderOS release.
