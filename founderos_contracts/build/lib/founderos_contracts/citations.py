"""Citation and research source models for FounderOS discovery artifacts."""
from pydantic import BaseModel


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
    citations: list[Citation] = []


class SourcePackManifest(BaseModel):
    pack_id: str
    sources: list[ResearchSource] = []
    generated_at: str = ""
