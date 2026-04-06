"""Founder-grade execution proof bundle.

Aggregates execution outcomes, changed files, tests, CI, reviews,
approvals, and issues into one inspectable artifact.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ExecutionProofBundle(BaseModel):
    """Complete founder-facing proof-of-work for one execution project."""

    bundle_id: str
    brief_id: str
    initiative_id: str
    project_id: str

    # Run summary
    run_summary: str = ""
    total_cost_usd: float = 0.0
    total_duration_seconds: float = 0.0

    # Changed files / diffs
    changed_files: list[str] = Field(default_factory=list)

    # Testing
    tests_executed: list[str] = Field(default_factory=list)
    tests_passed: int = 0
    tests_failed: int = 0

    # CI / review
    ci_summary: str = ""
    review_summary: str = ""

    # Governance
    approvals: list[str] = Field(default_factory=list)
    linked_issues: list[str] = Field(default_factory=list)
    unresolved_risks: list[str] = Field(default_factory=list)

    # Artifacts
    shipped_artifacts: list[str] = Field(default_factory=list)

    # Outcome
    outcome_status: str = ""
    outcome_verdict: str = ""
    failure_modes: list[str] = Field(default_factory=list)
    lessons_learned: list[str] = Field(default_factory=list)

    # Operator / founder notes
    operator_summary: str = ""
    next_recommended_action: str = ""

    created_at: datetime = Field(default_factory=_utcnow)
