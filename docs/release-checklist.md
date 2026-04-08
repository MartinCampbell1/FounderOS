# FounderOS Release Checklist

Canonical checklist for the exact release-candidate commit.

Compatibility alias: [CHECKLIST.md](../CHECKLIST.md)

## Clean Checkout

- `git clone --recurse-submodules <repo-url>`
- `git submodule update --init --recursive`
- confirm `autopilot/pyproject.toml` exists
- confirm `quorum/gateway.py` exists
- confirm checkout does not report recursive submodule failures

## Bootstrap

- run `bash scripts/bootstrap_founderos_local.sh`
- confirm the script exits `0`
- confirm bootstrap does not hide import or build smoke failures

## Verification

- run `npm run build`
- run `npm run verify:fast`
- run `npm run test`
- run `python3 -m pytest founderos_contracts/tests -q`
- confirm `.github/workflows/release-acceptance.yml` is green for the candidate commit

## Public Release Surface

- confirm `README.md`, `CHANGELOG.md`, `CHECKLIST.md`, `docs/release-checklist.md`,
  `docs/truth-matrix.md`, `docs/founderos-truth-matrix.md`, `CONTRIBUTING.md`, and `SECURITY.md`
  exist together
- confirm `README.md` points at the same canonical docs paths
- confirm the checklist and truth-matrix compatibility aliases still point to the canonical docs

## Publish

- update release notes in `CHANGELOG.md`
- record the shipping commit SHA in the release handoff
- record the exact green `Release Acceptance` run URL for that commit
- record the changed submodule SHAs in the release handoff
- create an annotated git tag after CI is green
- publish the GitHub Release from the tagged commit
