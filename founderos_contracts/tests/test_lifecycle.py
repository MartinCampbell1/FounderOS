"""Tests for FounderOS shared lifecycle model."""
import pytest
from founderos_contracts.lifecycle import (
    FounderMode,
    InitiativeLifecycleState,
    InitiativeLineage,
)


def test_founder_modes_match_spec():
    assert set(FounderMode) == {
        FounderMode.EXPLORE,
        FounderMode.DECIDE,
        FounderMode.BRIEF,
        FounderMode.EXECUTE,
        FounderMode.GOVERN,
        FounderMode.LEARN,
    }


def test_lifecycle_states_follow_spec_order():
    states = list(InitiativeLifecycleState)
    expected_order = [
        "idea_created",
        "options_researched",
        "winner_selected",
        "brief_drafted",
        "brief_approved",
        "execution_started",
        "issues_or_approvals_open",
        "outcome_emitted",
        "learning_applied",
    ]
    assert [s.value for s in states] == expected_order


def test_initiative_lineage_tracks_all_ids():
    lineage = InitiativeLineage(
        initiative_id="init-001",
        option_id="opt-001",
        decision_id="dec-001",
        brief_id="brief-001",
        project_id="proj-001",
    )
    assert lineage.initiative_id == "init-001"
    assert lineage.outcome_id is None


def test_initiative_lineage_defaults():
    lineage = InitiativeLineage(initiative_id="init-002")
    assert lineage.lifecycle_state == InitiativeLifecycleState.IDEA_CREATED
    assert lineage.current_mode == FounderMode.EXPLORE
    assert lineage.option_id is None
    assert lineage.brief_id is None


def test_lineage_roundtrips_to_json():
    lineage = InitiativeLineage(
        initiative_id="init-003",
        lifecycle_state=InitiativeLifecycleState.BRIEF_APPROVED,
        current_mode=FounderMode.EXECUTE,
    )
    data = lineage.model_dump(mode="json")
    restored = InitiativeLineage.model_validate(data)
    assert restored.initiative_id == "init-003"
    assert restored.lifecycle_state == InitiativeLifecycleState.BRIEF_APPROVED
    assert restored.current_mode == FounderMode.EXECUTE
