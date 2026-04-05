"""Packaging / import smoke tests.

Validates P0.4 audit requirement: shared contracts are importable as a
proper Python package, and critical modules can be loaded without errors.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def test_founderos_contracts_brief_v2_importable():
    """founderos_contracts.brief_v2.ExecutionBriefV2 can be imported."""
    from founderos_contracts.brief_v2 import ExecutionBriefV2
    assert ExecutionBriefV2 is not None


def test_founderos_contracts_lifecycle_importable():
    """founderos_contracts.lifecycle is importable."""
    from founderos_contracts.lifecycle import (
        FounderMode,
        InitiativeLifecycleState,
        InitiativeLineage,
    )
    assert len(FounderMode) == 6
    assert len(InitiativeLifecycleState) == 9


def test_founderos_contracts_proof_bundle_importable():
    """founderos_contracts.proof_bundle is importable."""
    from founderos_contracts.proof_bundle import ExecutionProofBundle
    assert ExecutionProofBundle is not None


def test_founderos_contracts_citations_importable():
    """founderos_contracts.citations is importable."""
    from founderos_contracts.citations import Citation, ResearchSource, SourcePackManifest
    assert Citation is not None


def test_founderos_contracts_shared_v1_importable():
    """founderos_contracts.shared_v1 is importable and re-exports all types."""
    from founderos_contracts.shared_v1 import (
        Confidence,
        ExecutionBrief,
        ExecutionOutcomeBundle,
        from_jsonable,
        to_jsonable,
    )
    assert Confidence.HIGH.value == "high"


def test_shared_v1_brief_roundtrip():
    """V1 ExecutionBrief round-trips through to_jsonable/from_jsonable."""
    from founderos_contracts.shared_v1 import (
        ExecutionBrief,
        RiskItem,
        RiskLevel,
        StoryDecompositionSeed,
        from_jsonable,
        to_jsonable,
    )

    brief = ExecutionBrief(
        brief_id="smoke-001",
        idea_id="idea-001",
        title="Smoke test brief",
        prd_summary="Testing round-trip",
        acceptance_criteria=["works"],
        risks=[RiskItem(category="test", description="Test risk", level=RiskLevel.LOW)],
        recommended_tech_stack=["python"],
        first_stories=[
            StoryDecompositionSeed(
                title="Story 1",
                description="Do something",
                acceptance_criteria=["done"],
            )
        ],
    )

    payload = to_jsonable(brief)
    assert isinstance(payload, dict)
    assert payload["brief_id"] == "smoke-001"

    restored = from_jsonable(ExecutionBrief, payload)
    assert restored.brief_id == brief.brief_id
    assert restored.title == brief.title
    assert len(restored.risks) == 1
    assert restored.risks[0].level.value == "low"


def test_founderos_contracts_installs_into_fresh_venv(tmp_path):
    """Editable install works from a clean virtualenv, not just the current worktree path."""
    package_root = Path(__file__).resolve().parents[1]
    venv_dir = tmp_path / "venv"

    subprocess.run([sys.executable, "-m", "venv", str(venv_dir)], check=True)
    python_bin = venv_dir / "bin" / "python"

    subprocess.run(
        [str(python_bin), "-m", "pip", "install", "-e", str(package_root)],
        check=True,
        cwd=str(tmp_path),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    subprocess.run(
        [
            str(python_bin),
            "-c",
            (
                "from founderos_contracts.brief_v2 import ExecutionBriefV2; "
                "from founderos_contracts.proof_bundle import ExecutionProofBundle; "
                "assert ExecutionBriefV2 is not None and ExecutionProofBundle is not None"
            ),
        ],
        check=True,
        cwd=str(tmp_path),
    )
