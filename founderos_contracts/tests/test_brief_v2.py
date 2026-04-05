"""Tests for ExecutionBriefV2 canonical contract."""
from __future__ import annotations

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from founderos_contracts.brief_v2 import (
    ApprovalPolicy,
    BriefRevision,
    BudgetPolicy,
    ExecutionBriefV2,
    RiskItem,
    StoryDecompositionSeed,
)
from founderos_contracts.citations import Citation


def _make_brief(**overrides) -> ExecutionBriefV2:
    defaults = dict(
        schema_version="2.0",
        brief_id="brief-001",
        revision_id="rev-001",
        initiative_id="init-001",
        title="Autonomous Invoicing Agent",
        initiative_summary="Build an AI agent that generates and sends invoices automatically.",
        winner_rationale="Lowest cost, highest automation coverage.",
        research_summary="Market analysis shows 40% of SMBs lack automated invoicing.",
        assumptions=["Stripe is available", "Email delivery works"],
        constraints=["Budget capped at $500/month", "Must launch in 6 weeks"],
        success_criteria=["Invoice accuracy >= 99%", "Zero manual interventions in week 2"],
        budget_policy=BudgetPolicy(
            tier="standard",
            max_run_cost_usd=10.0,
            max_total_cost_usd=500.0,
            max_runtime_minutes=60,
        ),
        approval_policy=ApprovalPolicy(
            founder_approval_required=True,
            auto_launch_allowed=False,
            required_approvers=["founder@example.com"],
        ),
        recommended_tech_stack=["Python", "FastAPI", "Stripe SDK"],
        story_breakdown=[
            StoryDecompositionSeed(
                title="Invoice generation",
                description="Generate PDF invoices from order data.",
                acceptance_criteria=["PDF is valid", "Data matches order"],
                effort="S",
            )
        ],
        risks=[
            RiskItem(
                category="Technical",
                description="Stripe API rate limits may block bulk sending.",
                level="medium",
                mitigation="Use batch endpoints and exponential backoff.",
            )
        ],
        citations=[
            Citation(
                citation_id="cit-001",
                title="SMB Invoicing Report 2025",
                url="https://example.com/report",
                note="Key market data",
            )
        ],
    )
    defaults.update(overrides)
    return ExecutionBriefV2(**defaults)


def test_brief_v2_roundtrips_to_json() -> None:
    brief = _make_brief()
    raw = brief.model_dump()
    restored = ExecutionBriefV2.model_validate(raw)

    assert restored.brief_id == brief.brief_id
    assert restored.title == brief.title
    assert restored.schema_version == "2.0"
    assert restored.budget_policy.tier == "standard"
    assert restored.approval_policy.founder_approval_required is True
    assert len(restored.story_breakdown) == 1
    assert restored.story_breakdown[0].title == "Invoice generation"
    assert len(restored.risks) == 1
    assert len(restored.citations) == 1
    assert restored.citations[0].citation_id == "cit-001"
    assert restored.assumptions == brief.assumptions
    assert restored.constraints == brief.constraints
    assert restored.success_criteria == brief.success_criteria


def test_brief_v2_requires_schema_version_2() -> None:
    with pytest.raises(ValidationError) as exc_info:
        _make_brief(schema_version="1.0")
    errors = exc_info.value.errors()
    assert any("schema_version" in str(e) or "literal" in str(e).lower() for e in errors)


def test_brief_v2_revision_history() -> None:
    original = _make_brief()
    assert original.revision_history == []

    new_revision = BriefRevision(
        revision_id="rev-002",
        changed_at=datetime.now(timezone.utc),
        actor="founder@example.com",
        summary="Updated success criteria after customer interviews.",
    )
    updated = original.model_copy(
        update={
            "revision_id": "rev-002",
            "revision_history": [new_revision],
            "success_criteria": ["Invoice accuracy >= 99.5%"],
        }
    )

    assert updated.revision_id == "rev-002"
    assert len(updated.revision_history) == 1
    assert updated.revision_history[0].revision_id == "rev-002"
    assert updated.revision_history[0].actor == "founder@example.com"
    # Original is unchanged (immutability)
    assert original.revision_id == "rev-001"
    assert original.revision_history == []


def test_brief_v2_markdown_render() -> None:
    brief = _make_brief()
    md = brief.to_markdown()

    assert "# Autonomous Invoicing Agent" in md
    assert "## Summary" in md
    assert "## Rationale" in md
    assert "## Research" in md
    assert "## Assumptions" in md
    assert "## Constraints" in md
    assert "## Success Criteria" in md
    assert "## Budget" in md
    assert "## Tech Stack" in md
    assert "## Stories" in md
    assert "## Risks" in md
    assert "## Citations" in md
    assert "Invoice generation" in md
    assert "SMB Invoicing Report 2025" in md
    assert "Stripe" in md


def test_brief_v2_approval_status_defaults_to_pending() -> None:
    brief = _make_brief()
    assert brief.brief_approval_status == "pending"
    assert brief.approved_at is None
    assert brief.approved_by is None
