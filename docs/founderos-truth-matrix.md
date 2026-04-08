# FounderOS Truth Matrix

Single source of truth for the current public release contract.

Updated: 2026-04-08. Shipping still requires a green `Release Acceptance` run on the exact commit
that will be tagged and published.

Compatibility alias: [docs/truth-matrix.md](./truth-matrix.md)

| Contract | Status | Code / Surface | Verification |
|---|---|---|---|
| ExecutionBriefV2 is the live cross-plane brief contract | done | `founderos_contracts/brief_v2.py`, `quorum/orchestrator/brief_v2_adapter.py`, `autopilot/autopilot/core/brief_v2_adapter.py`, `autopilot/autopilot/api/routes/projects.py` | `founderos_contracts/tests/test_brief_v2.py`, `quorum/tests/test_brief_v2_adapter.py`, `autopilot/tests/test_brief_v2_ingest.py` |
| Founder approval gates block launch and resume until approved | done | `quorum/orchestrator/handoff_bridge.py`, `autopilot/autopilot/api/routes/projects.py`, `autopilot/autopilot/api/routes/execution_plane.py` | `quorum/tests/test_handoff_seam_integration.py`, `autopilot/tests/test_v2_live_launch_gate.py` |
| Approval sync no longer leaves split-brain state on downstream failure | done | `quorum/orchestrator/api.py`, `quorum/orchestrator/discovery_store.py` | `quorum/tests/test_handoff_api.py::test_founder_approval_alias_rolls_back_local_approval_when_autopilot_sync_fails` |
| Root repo publishes the pinned runtime topology and fails fast when it is incomplete | done | `README.md`, `.gitmodules`, `scripts/bootstrap_founderos_local.sh`, `scripts/run-stack.mjs` | `npm run test:release-contract` |
| Public release docs exist at canonical and compatibility paths | done | `README.md`, `CHANGELOG.md`, `CHECKLIST.md`, `docs/release-checklist.md`, `docs/truth-matrix.md`, `docs/founderos-truth-matrix.md`, `CONTRIBUTING.md`, `SECURITY.md` | `npm run test:release-contract` |
| Exact shipping commit must be green on Release Acceptance | verify | `.github/workflows/release-acceptance.yml` | run local release checks, push candidate commit, confirm green workflow before tagging |
