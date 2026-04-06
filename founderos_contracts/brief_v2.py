"""ExecutionBriefV2 — canonical cross-plane execution contract for FounderOS."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field

from .citations import Citation


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class StoryDecompositionSeed(BaseModel):
    title: str
    description: str
    acceptance_criteria: list[str] = Field(default_factory=list)
    effort: str = ""


class RiskItem(BaseModel):
    category: str
    description: str
    level: str
    mitigation: str = ""


class EvidenceItem(BaseModel):
    evidence_id: str
    kind: str
    summary: str
    raw_content: str = ""
    artifact_path: str = ""
    source: str = ""
    confidence: float = 0.0
    tags: list[str] = Field(default_factory=list)


class EvidenceBundle(BaseModel):
    bundle_id: str
    parent_id: str
    items: list[EvidenceItem] = Field(default_factory=list)
    overall_confidence: float = 0.0


class BudgetPolicy(BaseModel):
    tier: str
    max_run_cost_usd: float | None = None
    max_total_cost_usd: float | None = None
    max_runtime_minutes: int | None = None


class ApprovalPolicy(BaseModel):
    founder_approval_required: bool = True
    auto_launch_allowed: bool = False
    required_approvers: list[str] = Field(default_factory=list)


class BriefRevision(BaseModel):
    revision_id: str
    changed_at: datetime
    actor: str
    summary: str = ""


class ExecutionBriefV2(BaseModel):
    schema_version: Literal["2.0"]
    brief_id: str
    revision_id: str

    # Lineage
    initiative_id: str
    option_id: str | None = None
    decision_id: str | None = None

    # Content
    title: str
    initiative_summary: str
    winner_rationale: str = ""
    research_summary: str = ""

    # Requirements
    assumptions: list[str] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)
    success_criteria: list[str] = Field(default_factory=list)

    # Policies
    budget_policy: BudgetPolicy
    approval_policy: ApprovalPolicy

    # Technical
    recommended_tech_stack: list[str] = Field(default_factory=list)
    story_breakdown: list[StoryDecompositionSeed] = Field(default_factory=list)
    risks: list[RiskItem] = Field(default_factory=list)

    # Repo
    repo_dna_snapshot: dict | None = None
    repo_instruction_refs: list[str] = Field(default_factory=list)

    # Research
    citations: list[Citation] = Field(default_factory=list)
    evidence: EvidenceBundle | None = None
    source_pack_ref: str | None = None

    # Approval state
    brief_approval_status: str = "pending"
    approved_at: datetime | None = None
    approved_by: str | None = None

    # Timestamps
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)

    revision_history: list[BriefRevision] = Field(default_factory=list)

    def to_markdown(self) -> str:
        lines: list[str] = []

        lines.append(f"# {self.title}")
        lines.append("")
        lines.append(
            f"**Brief ID:** `{self.brief_id}` | "
            f"**Revision:** `{self.revision_id}` | "
            f"**Schema:** `{self.schema_version}`"
        )
        lines.append(f"**Initiative:** `{self.initiative_id}`")
        lines.append(f"**Approval:** {self.brief_approval_status}")
        lines.append("")

        lines.append("## Summary")
        lines.append(self.initiative_summary)
        lines.append("")

        if self.winner_rationale:
            lines.append("## Rationale")
            lines.append(self.winner_rationale)
            lines.append("")

        if self.research_summary:
            lines.append("## Research")
            lines.append(self.research_summary)
            lines.append("")

        if self.assumptions:
            lines.append("## Assumptions")
            for item in self.assumptions:
                lines.append(f"- {item}")
            lines.append("")

        if self.constraints:
            lines.append("## Constraints")
            for item in self.constraints:
                lines.append(f"- {item}")
            lines.append("")

        if self.success_criteria:
            lines.append("## Success Criteria")
            for item in self.success_criteria:
                lines.append(f"- {item}")
            lines.append("")

        lines.append("## Budget")
        lines.append(f"- Tier: {self.budget_policy.tier}")
        if self.budget_policy.max_run_cost_usd is not None:
            lines.append(f"- Max run cost: ${self.budget_policy.max_run_cost_usd:.2f}")
        if self.budget_policy.max_total_cost_usd is not None:
            lines.append(f"- Max total cost: ${self.budget_policy.max_total_cost_usd:.2f}")
        if self.budget_policy.max_runtime_minutes is not None:
            lines.append(f"- Max runtime: {self.budget_policy.max_runtime_minutes} minutes")
        lines.append("")

        if self.recommended_tech_stack:
            lines.append("## Tech Stack")
            for item in self.recommended_tech_stack:
                lines.append(f"- {item}")
            lines.append("")

        if self.story_breakdown:
            lines.append("## Stories")
            for story in self.story_breakdown:
                lines.append(f"### {story.title}")
                lines.append(story.description)
                if story.acceptance_criteria:
                    lines.append("**Acceptance Criteria:**")
                    for ac in story.acceptance_criteria:
                        lines.append(f"- {ac}")
                if story.effort:
                    lines.append(f"**Effort:** {story.effort}")
                lines.append("")

        if self.risks:
            lines.append("## Risks")
            for risk in self.risks:
                lines.append(f"### {risk.category} ({risk.level})")
                lines.append(risk.description)
                if risk.mitigation:
                    lines.append(f"**Mitigation:** {risk.mitigation}")
                lines.append("")

        if self.citations:
            lines.append("## Citations")
            for citation in self.citations:
                ref = f"- [{citation.title}]({citation.url})" if citation.url else f"- {citation.title}"
                if citation.note:
                    ref += f" — {citation.note}"
                lines.append(ref)
            lines.append("")

        return "\n".join(lines)
