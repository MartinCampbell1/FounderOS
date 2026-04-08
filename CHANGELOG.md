# Changelog

## Unreleased

### Changed

- Made Quorum founder-approval sync rollback-safe when the downstream Autopilot `sync-v2` call
  fails.
- Restored the public release-doc surface at canonical and compatibility paths.
- Kept release-contract coverage focused on public docs drift and clean-clone runtime checks.
- Updated the GitHub Actions release gate away from deprecated Node 20 action runtimes.

## v1.0.0

- First reproducible public FounderOS release candidate after closing the bootstrap,
  founder-approval, and release-surface audit regressions.
