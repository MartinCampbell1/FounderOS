"""Citation and research source models for FounderOS discovery artifacts."""
from pydantic import BaseModel, Field


class Citation(BaseModel):
    citation_id: str
    title: str
    url: str = ""
    source_type: str = ""
    quoted_text: str = ""
    note: str = ""


class ResearchSource(BaseModel):
    source_id: str
    kind: str  # "repo_analysis", "web_research", "debate_output", "simulation"
    title: str
    summary: str = ""
    url: str = ""
    citations: list[Citation] = Field(default_factory=list)


class SourcePackManifest(BaseModel):
    pack_id: str
    sources: list[ResearchSource] = Field(default_factory=list)
    generated_at: str = ""
