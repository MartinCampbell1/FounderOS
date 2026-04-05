"""Tests for ExecutionProofBundle contract."""
from __future__ import annotations

from founderos_contracts.proof_bundle import ExecutionProofBundle


def _make_bundle(**overrides) -> ExecutionProofBundle:
    defaults = dict(
        bundle_id="bundle-001",
        brief_id="brief-001",
        initiative_id="init-001",
        project_id="proj-001",
        run_summary="All stories shipped.",
        total_cost_usd=1.23,
        total_duration_seconds=300.0,
        changed_files=["src/main.py", "src/utils.py"],
        tests_executed=["test_main", "test_utils"],
        tests_passed=5,
        tests_failed=0,
        ci_summary="CI green",
        review_summary="Approved by reviewer",
        approvals=["alice"],
        linked_issues=["GH-42"],
        unresolved_risks=[],
        shipped_artifacts=["dist/app.tar.gz"],
        outcome_status="completed",
        outcome_verdict="success",
        failure_modes=[],
        lessons_learned=["Use typed config"],
        operator_summary="Smooth execution.",
        next_recommended_action="Monitor for 48h",
    )
    defaults.update(overrides)
    return ExecutionProofBundle(**defaults)


def test_proof_bundle_has_all_required_fields() -> None:
    bundle = _make_bundle()

    assert bundle.bundle_id == "bundle-001"
    assert bundle.brief_id == "brief-001"
    assert bundle.initiative_id == "init-001"
    assert bundle.project_id == "proj-001"
    assert bundle.run_summary == "All stories shipped."
    assert bundle.total_cost_usd == 1.23
    assert bundle.total_duration_seconds == 300.0
    assert bundle.changed_files == ["src/main.py", "src/utils.py"]
    assert bundle.tests_executed == ["test_main", "test_utils"]
    assert bundle.tests_passed == 5
    assert bundle.tests_failed == 0
    assert bundle.ci_summary == "CI green"
    assert bundle.review_summary == "Approved by reviewer"
    assert bundle.approvals == ["alice"]
    assert bundle.linked_issues == ["GH-42"]
    assert bundle.unresolved_risks == []
    assert bundle.shipped_artifacts == ["dist/app.tar.gz"]
    assert bundle.outcome_status == "completed"
    assert bundle.outcome_verdict == "success"
    assert bundle.failure_modes == []
    assert bundle.lessons_learned == ["Use typed config"]
    assert bundle.operator_summary == "Smooth execution."
    assert bundle.next_recommended_action == "Monitor for 48h"
    assert bundle.created_at is not None


def test_proof_bundle_roundtrips() -> None:
    original = _make_bundle()
    dumped = original.model_dump()
    restored = ExecutionProofBundle.model_validate(dumped)

    assert restored.bundle_id == original.bundle_id
    assert restored.brief_id == original.brief_id
    assert restored.initiative_id == original.initiative_id
    assert restored.project_id == original.project_id
    assert restored.total_cost_usd == original.total_cost_usd
    assert restored.total_duration_seconds == original.total_duration_seconds
    assert restored.changed_files == original.changed_files
    assert restored.tests_passed == original.tests_passed
    assert restored.tests_failed == original.tests_failed
    assert restored.outcome_status == original.outcome_status
    assert restored.outcome_verdict == original.outcome_verdict
    assert restored.lessons_learned == original.lessons_learned
    assert restored.created_at == original.created_at
