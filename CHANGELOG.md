# Changelog

## Unreleased

### Changed

- Reserved for post-`v1.0.1` changes.

## v1.0.1

- Hardened the browser-facing shell control plane with admin-gated diagnostics, constrained action
  proxies, protected mutation routes, and compatibility aliases for legacy shell endpoints.
- Added explicit health/readiness probes, root container manifests, a release debug playbook, a
  versioned `/api/v1/shell/*` alias layer, and protected shell metrics.
- Added a Postgres-backed execution-brief handoff adapter for production, pinned shared Python
  contract dependencies through root constraints, and aligned the public release signal with the
  exact green shipping commit.

## v1.0.0

- First reproducible public FounderOS release candidate after closing the bootstrap,
  founder-approval, and release-surface audit regressions.
