# FounderOS Release Checklist

Use this checklist on the exact release-candidate commit.

## Clean Checkout

- `git clone --recurse-submodules <repo-url>`
- `git submodule update --init --recursive`
- confirm `autopilot/pyproject.toml` exists
- confirm `quorum/gateway.py` exists
- confirm no recursive submodule errors appear in checkout output

## Bootstrap

- run `bash scripts/bootstrap_founderos_local.sh`
- confirm the script exits `0`
- confirm no smoke/build failures are reported

## Verification

- run `npm run build`
- run `npm run typecheck`
- run `npm run test`
- run `python -m pytest founderos_contracts/tests -q`
- confirm `.github/workflows/release-acceptance.yml` is green for the candidate commit

## Release Truth

- review [docs/founderos-truth-matrix.md](./founderos-truth-matrix.md)
- confirm README matches the current release topology and verification flow
- confirm any archived handoff/audit notes remain under `docs/archive/internal/`

## Publish

- create/update release notes in [CHANGELOG.md](../CHANGELOG.md)
- create an annotated git tag after CI is green
- publish the GitHub Release from the tagged commit
