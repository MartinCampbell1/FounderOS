"""Tests for legacy shared V1 contract timestamp semantics."""
from __future__ import annotations

from datetime import datetime, timezone

from founderos_contracts.brief_v2 import ApprovalPolicy, BudgetPolicy, ExecutionBriefV2
from founderos_contracts.shared_v1 import (
    ExecutionBrief,
    RiskItem,
    RiskLevel,
    StoryDecompositionSeed,
    from_jsonable,
)


def _make_v1_brief(**overrides) -> ExecutionBrief:
    defaults = dict(
        brief_id="brief-001",
        idea_id="idea-001",
        title="Shared brief",
        prd_summary="Keep V1 timestamps aligned with V2.",
        acceptance_criteria=["aware UTC only"],
        risks=[RiskItem(category="timing", description="Mixed timezone semantics", level=RiskLevel.HIGH)],
        recommended_tech_stack=["python"],
        first_stories=[
            StoryDecompositionSeed(
                title="Normalize timestamps",
                description="Accept legacy naive input but store aware UTC.",
                acceptance_criteria=["aware datetimes", "legacy payload compatibility"],
            )
        ],
    )
    defaults.update(overrides)
    return ExecutionBrief(**defaults)


def _make_v2_brief() -> ExecutionBriefV2:
    return ExecutionBriefV2(
        schema_version="2.0",
        brief_id="brief-002",
        revision_id="rev-001",
        initiative_id="initiative-001",
        title="Execution brief",
        initiative_summary="Cross-plane timestamps should compare directly.",
        budget_policy=BudgetPolicy(tier="low"),
        approval_policy=ApprovalPolicy(),
    )


def test_shared_v1_defaults_use_aware_utc() -> None:
    brief = _make_v1_brief()

    assert brief.created_at.tzinfo == timezone.utc


def test_shared_v1_roundtrip_promotes_legacy_naive_utc_to_aware() -> None:
    payload = {
        "brief_id": "brief-legacy",
        "idea_id": "idea-legacy",
        "title": "Legacy brief",
        "prd_summary": "Stored before aware UTC migration.",
        "acceptance_criteria": ["legacy compatibility"],
        "risks": [{"category": "migration", "description": "naive timestamp", "level": "low"}],
        "recommended_tech_stack": ["python"],
        "first_stories": [
            {
                "title": "Migrate timestamps",
                "description": "Treat naive values as UTC.",
                "acceptance_criteria": ["no mixed datetime semantics"],
            }
        ],
        "created_at": "2026-04-06T12:34:56",
    }

    brief = from_jsonable(ExecutionBrief, payload)

    assert brief.created_at == datetime(2026, 4, 6, 12, 34, 56, tzinfo=timezone.utc)


def test_shared_v1_timestamps_compare_with_v2_without_type_error() -> None:
    v1_brief = _make_v1_brief()
    v2_brief = _make_v2_brief()

    ordered = sorted([v1_brief.created_at, v2_brief.created_at])

    assert len(ordered) == 2
