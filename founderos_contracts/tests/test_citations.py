"""Tests for citation/source-pack contract defaults and round-trips."""
from __future__ import annotations

from founderos_contracts.citations import Citation, ResearchSource, SourcePackManifest


def test_citation_models_roundtrip() -> None:
    source = ResearchSource(
        source_id="source-001",
        kind="web_research",
        title="Market report",
        summary="Top-line summary",
        url="https://example.com/report",
        citations=[
            Citation(
                citation_id="cit-001",
                title="Report excerpt",
                url="https://example.com/report#excerpt",
                quoted_text="Demand is increasing.",
                note="Section 4",
            )
        ],
    )
    manifest = SourcePackManifest(
        pack_id="pack-001",
        sources=[source],
        generated_at="2026-04-07T00:00:00Z",
    )

    restored = SourcePackManifest.model_validate(manifest.model_dump())

    assert restored.pack_id == "pack-001"
    assert len(restored.sources) == 1
    assert restored.sources[0].source_id == "source-001"
    assert restored.sources[0].citations[0].citation_id == "cit-001"


def test_citation_model_default_lists_are_not_shared() -> None:
    first = SourcePackManifest(pack_id="pack-a")
    second = SourcePackManifest(pack_id="pack-b")

    first.sources.append(ResearchSource(source_id="source-a", kind="repo_analysis", title="A"))

    assert second.sources == []
