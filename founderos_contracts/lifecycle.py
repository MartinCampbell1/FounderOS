"""FounderOS shared lifecycle — modes, states, and entity lineage.

These are the cross-plane contracts that both Quorum and Autopilot use
to track where an initiative is in its lifecycle.
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class FounderMode(str, Enum):
    """The five product modes + learning."""

    EXPLORE = "explore"
    DECIDE = "decide"
    BRIEF = "brief"
    EXECUTE = "execute"
    GOVERN = "govern"
    LEARN = "learn"


class InitiativeLifecycleState(str, Enum):
    """Ordered lifecycle states for an initiative."""

    IDEA_CREATED = "idea_created"
    OPTIONS_RESEARCHED = "options_researched"
    WINNER_SELECTED = "winner_selected"
    BRIEF_DRAFTED = "brief_drafted"
    BRIEF_APPROVED = "brief_approved"
    EXECUTION_STARTED = "execution_started"
    ISSUES_OR_APPROVALS_OPEN = "issues_or_approvals_open"
    OUTCOME_EMITTED = "outcome_emitted"
    LEARNING_APPLIED = "learning_applied"


class InitiativeLineage(BaseModel):
    """Cross-plane ID lineage for one initiative.

    Every entity in the FounderOS pipeline traces back to this lineage.
    """

    initiative_id: str
    option_id: str | None = None
    decision_id: str | None = None
    brief_id: str | None = None
    project_id: str | None = None
    outcome_id: str | None = None

    lifecycle_state: InitiativeLifecycleState = InitiativeLifecycleState.IDEA_CREATED
    current_mode: FounderMode = FounderMode.EXPLORE

    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
