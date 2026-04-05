# FounderOS Truth Matrix

> Single source of truth for spec → code alignment.
> **Rule:** `done` only when feature works on live-path, in real repo layout, confirmed by integration/smoke test.

| # | Spec Item | Status | Code Path | Tests | Next Action |
|---|-----------|--------|-----------|-------|-------------|
| 1 | Canonical ExecutionBriefV2 | done | `founderos_contracts/brief_v2.py`, `quorum/orchestrator/brief_v2_adapter.py`, `autopilot/core/execution_plane.py` | `test_brief_v2.py`, `test_brief_v2_adapter.py`, `test_brief_v2_ingest.py` | — |
| 2 | FounderOS lifecycle | done | `founderos_contracts/lifecycle.py`, `autopilot/core/initiative_lineage.py`, `autopilot/core/execution_outcomes.py` — lineage transitions through OUTCOME_EMITTED and LEARNING_APPLIED via dispatch callback | `test_lifecycle.py`, `test_execution_outcomes_api.py` | — |
| 3 | Handoff seam fix | done | `quorum/orchestrator/handoff_bridge.py` — shared briefs route through V2; business errors (409/422/503) passed through | `test_handoff_seam_integration.py` | — |
| 4 | Founder approval gate | done | Ingest: `_check_brief_approval_gate` first in `ingest_execution_brief_v2_project`. Re-launch: `raise_if_founder_approval_missing_for_project` in `/launch` and `/resume` routes | `test_v2_live_launch_gate.py` (9 tests: ingest gate, re-launch gate, resume gate, no-artifacts, dedup, legacy containment) | — |
| 5 | Founder GitHub bootstrap | done | `quorum/orchestrator/founder_bootstrap.py`, `quorum/orchestrator/api.py` — fail-fast on missing `GITHUB_TOKEN` (503) | `test_founder_bootstrap.py`, `test_founder_bootstrap_route.py` | — |
| 6 | Proof bundle | done | `autopilot/core/execution_outcomes.py:build_execution_proof_bundle()` uses unified `brief_metadata.get_execution_brief_project_metadata` for V2+shared lookup | `test_v2_outcome_chain.py`, `test_execution_outcomes_api.py` | — |
| 7 | Auto learning loop | done | `autopilot/core/learning_postback.py:dispatch_learning_postback` — sync-safe dispatch with `on_success` callback for lineage | `test_learning_postback.py` (no RuntimeWarnings) | — |
| 8 | One-command install | done | `scripts/bootstrap_founderos_local.sh` — installs `[dev,api]` for Autopilot, runs import smoke | bootstrap smoke | — |
| 9 | Quorum packaging | done | `quorum/pyproject.toml` — bootstrap installs `.[dev,api,research,mcp,graph]` | — | — |
| 10 | Shared contracts dedup | done | `founderos_contracts/shared_v1.py` canonical; Quorum/Autopilot copies are re-export shims | — | Delete shims after all importers migrate |
| 11 | UTC hygiene | done | `founderos_contracts/shared_v1.py` | — | — |
| 12 | Research citations | partial | `founderos_contracts/citations.py` | — | Wire into research pipeline |
| 13 | Cross-repo seam tests | done | `test_handoff_seam_integration.py` — route selection, approval gate, business error passthrough (8 tests) | `test_handoff_seam_integration.py` | — |
| 14 | Lossy adapter fix | done | `autopilot/core/shared_contract_adapters.py` — `stage` now `"brief_drafted"` | `test_brief_v2_ingest.py` | — |
| 15 | Brief dedup on ingest | done | `should_deduplicate_brief` called in `ingest_execution_brief_v2_project` before project creation | `test_v2_live_launch_gate.py::test_v2_route_rejects_duplicate_brief_ingest` | — |
| 16 | Docs drift cleanup | done | Truth matrix updated with conservative statuses after audit v3 | — | — |
| 17 | Duplicate files cleanup | done | macOS `._*` in `.gitignore`, no tracked artifacts | — | — |
| 18 | `founderos_contracts` packaging | done | `founderos_contracts/pyproject.toml` | `test_packaging_smoke.py` | — |
| 19 | Initiative lineage aggregate | done | `autopilot/core/initiative_lineage.py`, `GET /api/founderos/initiatives/{id}` | `test_execution_outcomes_api.py` | — |
| 20 | Founder approval workflow (Quorum-side) | done | `POST /founder/approval/{idea_id}/approve` and `/reject` route through `discovery_store.update_execution_brief_candidate_approval` with audit trail | `test_founder_approval_workflow.py` | — |
| 21 | Business error passthrough | done | `quorum/orchestrator/api.py` project action helper + `handoff_bridge.py` both pass through 400/409/422/503 | `test_handoff_seam_integration.py::test_upstream_business_errors_pass_through` | — |
| 22 | V2 downstream chain | done | `autopilot/core/brief_metadata.py` unified helper checks V2 first, then shared; used by `find_project_by_execution_brief_id`, outcome/proof routes | `test_v2_outcome_chain.py` (3 tests) | — |
