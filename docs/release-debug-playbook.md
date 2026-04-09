# Release Debug Playbook

Use this playbook when `Release Acceptance` is red on the current shipping candidate.

## 1. Reproduce The Exact Candidate

```bash
git checkout main
git submodule update --init --recursive
bash scripts/bootstrap_founderos_local.sh
```

## 2. Reproduce The Failing Plane

If the failing step is `Run Quorum backend tests`:

```bash
npm --workspace @founderos/quorum-api run test
cd quorum
./.venv/bin/python -m pytest tests -x -vv
```

If the failing step is `Run Autopilot backend tests`:

```bash
npm --workspace @founderos/autopilot-api run test
cd autopilot
./.venv/bin/python -m pytest -x -vv
```

## 3. Fix Inside The Runtime Repo

- Patch the failing runtime repo first.
- Keep the fix scoped to the failing seam.
- Re-run the full backend suite inside that runtime repo.

## 4. Repin The Submodule In FounderOS

```bash
git add quorum autopilot
git commit -m "fix(main): pin runtime release fix"
```

## 5. Re-run The Full Release Contract

```bash
bash scripts/bootstrap_founderos_local.sh
npm run build
npm run verify:fast
npm run test
python3 -m pytest founderos_contracts/tests -q
```

## 6. Ship Only The Exact Green Commit

- Push the root commit that pins the fixed runtime SHA.
- Wait for `Release Acceptance` on that exact root commit.
- Record the exact green run URL in the release handoff.
- Tag or release only after the exact commit is green.
