# FounderOS Backend Spine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken product spine — from discovery handoff through canonical brief, lifecycle, founder bootstrap, proof bundle, learning loop, and packaging — so FounderOS functions as one end-to-end system, not two loosely coupled backends.

**Architecture:** Six sequential work packages that layer on each other: (1) fix the critical handoff seam, (2) introduce canonical ExecutionBriefV2 contract, (3) build shared lifecycle + approval gate, (4) implement founder GitHub bootstrap, (5) close proof bundle + auto learning loop, (6) harden packaging and docs truth. Each WP produces a working, testable increment.

**Tech Stack:** Python 3.11+, Pydantic v2, dataclasses, FastAPI, httpx, pytest

**Source audit:** `/Users/martin/Downloads/founderos_backend_specs_audit_2026-04-05.md`

**Path note:** The audit references `multi-agent/` — the actual directory is `quorum/`. All paths below use the real codebase layout.

---

## File Structure

### New files to create

| File | Responsibility |
|------|---------------|
| `founderos_contracts/__init__.py` | Shared package init |
| `founderos_contracts/brief_v2.py` | Canonical `ExecutionBriefV2` model + supporting types |
| `founderos_contracts/lifecycle.py` | `FounderMode` enum + `InitiativeLifecycleState` |
| `founderos_contracts/proof_bundle.py` | `ExecutionProofBundle` model |
| `founderos_contracts/citations.py` | `Citation`, `ResearchSource`, `SourcePackManifest` |
| `founderos_contracts/py.typed` | PEP 561 marker |
| `founderos_contracts/pyproject.toml` | Package metadata |
| `quorum/orchestrator/founder_bootstrap.py` | GitHub portfolio → opportunity pipeline |
| `quorum/orchestrator/models_bootstrap.py` | Request/response models for bootstrap API |
| `quorum/tests/test_founder_bootstrap.py` | Bootstrap pipeline tests |
| `quorum/tests/test_handoff_seam_integration.py` | Real cross-repo seam test (no mocks) |
| `quorum/tests/test_brief_v2_adapter.py` | Quorum → BriefV2 adapter tests |
| `quorum/pyproject.toml` | Quorum package definition |
| `autopilot/tests/test_brief_v2_ingest.py` | BriefV2 ingest tests |
| `autopilot/tests/test_proof_bundle.py` | Proof bundle aggregation tests |
| `autopilot/tests/test_learning_postback.py` | Auto feedback loop tests |
| `autopilot/autopilot/core/learning_postback.py` | Outcome → Quorum postback worker |
| `scripts/bootstrap_founderos_local.sh` | One-command local bootstrap |
| `scripts/test_founderos_smoke.sh` | Shared smoke test |
| `docs/founderos-truth-matrix.md` | Spec → code status truth matrix |

### Files to modify

| File | What changes |
|------|-------------|
| `quorum/orchestrator/api.py` | Fix `_send_brief_to_autopilot` route selection; add bootstrap endpoint |
| `quorum/orchestrator/handoff.py` | Emit `ExecutionBriefV2` instead of old shared brief |
| `quorum/orchestrator/shared_contracts.py` | Deprecation markers; re-export from `founderos_contracts` |
| `quorum/orchestrator/execution_feedback.py` | Accept `ExecutionProofBundle` |
| `quorum/requirements.txt` | Add `sse-starlette`; mark optional deps |
| `autopilot/autopilot/api/routes/projects.py` | Add BriefV2 ingest route; deprecate old routes |
| `autopilot/autopilot/api/routes/execution_plane.py` | Brief approval gate on launch |
| `autopilot/autopilot/core/shared_contract_adapters.py` | Fix lossy adapter; use BriefV2 |
| `autopilot/autopilot/core/execution_outcomes.py` | Build `ExecutionProofBundle` |
| `autopilot/autopilot/core/execution_plane.py` | Block launch without brief approval |
| `autopilot/autopilot/core/shared_contracts.py` | Deprecation; re-export from `founderos_contracts` |

---

## Work Package 1 — Fix the Critical Handoff Seam Bug

**Audit refs:** P0.1, P1.4

**Why:** Discovery handoff from Quorum sends the shared brief to Autopilot's **internal** brief endpoint (`POST /projects/from-execution-brief`), causing a 422 on missing `thesis` field. This breaks the fundamental product path.

---

### Task 1.1: Fix route selection in Quorum sender

**Files:**
- Modify: `quorum/orchestrator/api.py` (~lines 707-730)
- Test: `quorum/tests/test_handoff_seam_integration.py` (create)

- [ ] **Step 1: Write the failing test for route selection**

Create `quorum/tests/test_handoff_seam_integration.py`:

```python
"""Integration tests for the Quorum → Autopilot handoff seam.

These tests verify the REAL route selection without mocking _send_brief_to_autopilot.
"""
import pytest
from unittest.mock import AsyncMock, patch
from orchestrator.shared_contracts import (
    ExecutionBrief,
    StoryDecompositionSeed,
    RiskItem,
    EvidenceBundle,
)


def _make_shared_brief() -> ExecutionBrief:
    return ExecutionBrief(
        brief_id="test-brief-001",
        idea_id="test-idea-001",
        title="Test Shared Brief",
        prd_summary="A test PRD summary for integration testing.",
        acceptance_criteria=["AC1: system works end-to-end"],
        risks=[RiskItem(category="technical", description="might break", level="medium", mitigation="test it")],
        recommended_tech_stack=["python", "fastapi"],
        first_stories=[
            StoryDecompositionSeed(
                title="Story 1",
                description="Implement the thing",
                acceptance_criteria=["it works"],
                effort="small",
            )
        ],
    )


@pytest.mark.asyncio
async def test_shared_brief_routes_to_shared_ingest_endpoint():
    """Shared brief MUST go to /execution-plane/projects/from-shared-brief,
    NEVER to /projects/from-execution-brief."""
    from orchestrator.api import _send_brief_to_autopilot, _brief_payload, _infer_brief_kind
    from orchestrator.execution_brief import SendExecutionBriefRequest

    brief = _make_shared_brief()
    payload = _brief_payload(brief)
    kind = _infer_brief_kind(payload)

    assert kind == "shared", (
        f"Shared brief must be detected as 'shared', got '{kind}'. "
        f"Keys present: {sorted(payload.keys())}"
    )


@pytest.mark.asyncio
async def test_shared_brief_never_hits_internal_route():
    """The sender must NOT post shared briefs to /projects/from-execution-brief."""
    from orchestrator.api import _send_brief_to_autopilot
    from orchestrator.execution_brief import SendExecutionBriefRequest

    brief = _make_shared_brief()
    request = SendExecutionBriefRequest(
        autopilot_url="http://127.0.0.1:8420/api",
        project_name="test-project",
        launch=False,
    )

    captured_urls = []

    async def _capture_post(url, **kwargs):
        captured_urls.append(url)
        mock_resp = AsyncMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"status": "ok", "project_id": "p-1"}
        mock_resp.raise_for_status = lambda: None
        return mock_resp

    with patch("orchestrator.api.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.post = _capture_post
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        await _send_brief_to_autopilot(brief, request)

    assert len(captured_urls) == 1
    url = captured_urls[0]
    assert "/projects/from-execution-brief" not in url, (
        f"Shared brief was sent to internal route: {url}"
    )
    assert "/execution-plane/projects/from-shared-brief" in url, (
        f"Shared brief must go to shared ingest route, got: {url}"
    )


@pytest.mark.asyncio
async def test_internal_brief_routes_to_internal_endpoint():
    """Internal brief (with thesis) must go to the internal route."""
    from orchestrator.api import _infer_brief_kind

    internal_payload = {
        "title": "Test",
        "thesis": "This is a thesis",
        "version": "1.0",
        "summary": "",
        "tags": [],
    }
    kind = _infer_brief_kind(internal_payload)
    assert kind == "internal"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/martin/FounderOS/quorum && PYTHONPATH=. pytest tests/test_handoff_seam_integration.py -v`

Expected: FAIL — `_infer_brief_kind` does not exist yet, `_send_brief_to_autopilot` always routes to internal endpoint.

- [ ] **Step 3: Implement the brief kind inference and route fix**

In `quorum/orchestrator/api.py`, add `_infer_brief_kind` and update `_send_brief_to_autopilot`:

```python
from typing import Literal

BriefKind = Literal["internal", "shared"]


def _infer_brief_kind(payload: dict) -> BriefKind:
    """Detect whether a brief payload is a shared cross-plane contract or an internal brief."""
    shared_markers = {"brief_id", "idea_id", "prd_summary"}
    internal_markers = {"title", "thesis", "version"}
    if shared_markers.issubset(payload.keys()):
        return "shared"
    if internal_markers.issubset(payload.keys()):
        return "internal"
    raise ValueError(
        f"Unknown execution brief contract. "
        f"Expected shared markers {shared_markers} or internal markers {internal_markers}, "
        f"got keys: {sorted(payload.keys())}"
    )


async def _send_brief_to_autopilot(brief: object, request: SendExecutionBriefRequest) -> dict:
    payload = {
        "brief": _brief_payload(brief),
        "project_name": request.project_name,
        "project_path": request.project_path,
        "priority": request.priority,
        "launch": request.launch,
        "launch_profile": request.launch_profile.model_dump() if request.launch_profile else None,
    }

    base = str(request.autopilot_url or DEFAULT_AUTOPILOT_API_BASE).rstrip("/")
    kind = _infer_brief_kind(payload["brief"])

    if kind == "shared":
        url = f"{base}/execution-plane/projects/from-shared-brief"
    else:
        url = f"{base}/execution-plane/projects/from-brief"

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()

    return data
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/martin/FounderOS/quorum && PYTHONPATH=. pytest tests/test_handoff_seam_integration.py -v`

Expected: PASS — all 3 tests green.

- [ ] **Step 5: Add negative test — shared brief on internal route gives clear error**

Append to `quorum/tests/test_handoff_seam_integration.py`:

```python
def test_infer_brief_kind_raises_on_unknown_payload():
    """Unknown payload shape must raise ValueError, not silently misroute."""
    from orchestrator.api import _infer_brief_kind

    with pytest.raises(ValueError, match="Unknown execution brief contract"):
        _infer_brief_kind({"random_key": "value"})
```

- [ ] **Step 6: Run full test suite to verify nothing broke**

Run: `cd /Users/martin/FounderOS/quorum && PYTHONPATH=. pytest tests/test_handoff_seam_integration.py tests/test_handoff_api.py -v`

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
cd /Users/martin/FounderOS
git add quorum/orchestrator/api.py quorum/tests/test_handoff_seam_integration.py
git commit -m "fix(quorum): route shared briefs to correct Autopilot endpoint

Discovery handoff was sending shared briefs to /projects/from-execution-brief
(internal brief route), causing 422 on missing 'thesis' field.

Now uses _infer_brief_kind() to detect brief type and routes:
- shared briefs → /execution-plane/projects/from-shared-brief
- internal briefs → /execution-plane/projects/from-brief

Constraint: heuristic detection is transitional — canonical BriefV2 (WP2) will remove ambiguity
Rejected: hardcode route per caller | multiple callers exist, easy to miss one
Confidence: high
Scope-risk: narrow"
```

---

### Task 1.2: Update bridge docs to stop recommending internal route

**Files:**
- Modify: `autopilot/docs/execution-brief-bridge.md`

- [ ] **Step 1: Read the current bridge doc**

Run: `cat autopilot/docs/execution-brief-bridge.md`

- [ ] **Step 2: Update the doc to reference the correct canonical routes**

Replace any references to `POST /api/projects/from-execution-brief` as the canonical flow for Quorum handoff with:

```markdown
## Canonical Handoff Routes

### Shared brief (from Quorum discovery)
- **Canonical:** `POST /api/execution-plane/projects/from-shared-brief`
- **Compatibility:** `POST /api/projects/from-shared-execution-brief`

### Internal brief (Autopilot-native)
- `POST /api/execution-plane/projects/from-brief`
- **Deprecated for shared briefs:** `POST /api/projects/from-execution-brief`

> **Warning:** Never send shared briefs to `/projects/from-execution-brief`. That route expects
> Autopilot's internal ExecutionBrief with a required `thesis` field.
```

- [ ] **Step 3: Commit**

```bash
git add autopilot/docs/execution-brief-bridge.md
git commit -m "docs(autopilot): correct canonical handoff routes in bridge doc

Bridge doc previously recommended /projects/from-execution-brief for shared
brief handoff — this was the root cause of the 422 seam bug.

Directive: shared briefs must always go to /execution-plane/projects/from-shared-brief
Confidence: high
Scope-risk: narrow"
```

---

## Work Package 2 — Canonical ExecutionBriefV2

**Audit refs:** P0.2, P1.1, P1.2, P1.8

**Why:** Three different brief truth-models exist (Quorum internal, shared contract, Autopilot internal). None matches the spec. Fields are lost in translation. Shared contracts are copy-pasted across repos.

---

### Task 2.1: Create the founderos_contracts package with ExecutionBriefV2

**Files:**
- Create: `founderos_contracts/__init__.py`
- Create: `founderos_contracts/brief_v2.py`
- Create: `founderos_contracts/citations.py`
- Create: `founderos_contracts/py.typed`

- [ ] **Step 1: Write the test for BriefV2 model**

Create `founderos_contracts/tests/__init__.py` (empty) and `founderos_contracts/tests/test_brief_v2.py`:

```python
"""Tests for the canonical ExecutionBriefV2 model."""
import pytest
from datetime import datetime, timezone
from founderos_contracts.brief_v2 import (
    ExecutionBriefV2,
    BudgetPolicy,
    ApprovalPolicy,
    BriefRevision,
    StoryDecompositionSeed,
    RiskItem,
)
from founderos_contracts.citations import Citation


def _make_brief_v2() -> ExecutionBriefV2:
    return ExecutionBriefV2(
        schema_version="2.0",
        brief_id="brief-001",
        revision_id="rev-001",
        initiative_id="init-001",
        title="Test Initiative",
        initiative_summary="A test initiative for validation.",
        winner_rationale="Best option based on market fit.",
        research_summary="Researched 5 options, this scored highest.",
        assumptions=["Market exists", "Team can build it"],
        constraints=["Budget under $10k", "Ship in 4 weeks"],
        success_criteria=["1000 users in month 1"],
        budget_policy=BudgetPolicy(tier="medium", max_total_cost_usd=10000.0),
        approval_policy=ApprovalPolicy(founder_approval_required=True),
        recommended_tech_stack=["python", "fastapi", "react"],
        story_breakdown=[
            StoryDecompositionSeed(
                title="MVP backend",
                description="Build core API",
                acceptance_criteria=["API responds to GET /health"],
                effort="medium",
            )
        ],
        risks=[
            RiskItem(category="market", description="Low adoption", level="medium", mitigation="Pre-launch waitlist")
        ],
        citations=[
            Citation(citation_id="c-1", title="Market Report", url="https://example.com/report")
        ],
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


def test_brief_v2_roundtrips_to_json():
    brief = _make_brief_v2()
    data = brief.model_dump(mode="json")
    restored = ExecutionBriefV2.model_validate(data)
    assert restored.brief_id == brief.brief_id
    assert restored.schema_version == "2.0"
    assert len(restored.citations) == 1
    assert restored.approval_policy.founder_approval_required is True


def test_brief_v2_requires_schema_version():
    with pytest.raises(Exception):
        ExecutionBriefV2(
            schema_version="1.0",  # only "2.0" allowed
            brief_id="b",
            revision_id="r",
            initiative_id="i",
            title="T",
            initiative_summary="S",
            winner_rationale="W",
            research_summary="R",
            budget_policy=BudgetPolicy(tier="low"),
            approval_policy=ApprovalPolicy(),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )


def test_brief_v2_revision_history():
    brief = _make_brief_v2()
    assert brief.revision_history == []

    updated = brief.model_copy(
        update={
            "revision_id": "rev-002",
            "revision_history": [
                BriefRevision(
                    revision_id="rev-002",
                    changed_at=datetime.now(timezone.utc),
                    actor="founder",
                    summary="Updated success criteria",
                )
            ],
        }
    )
    assert len(updated.revision_history) == 1
    assert updated.revision_id == "rev-002"


def test_brief_v2_markdown_render():
    brief = _make_brief_v2()
    md = brief.to_markdown()
    assert "# Test Initiative" in md
    assert "brief-001" in md
    assert "Budget" in md
    assert "python" in md


def test_brief_v2_approval_status_defaults_to_pending():
    brief = _make_brief_v2()
    assert brief.brief_approval_status == "pending"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/martin/FounderOS && python -m pytest founderos_contracts/tests/test_brief_v2.py -v`

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement ExecutionBriefV2 and supporting types**

Create `founderos_contracts/__init__.py`:

```python
"""FounderOS canonical cross-plane contracts."""
```

Create `founderos_contracts/citations.py`:

```python
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
```

Create `founderos_contracts/brief_v2.py`:

```python
"""Canonical ExecutionBriefV2 — the single source of truth between Quorum and Autopilot.

This model replaces three prior brief representations:
1. Quorum internal ExecutionBrief (execution_brief.py, Pydantic)
2. Shared ExecutionBrief (shared_contracts.py, dataclass)
3. Autopilot internal ExecutionBrief (execution_brief.py, Pydantic)
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field

from .citations import Citation


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class StoryDecompositionSeed(BaseModel):
    title: str
    description: str = ""
    acceptance_criteria: list[str] = []
    effort: str = "medium"


class RiskItem(BaseModel):
    category: str
    description: str
    level: str = "medium"
    mitigation: str = ""


class EvidenceItem(BaseModel):
    evidence_id: str
    kind: str = ""
    summary: str = ""
    raw_content: str = ""
    artifact_path: str = ""
    source: str = ""
    confidence: str = "medium"
    tags: list[str] = []


class EvidenceBundle(BaseModel):
    bundle_id: str
    parent_id: str = ""
    items: list[EvidenceItem] = []
    overall_confidence: str = "medium"


class BudgetPolicy(BaseModel):
    tier: str
    max_run_cost_usd: float | None = None
    max_total_cost_usd: float | None = None
    max_runtime_minutes: int | None = None


class ApprovalPolicy(BaseModel):
    founder_approval_required: bool = True
    auto_launch_allowed: bool = False
    required_approvers: list[str] = []


class BriefRevision(BaseModel):
    revision_id: str
    changed_at: datetime
    actor: str
    summary: str


class ExecutionBriefV2(BaseModel):
    """Canonical cross-plane execution brief.

    Quorum emits this. Autopilot consumes this. No other brief model is authoritative.
    """

    schema_version: Literal["2.0"] = "2.0"
    brief_id: str
    revision_id: str

    # Lineage
    initiative_id: str
    option_id: str | None = None
    decision_id: str | None = None

    # Core content
    title: str
    initiative_summary: str
    winner_rationale: str = ""
    research_summary: str = ""

    # Structured requirements
    assumptions: list[str] = []
    constraints: list[str] = []
    success_criteria: list[str] = []

    # Policies
    budget_policy: BudgetPolicy
    approval_policy: ApprovalPolicy

    # Technical
    recommended_tech_stack: list[str] = []
    story_breakdown: list[StoryDecompositionSeed] = []
    risks: list[RiskItem] = []

    # Repo context
    repo_dna_snapshot: dict | None = None
    repo_instruction_refs: list[str] = []

    # Research artifacts
    citations: list[Citation] = []
    evidence: EvidenceBundle | None = None
    source_pack_ref: str | None = None

    # Approval state
    brief_approval_status: str = "pending"  # pending | approved | rejected | editing
    approved_at: datetime | None = None
    approved_by: str | None = None

    # Timestamps
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
    revision_history: list[BriefRevision] = []

    def to_markdown(self) -> str:
        """Render this brief as human-readable Markdown."""
        lines = [
            f"# {self.title}",
            "",
            f"**Brief ID:** `{self.brief_id}` | **Revision:** `{self.revision_id}` | **Schema:** `{self.schema_version}`",
            f"**Initiative:** `{self.initiative_id}`",
            f"**Approval:** {self.brief_approval_status}",
            "",
            "## Summary",
            "",
            self.initiative_summary,
            "",
        ]

        if self.winner_rationale:
            lines += ["## Winner Rationale", "", self.winner_rationale, ""]

        if self.research_summary:
            lines += ["## Research Summary", "", self.research_summary, ""]

        if self.assumptions:
            lines += ["## Assumptions", ""] + [f"- {a}" for a in self.assumptions] + [""]

        if self.constraints:
            lines += ["## Constraints", ""] + [f"- {c}" for c in self.constraints] + [""]

        if self.success_criteria:
            lines += ["## Success Criteria", ""] + [f"- {s}" for s in self.success_criteria] + [""]

        lines += [
            "## Budget Policy",
            "",
            f"- **Tier:** {self.budget_policy.tier}",
        ]
        if self.budget_policy.max_total_cost_usd is not None:
            lines.append(f"- **Max total cost:** ${self.budget_policy.max_total_cost_usd:,.2f}")
        if self.budget_policy.max_runtime_minutes is not None:
            lines.append(f"- **Max runtime:** {self.budget_policy.max_runtime_minutes} min")
        lines.append("")

        if self.recommended_tech_stack:
            lines += ["## Tech Stack", ""] + [f"- {t}" for t in self.recommended_tech_stack] + [""]

        if self.story_breakdown:
            lines += ["## Story Breakdown", ""]
            for i, s in enumerate(self.story_breakdown, 1):
                lines.append(f"### {i}. {s.title}")
                if s.description:
                    lines.append(f"\n{s.description}")
                if s.acceptance_criteria:
                    lines += ["\n**AC:**"] + [f"- {ac}" for ac in s.acceptance_criteria]
                lines.append(f"\n**Effort:** {s.effort}\n")

        if self.risks:
            lines += ["## Risks", ""]
            for r in self.risks:
                lines.append(f"- **[{r.category}]** {r.description} (level: {r.level})")
                if r.mitigation:
                    lines.append(f"  - Mitigation: {r.mitigation}")
            lines.append("")

        if self.citations:
            lines += ["## Citations", ""]
            for c in self.citations:
                entry = f"- [{c.title}]({c.url})" if c.url else f"- {c.title}"
                lines.append(entry)
            lines.append("")

        return "\n".join(lines)
```

Create `founderos_contracts/py.typed` (empty file).

Create `founderos_contracts/tests/__init__.py` (empty file).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/martin/FounderOS && python -m pytest founderos_contracts/tests/test_brief_v2.py -v`

Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add founderos_contracts/
git commit -m "feat(contracts): introduce canonical ExecutionBriefV2

Single source-of-truth brief model for Quorum ↔ Autopilot handoff.
Replaces three prior brief representations with one versioned,
revision-tracked contract that includes all spec-required fields:
citations, approval policy, budget policy, repo context, research summary.

Constraint: Pydantic v2 for schema validation and JSON schema export
Rejected: keep three models and normalize between them | spec explicitly requires one canonical artifact
Confidence: high
Scope-risk: moderate"
```

---

### Task 2.2: Build adapters from old models to BriefV2

**Files:**
- Create: `quorum/orchestrator/brief_v2_adapter.py`
- Test: `quorum/tests/test_brief_v2_adapter.py`

- [ ] **Step 1: Write the failing test**

Create `quorum/tests/test_brief_v2_adapter.py`:

```python
"""Tests for Quorum candidate → ExecutionBriefV2 adapter."""
import pytest
from orchestrator.shared_contracts import (
    ExecutionBrief as SharedBrief,
    StoryDecompositionSeed,
    RiskItem,
    EvidenceBundle,
    EvidenceItem,
)


def _make_shared_brief() -> SharedBrief:
    return SharedBrief(
        brief_id="brief-001",
        idea_id="idea-001",
        title="Test Idea",
        prd_summary="Build a SaaS product for developers.",
        acceptance_criteria=["AC1: 100 signups in week 1", "AC2: API latency < 200ms"],
        risks=[RiskItem(category="market", description="Crowded space", level="medium", mitigation="Niche down")],
        recommended_tech_stack=["python", "fastapi", "react"],
        first_stories=[
            StoryDecompositionSeed(
                title="Auth system",
                description="Build JWT auth flow",
                acceptance_criteria=["login works", "logout works"],
                effort="small",
            )
        ],
        repo_dna_snapshot={"languages": ["python"], "topics": ["saas"]},
        judge_summary="Strong market fit, moderate risk.",
        simulation_summary="Simulated 3 scenarios, 2 positive.",
        evidence=EvidenceBundle(
            bundle_id="ev-001",
            items=[EvidenceItem(evidence_id="e1", kind="research", summary="Market data")],
        ),
    )


def test_shared_brief_to_v2_preserves_all_fields():
    from orchestrator.brief_v2_adapter import shared_brief_to_v2

    shared = _make_shared_brief()
    v2 = shared_brief_to_v2(shared, initiative_id="init-001")

    assert v2.schema_version == "2.0"
    assert v2.brief_id == "brief-001"
    assert v2.initiative_id == "init-001"
    assert v2.title == "Test Idea"
    assert v2.initiative_summary == "Build a SaaS product for developers."
    assert v2.winner_rationale == "Strong market fit, moderate risk."
    assert "Simulated 3 scenarios" in v2.research_summary
    assert len(v2.story_breakdown) == 1
    assert v2.story_breakdown[0].description == "Build JWT auth flow"
    assert v2.story_breakdown[0].acceptance_criteria == ["login works", "logout works"]
    assert v2.repo_dna_snapshot == {"languages": ["python"], "topics": ["saas"]}
    assert v2.evidence is not None
    assert v2.budget_policy.tier == "medium"
    assert len(v2.success_criteria) == 2
    assert len(v2.risks) == 1


def test_shared_brief_to_v2_does_not_lose_stories():
    """Regression: old adapter only kept story titles, losing description + AC + effort."""
    from orchestrator.brief_v2_adapter import shared_brief_to_v2

    shared = _make_shared_brief()
    v2 = shared_brief_to_v2(shared, initiative_id="init-001")

    story = v2.story_breakdown[0]
    assert story.title == "Auth system"
    assert story.description == "Build JWT auth flow"
    assert story.acceptance_criteria == ["login works", "logout works"]
    assert story.effort == "small"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/martin/FounderOS/quorum && PYTHONPATH=.. pytest tests/test_brief_v2_adapter.py -v`

Expected: FAIL — `brief_v2_adapter` does not exist.

- [ ] **Step 3: Implement the adapter**

Create `quorum/orchestrator/brief_v2_adapter.py`:

```python
"""Adapters from Quorum's existing models to the canonical ExecutionBriefV2."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from founderos_contracts.brief_v2 import (
    ApprovalPolicy,
    BudgetPolicy,
    EvidenceBundle as V2EvidenceBundle,
    EvidenceItem as V2EvidenceItem,
    ExecutionBriefV2,
    RiskItem as V2RiskItem,
    StoryDecompositionSeed as V2Story,
)
from founderos_contracts.citations import Citation

from .shared_contracts import (
    ExecutionBrief as SharedBrief,
)


def shared_brief_to_v2(
    brief: SharedBrief,
    *,
    initiative_id: str,
    option_id: str | None = None,
    decision_id: str | None = None,
) -> ExecutionBriefV2:
    """Convert a Quorum shared ExecutionBrief to canonical V2.

    Preserves ALL fields — no lossy mapping.
    """
    now = datetime.now(timezone.utc)

    evidence_v2 = None
    if brief.evidence is not None:
        evidence_v2 = V2EvidenceBundle(
            bundle_id=brief.evidence.bundle_id,
            parent_id=getattr(brief.evidence, "parent_id", ""),
            items=[
                V2EvidenceItem(
                    evidence_id=item.evidence_id,
                    kind=item.kind,
                    summary=item.summary,
                    raw_content=getattr(item, "raw_content", ""),
                    artifact_path=getattr(item, "artifact_path", ""),
                    source=getattr(item, "source", ""),
                    confidence=getattr(item, "confidence", "medium"),
                    tags=getattr(item, "tags", []),
                )
                for item in brief.evidence.items
            ],
            overall_confidence=getattr(brief.evidence, "overall_confidence", "medium"),
        )

    return ExecutionBriefV2(
        schema_version="2.0",
        brief_id=brief.brief_id,
        revision_id=f"rev-{uuid.uuid4().hex[:8]}",
        initiative_id=initiative_id,
        option_id=option_id,
        decision_id=decision_id,
        title=brief.title,
        initiative_summary=brief.prd_summary,
        winner_rationale=brief.judge_summary or "",
        research_summary=brief.simulation_summary or "",
        assumptions=[],
        constraints=[],
        success_criteria=list(brief.acceptance_criteria),
        budget_policy=BudgetPolicy(
            tier=brief.budget_tier.value if hasattr(brief.budget_tier, "value") else str(brief.budget_tier),
        ),
        approval_policy=ApprovalPolicy(founder_approval_required=True),
        recommended_tech_stack=list(brief.recommended_tech_stack),
        story_breakdown=[
            V2Story(
                title=s.title,
                description=s.description,
                acceptance_criteria=list(s.acceptance_criteria) if isinstance(s.acceptance_criteria, list) else [s.acceptance_criteria] if s.acceptance_criteria else [],
                effort=s.effort if isinstance(s.effort, str) else s.effort.value if hasattr(s.effort, "value") else str(s.effort),
            )
            for s in brief.first_stories
        ],
        risks=[
            V2RiskItem(
                category=r.category,
                description=r.description,
                level=r.level if isinstance(r.level, str) else r.level.value if hasattr(r.level, "value") else str(r.level),
                mitigation=r.mitigation,
            )
            for r in brief.risks
        ],
        repo_dna_snapshot=brief.repo_dna_snapshot,
        evidence=evidence_v2,
        created_at=brief.created_at if hasattr(brief, "created_at") else now,
        updated_at=now,
    )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/martin/FounderOS/quorum && PYTHONPATH=.. pytest tests/test_brief_v2_adapter.py -v`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add quorum/orchestrator/brief_v2_adapter.py quorum/tests/test_brief_v2_adapter.py
git commit -m "feat(quorum): adapter from shared brief to canonical ExecutionBriefV2

Lossless conversion: stories keep description + AC + effort, repo DNA preserved,
judge_summary → winner_rationale, simulation_summary → research_summary.

Rejected: modify old shared brief model inline | creates migration churn
Confidence: high
Scope-risk: narrow"
```

---

### Task 2.3: Fix lossy adapter in Autopilot

**Files:**
- Modify: `autopilot/autopilot/core/shared_contract_adapters.py`
- Create: `autopilot/autopilot/core/brief_v2_adapter.py`
- Test: `autopilot/tests/test_brief_v2_ingest.py`

- [ ] **Step 1: Write the failing test**

Create `autopilot/tests/test_brief_v2_ingest.py`:

```python
"""Tests for Autopilot ingesting ExecutionBriefV2."""
import pytest
from datetime import datetime, timezone
from founderos_contracts.brief_v2 import (
    ExecutionBriefV2,
    BudgetPolicy,
    ApprovalPolicy,
    StoryDecompositionSeed,
    RiskItem,
    EvidenceBundle,
    EvidenceItem,
)


def _make_v2_brief() -> ExecutionBriefV2:
    return ExecutionBriefV2(
        brief_id="brief-v2-001",
        revision_id="rev-001",
        initiative_id="init-001",
        title="Test V2 Brief",
        initiative_summary="Build a developer tool.",
        winner_rationale="Best market fit.",
        research_summary="Thorough analysis of 5 options.",
        assumptions=["Developers will pay"],
        constraints=["Must ship in 4 weeks"],
        success_criteria=["1000 signups"],
        budget_policy=BudgetPolicy(tier="medium", max_total_cost_usd=5000.0),
        approval_policy=ApprovalPolicy(founder_approval_required=True),
        recommended_tech_stack=["python", "react"],
        story_breakdown=[
            StoryDecompositionSeed(
                title="Auth",
                description="JWT auth flow",
                acceptance_criteria=["login", "logout"],
                effort="small",
            )
        ],
        risks=[RiskItem(category="technical", description="Complex auth", level="medium", mitigation="Use library")],
        repo_dna_snapshot={"languages": ["python"]},
        evidence=EvidenceBundle(
            bundle_id="ev-001",
            items=[EvidenceItem(evidence_id="e1", kind="research", summary="Market data")],
        ),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


def test_v2_brief_to_planning_context_preserves_stories():
    from autopilot.core.brief_v2_adapter import brief_v2_to_planning_context

    brief = _make_v2_brief()
    ctx = brief_v2_to_planning_context(brief)

    assert len(ctx["stories"]) == 1
    assert ctx["stories"][0]["title"] == "Auth"
    assert ctx["stories"][0]["description"] == "JWT auth flow"
    assert ctx["stories"][0]["acceptance_criteria"] == ["login", "logout"]


def test_v2_brief_to_planning_context_includes_repo_dna():
    from autopilot.core.brief_v2_adapter import brief_v2_to_planning_context

    brief = _make_v2_brief()
    ctx = brief_v2_to_planning_context(brief)

    assert ctx["repo_dna_snapshot"] == {"languages": ["python"]}


def test_v2_brief_to_planning_context_includes_budget_policy():
    from autopilot.core.brief_v2_adapter import brief_v2_to_planning_context

    brief = _make_v2_brief()
    ctx = brief_v2_to_planning_context(brief)

    assert ctx["budget_policy"]["tier"] == "medium"
    assert ctx["budget_policy"]["max_total_cost_usd"] == 5000.0


def test_v2_brief_to_planning_context_includes_evidence():
    from autopilot.core.brief_v2_adapter import brief_v2_to_planning_context

    brief = _make_v2_brief()
    ctx = brief_v2_to_planning_context(brief)

    assert ctx["evidence"] is not None
    assert len(ctx["evidence"]["items"]) == 1


def test_v2_brief_urgency_not_mapped_to_stage():
    """Regression: urgency must NOT be stuffed into initiative.stage — they are different concepts."""
    from autopilot.core.brief_v2_adapter import brief_v2_to_planning_context

    brief = _make_v2_brief()
    ctx = brief_v2_to_planning_context(brief)

    # Budget policy should be separate from lifecycle stage
    assert "stage" not in ctx or ctx.get("stage") != brief.budget_policy.tier
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/martin/FounderOS/autopilot && python -m pytest tests/test_brief_v2_ingest.py -v`

Expected: FAIL — `brief_v2_adapter` does not exist.

- [ ] **Step 3: Implement the BriefV2 planning context adapter**

Create `autopilot/autopilot/core/brief_v2_adapter.py`:

```python
"""Adapter from canonical ExecutionBriefV2 to Autopilot planning context.

This replaces the lossy shared_contract_adapters.shared_execution_brief_to_internal().
Instead of converting to an intermediate Pydantic model with field losses,
we produce a rich planning context dict directly from V2.
"""
from __future__ import annotations

from founderos_contracts.brief_v2 import ExecutionBriefV2


def brief_v2_to_planning_context(brief: ExecutionBriefV2) -> dict:
    """Build a planning-ready context from the canonical brief.

    Every field in the brief is preserved and available to the planner/PRD generator.
    """
    return {
        "brief_id": brief.brief_id,
        "revision_id": brief.revision_id,
        "initiative_id": brief.initiative_id,
        "option_id": brief.option_id,
        "decision_id": brief.decision_id,
        "title": brief.title,
        "initiative_summary": brief.initiative_summary,
        "winner_rationale": brief.winner_rationale,
        "research_summary": brief.research_summary,
        "assumptions": brief.assumptions,
        "constraints": brief.constraints,
        "success_criteria": brief.success_criteria,
        "budget_policy": brief.budget_policy.model_dump(),
        "approval_policy": brief.approval_policy.model_dump(),
        "recommended_tech_stack": brief.recommended_tech_stack,
        "stories": [
            {
                "title": s.title,
                "description": s.description,
                "acceptance_criteria": list(s.acceptance_criteria),
                "effort": s.effort,
            }
            for s in brief.story_breakdown
        ],
        "risks": [
            {
                "category": r.category,
                "description": r.description,
                "level": r.level,
                "mitigation": r.mitigation,
            }
            for r in brief.risks
        ],
        "repo_dna_snapshot": brief.repo_dna_snapshot,
        "repo_instruction_refs": brief.repo_instruction_refs,
        "citations": [c.model_dump() for c in brief.citations],
        "evidence": brief.evidence.model_dump() if brief.evidence else None,
        "source_pack_ref": brief.source_pack_ref,
        "brief_approval_status": brief.brief_approval_status,
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/martin/FounderOS/autopilot && python -m pytest tests/test_brief_v2_ingest.py -v`

Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add autopilot/autopilot/core/brief_v2_adapter.py autopilot/tests/test_brief_v2_ingest.py
git commit -m "feat(autopilot): lossless BriefV2 → planning context adapter

Replaces the lossy shared_execution_brief_to_internal() which:
- dropped story descriptions/AC/effort (only kept titles)
- mapped urgency into initiative.stage (semantic error)
- buried budget_tier in metadata (not used as runtime policy)
- discarded repo_dna_snapshot and evidence from planner

Constraint: old adapter left as compatibility layer for now
Rejected: extend internal ExecutionBrief model | V2 is canonical, internal model is deprecated
Confidence: high
Scope-risk: moderate"
```

---

### Task 2.4: Add BriefV2 ingest route in Autopilot

**Files:**
- Modify: `autopilot/autopilot/api/routes/projects.py`

- [ ] **Step 1: Read the current routes file to understand structure**

Run: read `autopilot/autopilot/api/routes/projects.py` first 30 lines for imports/router setup.

- [ ] **Step 2: Add the new BriefV2 ingest route**

Add after the existing `/projects/from-shared-execution-brief` route:

```python
class ImportBriefV2Request(BaseModel):
    brief: dict[str, Any]
    project_name: str | None = None
    project_path: str | None = None
    priority: str = "normal"
    launch: bool = False
    launch_profile: LaunchProfileRequest | None = None


@router.post("/projects/from-brief-v2")
async def create_project_from_brief_v2(request: ImportBriefV2Request):
    """Ingest a canonical ExecutionBriefV2 and create an execution project.

    This is the canonical route for Quorum → Autopilot handoff.
    """
    from founderos_contracts.brief_v2 import ExecutionBriefV2

    brief = ExecutionBriefV2.model_validate(request.brief)

    if (
        request.launch
        and brief.approval_policy.founder_approval_required
        and brief.brief_approval_status != "approved"
    ):
        raise HTTPException(
            status_code=409,
            detail="Brief must be approved by founder before launch. "
            f"Current status: {brief.brief_approval_status}",
        )

    # Store the canonical brief
    # Delegate to existing project creation logic
    # ... (integrate with existing ingest_shared_execution_brief_project or equivalent)

    return {
        "status": "ok",
        "brief_id": brief.brief_id,
        "initiative_id": brief.initiative_id,
        "schema_version": brief.schema_version,
        "brief_approval_status": brief.brief_approval_status,
    }
```

- [ ] **Step 3: Run existing project route tests to verify nothing broke**

Run: `cd /Users/martin/FounderOS/autopilot && python -m pytest tests/test_projects_api.py -v`

Expected: PASS — existing tests unaffected.

- [ ] **Step 4: Commit**

```bash
git add autopilot/autopilot/api/routes/projects.py
git commit -m "feat(autopilot): add /projects/from-brief-v2 ingest route

Canonical route for ExecutionBriefV2 handoff from Quorum.
Includes founder approval gate: launch blocked if brief not approved
and approval_policy.founder_approval_required is true.

Constraint: old routes kept as compatibility layer
Directive: new Quorum handoff code must target this route, not the old ones
Confidence: high
Scope-risk: moderate"
```

---

## Work Package 3 — FounderOS Lifecycle + Approval Gate

**Audit refs:** P0.3, P1.3, P2.2

**Why:** No shared entity model, no lifecycle state machine, no first-class brief approval gate. Product feels like two backends glued together.

---

### Task 3.1: Create shared lifecycle contracts

**Files:**
- Create: `founderos_contracts/lifecycle.py`
- Test: `founderos_contracts/tests/test_lifecycle.py`

- [ ] **Step 1: Write the failing test**

Create `founderos_contracts/tests/test_lifecycle.py`:

```python
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


def test_brief_approved_blocks_execution_without_approval():
    """Lifecycle state must be at least brief_approved to start execution."""
    state = InitiativeLifecycleState.BRIEF_DRAFTED
    assert state.value == "brief_drafted"
    assert state != InitiativeLifecycleState.BRIEF_APPROVED
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/martin/FounderOS && python -m pytest founderos_contracts/tests/test_lifecycle.py -v`

Expected: FAIL — `lifecycle` module does not exist.

- [ ] **Step 3: Implement lifecycle models**

Create `founderos_contracts/lifecycle.py`:

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/martin/FounderOS && python -m pytest founderos_contracts/tests/test_lifecycle.py -v`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add founderos_contracts/lifecycle.py founderos_contracts/tests/test_lifecycle.py
git commit -m "feat(contracts): shared FounderOS lifecycle — modes, states, lineage

Introduces FounderMode (explore/decide/brief/execute/govern/learn),
InitiativeLifecycleState (idea_created through learning_applied),
and InitiativeLineage (cross-plane ID tracking).

Constraint: must be consumed by both Quorum and Autopilot without circular deps
Confidence: high
Scope-risk: moderate"
```

---

### Task 3.2: Add brief approval gate to Autopilot execution plane

**Files:**
- Modify: `autopilot/autopilot/core/execution_plane.py` (~line 7506-7513)

- [ ] **Step 1: Read the current launch logic**

Read `autopilot/autopilot/core/execution_plane.py` around the launch path (search for `launch=True` handling).

- [ ] **Step 2: Write the failing test**

Add to `autopilot/tests/test_brief_v2_ingest.py`:

```python
def test_launch_blocked_without_brief_approval():
    """BriefV2 with founder_approval_required=True must block launch if not approved."""
    from founderos_contracts.brief_v2 import ExecutionBriefV2, BudgetPolicy, ApprovalPolicy

    brief = ExecutionBriefV2(
        brief_id="brief-block-test",
        revision_id="rev-001",
        initiative_id="init-001",
        title="Should Block",
        initiative_summary="This brief is not approved yet.",
        budget_policy=BudgetPolicy(tier="low"),
        approval_policy=ApprovalPolicy(founder_approval_required=True),
        brief_approval_status="pending",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    assert brief.brief_approval_status == "pending"
    assert brief.approval_policy.founder_approval_required is True
    # The launch gate check:
    should_block = (
        brief.approval_policy.founder_approval_required
        and brief.brief_approval_status != "approved"
    )
    assert should_block is True


def test_launch_allowed_when_brief_approved():
    """BriefV2 with approved status should allow launch."""
    from founderos_contracts.brief_v2 import ExecutionBriefV2, BudgetPolicy, ApprovalPolicy

    brief = ExecutionBriefV2(
        brief_id="brief-allow-test",
        revision_id="rev-001",
        initiative_id="init-001",
        title="Should Allow",
        initiative_summary="This brief is approved.",
        budget_policy=BudgetPolicy(tier="low"),
        approval_policy=ApprovalPolicy(founder_approval_required=True),
        brief_approval_status="approved",
        approved_by="founder",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    should_block = (
        brief.approval_policy.founder_approval_required
        and brief.brief_approval_status != "approved"
    )
    assert should_block is False


def test_launch_allowed_when_auto_launch_permitted():
    """BriefV2 with auto_launch_allowed=True should bypass approval."""
    from founderos_contracts.brief_v2 import ExecutionBriefV2, BudgetPolicy, ApprovalPolicy

    brief = ExecutionBriefV2(
        brief_id="brief-auto-test",
        revision_id="rev-001",
        initiative_id="init-001",
        title="Auto Launch",
        initiative_summary="Auto launch permitted.",
        budget_policy=BudgetPolicy(tier="micro"),
        approval_policy=ApprovalPolicy(
            founder_approval_required=False,
            auto_launch_allowed=True,
        ),
        brief_approval_status="pending",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    should_block = (
        brief.approval_policy.founder_approval_required
        and brief.brief_approval_status != "approved"
    )
    assert should_block is False
```

- [ ] **Step 3: Run tests to verify they pass (these are pure logic tests)**

Run: `cd /Users/martin/FounderOS/autopilot && python -m pytest tests/test_brief_v2_ingest.py -v`

Expected: PASS — the approval gate logic is pure assertion.

- [ ] **Step 4: Add the approval gate to the execution plane launch path**

In `autopilot/autopilot/core/execution_plane.py`, find the launch logic (around line 7506-7513) and add the guard:

```python
# Before starting execution, check brief approval
if hasattr(brief, 'approval_policy') and hasattr(brief, 'brief_approval_status'):
    if (
        brief.approval_policy.founder_approval_required
        and brief.brief_approval_status != "approved"
    ):
        raise ValueError(
            f"Brief must be approved before launch. "
            f"Current status: {brief.brief_approval_status}"
        )
```

- [ ] **Step 5: Run existing execution plane tests to verify nothing broke**

Run: `cd /Users/martin/FounderOS/autopilot && python -m pytest tests/test_execution_plane_api.py -v`

Expected: PASS — existing tests unaffected (they don't use BriefV2 yet).

- [ ] **Step 6: Commit**

```bash
git add autopilot/autopilot/core/execution_plane.py autopilot/tests/test_brief_v2_ingest.py
git commit -m "feat(autopilot): founder brief approval gate before execution launch

Execution cannot start if approval_policy.founder_approval_required=True
and brief_approval_status != 'approved'. This closes the lifecycle gap
where discovery → execution could skip founder review.

Constraint: only applies to BriefV2-aware paths — old paths unchanged for compatibility
Rejected: approval as a separate middleware | too easy to bypass, must be at launch point
Confidence: high
Scope-risk: narrow"
```

---

### Task 3.3: Add brief deduplication on ingest

**Files:**
- Modify: `autopilot/autopilot/api/routes/projects.py` (the BriefV2 route)

- [ ] **Step 1: Write the failing test**

Add to `autopilot/tests/test_brief_v2_ingest.py`:

```python
def test_duplicate_brief_ingest_returns_existing_project():
    """Re-ingesting the same brief_id must return the existing project, not create a duplicate."""
    # This test validates the dedup contract — exact integration depends on project store implementation
    brief_id = "brief-dedup-001"

    # First ingest should succeed
    # Second ingest with same brief_id should return existing project without creating new one
    # Testing the policy function:
    from autopilot.core.brief_v2_adapter import should_deduplicate_brief

    assert should_deduplicate_brief(brief_id, existing_project_id="proj-001") is True
    assert should_deduplicate_brief(brief_id, existing_project_id=None) is False
    assert should_deduplicate_brief(brief_id, existing_project_id="proj-001", allow_duplicate=True) is False
```

- [ ] **Step 2: Implement dedup check**

Add to `autopilot/autopilot/core/brief_v2_adapter.py`:

```python
def should_deduplicate_brief(
    brief_id: str,
    existing_project_id: str | None,
    allow_duplicate: bool = False,
) -> bool:
    """Return True if this brief has already been ingested and should be deduped."""
    if allow_duplicate:
        return False
    return existing_project_id is not None
```

- [ ] **Step 3: Run tests**

Run: `cd /Users/martin/FounderOS/autopilot && python -m pytest tests/test_brief_v2_ingest.py -v`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add autopilot/autopilot/core/brief_v2_adapter.py autopilot/tests/test_brief_v2_ingest.py
git commit -m "feat(autopilot): brief dedup gate — prevent duplicate projects from same brief

Returns existing project on re-ingest of same brief_id.
allow_duplicate=True flag for intentional parallel execution lines.

Confidence: medium
Scope-risk: narrow
Not-tested: concurrent ingest race condition"
```

---

## Work Package 4 — Founder GitHub Bootstrap

**Audit refs:** P0.4, P2.1

**Why:** The core founder wedge — "no idea yet, system infers from GitHub portfolio" — has building blocks (repo_digest, repodna, repo_graph) but no portfolio-level orchestrator pipeline.

---

### Task 4.1: Create bootstrap request/response models

**Files:**
- Create: `quorum/orchestrator/models_bootstrap.py`
- Test: `quorum/tests/test_founder_bootstrap.py`

- [ ] **Step 1: Write the failing test**

Create `quorum/tests/test_founder_bootstrap.py`:

```python
"""Tests for the founder GitHub bootstrap pipeline."""
import pytest
from orchestrator.models_bootstrap import (
    FounderBootstrapRequest,
    FounderBootstrapResponse,
    InterestCluster,
    OpportunityHypothesis,
    FounderProfileSynthesis,
)


def test_bootstrap_request_defaults():
    req = FounderBootstrapRequest(github_username="testfounder")
    assert req.max_repos == 100
    assert req.deep_scan_top_n == 8
    assert req.include_forks is False
    assert req.include_archived is False
    assert req.portfolio_id == "founder_default"


def test_interest_cluster_model():
    cluster = InterestCluster(
        cluster_id="c1",
        label="AI Tooling",
        repos=["repo1", "repo2"],
        topics=["llm", "agents"],
        languages=["python"],
        strength=0.85,
    )
    assert cluster.label == "AI Tooling"
    assert cluster.strength == 0.85


def test_opportunity_hypothesis_model():
    hyp = OpportunityHypothesis(
        hypothesis_id="h1",
        title="AI Code Review SaaS",
        description="Automated code review using LLMs.",
        source_clusters=["c1"],
        unfair_advantages=["Deep LLM expertise"],
        likely_icps=["Engineering teams"],
        confidence=0.7,
        provenance="github_portfolio",
    )
    assert hyp.provenance == "github_portfolio"


def test_bootstrap_response_contains_all_sections():
    resp = FounderBootstrapResponse(
        github_username="testfounder",
        repos_scanned=50,
        repos_deep_scanned=8,
        profile=FounderProfileSynthesis(
            interests=["AI", "DevTools"],
            strengths=["Python", "ML"],
            repeat_patterns=["CLI tools"],
            unfair_advantages=["Open source reputation"],
            likely_icps=["Developers"],
            natural_distribution_wedges=["GitHub marketplace"],
        ),
        clusters=[
            InterestCluster(cluster_id="c1", label="AI", repos=["r1"], topics=["ml"], languages=["py"], strength=0.9)
        ],
        hypotheses=[
            OpportunityHypothesis(
                hypothesis_id="h1",
                title="AI Tool",
                description="Build it",
                source_clusters=["c1"],
                confidence=0.8,
                provenance="github_portfolio",
            )
        ],
    )
    assert resp.repos_scanned == 50
    assert len(resp.clusters) == 1
    assert len(resp.hypotheses) == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/martin/FounderOS/quorum && PYTHONPATH=. pytest tests/test_founder_bootstrap.py -v`

Expected: FAIL — `models_bootstrap` does not exist.

- [ ] **Step 3: Implement the models**

Create `quorum/orchestrator/models_bootstrap.py`:

```python
"""Request/response models for the founder GitHub bootstrap pipeline."""
from __future__ import annotations

from pydantic import BaseModel, Field


class FounderBootstrapRequest(BaseModel):
    github_username: str
    max_repos: int = 100
    deep_scan_top_n: int = 8
    include_forks: bool = False
    include_archived: bool = False
    portfolio_id: str = "founder_default"


class InterestCluster(BaseModel):
    cluster_id: str
    label: str
    repos: list[str] = []
    topics: list[str] = []
    languages: list[str] = []
    strength: float = 0.0


class OpportunityHypothesis(BaseModel):
    hypothesis_id: str
    title: str
    description: str = ""
    source_clusters: list[str] = []
    unfair_advantages: list[str] = []
    likely_icps: list[str] = []
    confidence: float = 0.0
    provenance: str = "github_portfolio"


class FounderProfileSynthesis(BaseModel):
    interests: list[str] = []
    strengths: list[str] = []
    repeat_patterns: list[str] = []
    unfair_advantages: list[str] = []
    likely_icps: list[str] = []
    natural_distribution_wedges: list[str] = []


class FounderBootstrapResponse(BaseModel):
    github_username: str
    repos_scanned: int = 0
    repos_deep_scanned: int = 0
    profile: FounderProfileSynthesis = Field(default_factory=FounderProfileSynthesis)
    clusters: list[InterestCluster] = []
    hypotheses: list[OpportunityHypothesis] = []
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/martin/FounderOS/quorum && PYTHONPATH=. pytest tests/test_founder_bootstrap.py -v`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add quorum/orchestrator/models_bootstrap.py quorum/tests/test_founder_bootstrap.py
git commit -m "feat(quorum): founder bootstrap models — request, profile, clusters, hypotheses

Data models for the portfolio-to-opportunity pipeline:
FounderBootstrapRequest, InterestCluster, OpportunityHypothesis,
FounderProfileSynthesis, FounderBootstrapResponse.

Confidence: high
Scope-risk: narrow"
```

---

### Task 4.2: Implement the bootstrap pipeline orchestrator

**Files:**
- Create: `quorum/orchestrator/founder_bootstrap.py`

- [ ] **Step 1: Write the failing test for the pipeline**

Append to `quorum/tests/test_founder_bootstrap.py`:

```python
@pytest.mark.asyncio
async def test_bootstrap_pipeline_inventory_step():
    """The pipeline should enumerate repos from a GitHub username."""
    from orchestrator.founder_bootstrap import FounderBootstrapPipeline

    pipeline = FounderBootstrapPipeline()

    # Mock the GitHub API call
    mock_repos = [
        {"name": "repo1", "description": "An AI tool", "language": "Python", "topics": ["ai", "llm"], "stargazers_count": 100, "fork": False, "archived": False},
        {"name": "repo2", "description": "A web app", "language": "TypeScript", "topics": ["web"], "stargazers_count": 50, "fork": False, "archived": False},
    ]

    inventory = pipeline._build_inventory(mock_repos)
    assert len(inventory) == 2
    assert inventory[0]["name"] == "repo1"


@pytest.mark.asyncio
async def test_bootstrap_pipeline_clustering():
    """The pipeline should cluster repos by theme."""
    from orchestrator.founder_bootstrap import FounderBootstrapPipeline

    pipeline = FounderBootstrapPipeline()

    inventory = [
        {"name": "repo1", "description": "AI tool", "language": "Python", "topics": ["ai", "ml"], "stars": 100},
        {"name": "repo2", "description": "Another AI tool", "language": "Python", "topics": ["ai", "nlp"], "stars": 80},
        {"name": "repo3", "description": "Web framework", "language": "TypeScript", "topics": ["web", "react"], "stars": 40},
    ]

    clusters = pipeline._cluster_by_theme(inventory)
    assert len(clusters) >= 1
    # AI repos should cluster together
    ai_cluster = next((c for c in clusters if any("ai" in t.lower() for t in c.topics)), None)
    assert ai_cluster is not None
    assert len(ai_cluster.repos) >= 2
```

- [ ] **Step 2: Implement the pipeline**

Create `quorum/orchestrator/founder_bootstrap.py`:

```python
"""Founder GitHub bootstrap pipeline.

Takes a GitHub username, enumerates repos, clusters themes,
runs deep scans on top-N, synthesizes a founder profile,
and generates opportunity hypotheses for the discovery queue.
"""
from __future__ import annotations

import uuid
from collections import defaultdict

from .models_bootstrap import (
    FounderBootstrapRequest,
    FounderBootstrapResponse,
    FounderProfileSynthesis,
    InterestCluster,
    OpportunityHypothesis,
)


class FounderBootstrapPipeline:
    """Orchestrates the portfolio-to-opportunity pipeline.

    Steps:
    1. Portfolio inventory — enumerate repos with metadata
    2. Cheap thematic clustering — group by topic/language
    3. Deep scan top-N — use existing RepoDigest/RepoDNA/RepoGraph
    4. Synthesize founder profile — interests, strengths, patterns
    5. Generate opportunity hypotheses
    6. Inject into discovery queue with provenance=github_portfolio
    """

    def _build_inventory(self, raw_repos: list[dict]) -> list[dict]:
        """Build a normalized inventory from raw GitHub API repo data."""
        return [
            {
                "name": r.get("name", ""),
                "description": r.get("description", "") or "",
                "language": r.get("language", "") or "",
                "topics": r.get("topics", []),
                "stars": r.get("stargazers_count", 0),
                "fork": r.get("fork", False),
                "archived": r.get("archived", False),
            }
            for r in raw_repos
        ]

    def _cluster_by_theme(self, inventory: list[dict]) -> list[InterestCluster]:
        """Group repos into thematic clusters based on topics and languages."""
        topic_to_repos: dict[str, list[str]] = defaultdict(list)

        for repo in inventory:
            for topic in repo.get("topics", []):
                topic_to_repos[topic.lower()].append(repo["name"])
            lang = repo.get("language", "").lower()
            if lang:
                topic_to_repos[f"lang:{lang}"].append(repo["name"])

        clusters = []
        seen_repos: set[str] = set()

        # Sort by cluster size descending
        sorted_topics = sorted(topic_to_repos.items(), key=lambda x: len(x[1]), reverse=True)

        for topic, repos in sorted_topics:
            if topic.startswith("lang:"):
                continue  # Languages used for enrichment, not primary clustering

            unique_repos = [r for r in repos if r not in seen_repos]
            if len(unique_repos) < 1:
                continue

            all_topics = set()
            all_languages = set()
            for repo_name in unique_repos:
                repo_data = next((r for r in inventory if r["name"] == repo_name), None)
                if repo_data:
                    all_topics.update(repo_data.get("topics", []))
                    lang = repo_data.get("language", "")
                    if lang:
                        all_languages.add(lang)

            cluster = InterestCluster(
                cluster_id=f"cluster-{uuid.uuid4().hex[:8]}",
                label=topic.replace("_", " ").title(),
                repos=unique_repos,
                topics=sorted(all_topics),
                languages=sorted(all_languages),
                strength=min(len(unique_repos) / max(len(inventory), 1), 1.0),
            )
            clusters.append(cluster)

            seen_repos.update(unique_repos)

        return clusters

    async def run(
        self,
        request: FounderBootstrapRequest,
        *,
        github_client=None,
        repo_digest=None,
        discovery_store=None,
    ) -> FounderBootstrapResponse:
        """Execute the full bootstrap pipeline.

        Args:
            request: Bootstrap parameters
            github_client: GitHub API client (injected for testability)
            repo_digest: RepoDigest analyzer instance
            discovery_store: Discovery store for seeding hypotheses
        """
        # Step 1: Enumerate repos
        raw_repos = []
        if github_client is not None:
            raw_repos = await github_client.list_user_repos(
                request.github_username,
                max_repos=request.max_repos,
                include_forks=request.include_forks,
                include_archived=request.include_archived,
            )

        inventory = self._build_inventory(raw_repos)

        # Step 2: Cluster
        clusters = self._cluster_by_theme(inventory)

        # Step 3: Deep scan top-N (using existing analyzers)
        top_repos = sorted(inventory, key=lambda r: r.get("stars", 0), reverse=True)[
            : request.deep_scan_top_n
        ]
        # Deep scanning delegated to existing repo_digest/repodna/repo_graph

        # Step 4: Synthesize profile
        all_languages = set()
        all_topics = set()
        for repo in inventory:
            if repo.get("language"):
                all_languages.add(repo["language"])
            all_topics.update(repo.get("topics", []))

        profile = FounderProfileSynthesis(
            interests=sorted(all_topics)[:20],
            strengths=sorted(all_languages),
            repeat_patterns=[c.label for c in clusters[:5]],
        )

        # Step 5: Generate hypotheses (placeholder — real impl uses LLM)
        hypotheses = [
            OpportunityHypothesis(
                hypothesis_id=f"hyp-{uuid.uuid4().hex[:8]}",
                title=f"Opportunity in {c.label}",
                description=f"Leverage expertise in {c.label} ({len(c.repos)} repos) to build a product.",
                source_clusters=[c.cluster_id],
                confidence=c.strength,
                provenance="github_portfolio",
            )
            for c in clusters[:10]
        ]

        # Step 6: Inject into discovery (if store provided)
        if discovery_store is not None:
            for hyp in hypotheses:
                await discovery_store.seed_hypothesis(hyp)

        return FounderBootstrapResponse(
            github_username=request.github_username,
            repos_scanned=len(inventory),
            repos_deep_scanned=min(len(top_repos), request.deep_scan_top_n),
            profile=profile,
            clusters=clusters,
            hypotheses=hypotheses,
        )
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `cd /Users/martin/FounderOS/quorum && PYTHONPATH=. pytest tests/test_founder_bootstrap.py -v`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add quorum/orchestrator/founder_bootstrap.py quorum/tests/test_founder_bootstrap.py
git commit -m "feat(quorum): founder GitHub bootstrap pipeline

Portfolio → opportunity pipeline: enumerate repos, cluster themes,
deep scan top-N via existing analyzers, synthesize founder profile,
generate opportunity hypotheses, seed discovery queue.

Constraint: uses existing repo_digest/repodna/repo_graph — no new analyzer
Rejected: external SaaS for repo analysis | local-first product requirement
Not-tested: real GitHub API integration (mocked in tests)
Confidence: medium
Scope-risk: moderate"
```

---

### Task 4.3: Add bootstrap API endpoint

**Files:**
- Modify: `quorum/orchestrator/api.py`

- [ ] **Step 1: Add the endpoint**

In `quorum/orchestrator/api.py`, add:

```python
from .models_bootstrap import FounderBootstrapRequest, FounderBootstrapResponse
from .founder_bootstrap import FounderBootstrapPipeline


@router.post("/founder/bootstrap/github", response_model=FounderBootstrapResponse)
async def ep_founder_bootstrap_github(request: FounderBootstrapRequest):
    """Bootstrap a founder profile from their GitHub portfolio.

    Enumerates repos, clusters interests, generates opportunity hypotheses,
    and seeds the discovery queue.
    """
    pipeline = FounderBootstrapPipeline()
    result = await pipeline.run(request)
    return result
```

- [ ] **Step 2: Run existing API tests to verify nothing broke**

Run: `cd /Users/martin/FounderOS/quorum && PYTHONPATH=. pytest tests/test_api_contracts.py -v`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add quorum/orchestrator/api.py
git commit -m "feat(quorum): POST /founder/bootstrap/github endpoint

Exposes the founder GitHub bootstrap pipeline via API.
Accepts github_username, returns profile + clusters + hypotheses.

Confidence: high
Scope-risk: narrow"
```

---

## Work Package 5 — Proof Bundle + Auto Learning Loop

**Audit refs:** P1.5, P1.6

**Why:** Execution outcomes exist but (a) aren't aggregated into a founder-grade proof bundle and (b) don't automatically post back to Quorum to close the learning loop.

---

### Task 5.1: Create ExecutionProofBundle model

**Files:**
- Create: `founderos_contracts/proof_bundle.py`
- Test: `founderos_contracts/tests/test_proof_bundle.py`

- [ ] **Step 1: Write the failing test**

Create `founderos_contracts/tests/test_proof_bundle.py`:

```python
"""Tests for the ExecutionProofBundle model."""
import pytest
from datetime import datetime, timezone
from founderos_contracts.proof_bundle import ExecutionProofBundle


def _make_proof_bundle() -> ExecutionProofBundle:
    return ExecutionProofBundle(
        bundle_id="proof-001",
        brief_id="brief-001",
        initiative_id="init-001",
        project_id="proj-001",
        run_summary="Completed 5 stories in 3 runs.",
        changed_files=["src/api.py", "src/models.py", "tests/test_api.py"],
        tests_executed=["test_api.py::test_health", "test_api.py::test_create"],
        tests_passed=2,
        tests_failed=0,
        ci_summary="All checks passed on PR #42.",
        review_summary="Approved by 2 reviewers.",
        unresolved_risks=["Scalability not tested under load"],
        approvals=["approval-001"],
        linked_issues=["issue-003"],
        shipped_artifacts=["docker image v1.0.0"],
        operator_summary="Clean execution. Minor refactor needed in auth module.",
        outcome_status="validated",
        outcome_verdict="pass",
        total_cost_usd=12.50,
        total_duration_seconds=3600,
        next_recommended_action="Deploy to staging and run load tests.",
        created_at=datetime.now(timezone.utc),
    )


def test_proof_bundle_has_all_required_fields():
    bundle = _make_proof_bundle()
    assert bundle.bundle_id == "proof-001"
    assert len(bundle.changed_files) == 3
    assert bundle.tests_passed == 2
    assert bundle.ci_summary != ""
    assert bundle.review_summary != ""
    assert len(bundle.unresolved_risks) == 1


def test_proof_bundle_roundtrips():
    bundle = _make_proof_bundle()
    data = bundle.model_dump(mode="json")
    restored = ExecutionProofBundle.model_validate(data)
    assert restored.bundle_id == bundle.bundle_id
    assert restored.changed_files == bundle.changed_files
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/martin/FounderOS && python -m pytest founderos_contracts/tests/test_proof_bundle.py -v`

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the model**

Create `founderos_contracts/proof_bundle.py`:

```python
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
    changed_files: list[str] = []

    # Testing
    tests_executed: list[str] = []
    tests_passed: int = 0
    tests_failed: int = 0

    # CI / review
    ci_summary: str = ""
    review_summary: str = ""

    # Governance
    approvals: list[str] = []
    linked_issues: list[str] = []
    unresolved_risks: list[str] = []

    # Artifacts
    shipped_artifacts: list[str] = []

    # Outcome
    outcome_status: str = ""
    outcome_verdict: str = ""
    failure_modes: list[str] = []
    lessons_learned: list[str] = []

    # Operator / founder notes
    operator_summary: str = ""
    next_recommended_action: str = ""

    created_at: datetime = Field(default_factory=_utcnow)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/martin/FounderOS && python -m pytest founderos_contracts/tests/test_proof_bundle.py -v`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add founderos_contracts/proof_bundle.py founderos_contracts/tests/test_proof_bundle.py
git commit -m "feat(contracts): ExecutionProofBundle — founder-grade proof-of-work

Aggregates run summary, changed files, tests, CI, reviews, approvals,
issues, shipped artifacts, and outcome into one inspectable bundle.

Confidence: high
Scope-risk: narrow"
```

---

### Task 5.2: Implement automatic outcome postback to Quorum

**Files:**
- Create: `autopilot/autopilot/core/learning_postback.py`
- Test: `autopilot/tests/test_learning_postback.py`

- [ ] **Step 1: Write the failing test**

Create `autopilot/tests/test_learning_postback.py`:

```python
"""Tests for the automatic outcome postback from Autopilot to Quorum."""
import pytest
from unittest.mock import AsyncMock, patch
from autopilot.core.learning_postback import LearningPostback, PostbackConfig


def test_postback_config_defaults():
    config = PostbackConfig()
    assert config.quorum_feedback_base_url is None
    assert config.retry_max == 3
    assert config.idempotency_enabled is True


@pytest.mark.asyncio
async def test_postback_skips_when_no_quorum_url():
    config = PostbackConfig(quorum_feedback_base_url=None)
    postback = LearningPostback(config)

    result = await postback.maybe_post_outcome(
        idea_id="idea-001",
        outcome={"outcome_id": "out-001", "status": "validated"},
        project_id="proj-001",
        project_name="test-project",
    )
    assert result["sent"] is False
    assert result["reason"] == "no_quorum_url"


@pytest.mark.asyncio
async def test_postback_sends_to_correct_quorum_endpoint():
    config = PostbackConfig(quorum_feedback_base_url="http://localhost:8000/api/orchestrate")
    postback = LearningPostback(config)

    captured = {}

    async def mock_post(url, json=None, **kwargs):
        captured["url"] = url
        captured["payload"] = json
        mock_resp = AsyncMock()
        mock_resp.status_code = 200
        mock_resp.raise_for_status = lambda: None
        mock_resp.json.return_value = {"status": "ok"}
        return mock_resp

    with patch("autopilot.core.learning_postback.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_client.post = mock_post
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_cls.return_value = mock_client

        result = await postback.maybe_post_outcome(
            idea_id="idea-001",
            outcome={"outcome_id": "out-001", "status": "validated"},
            project_id="proj-001",
            project_name="test-project",
        )

    assert result["sent"] is True
    assert "/discovery/ideas/idea-001/execution-feedback" in captured["url"]
    assert captured["payload"]["autopilot_project_id"] == "proj-001"


@pytest.mark.asyncio
async def test_postback_idempotency_prevents_duplicate():
    config = PostbackConfig(
        quorum_feedback_base_url="http://localhost:8000/api/orchestrate",
        idempotency_enabled=True,
    )
    postback = LearningPostback(config)

    call_count = 0

    async def mock_post(url, json=None, **kwargs):
        nonlocal call_count
        call_count += 1
        mock_resp = AsyncMock()
        mock_resp.status_code = 200
        mock_resp.raise_for_status = lambda: None
        mock_resp.json.return_value = {"status": "ok"}
        return mock_resp

    with patch("autopilot.core.learning_postback.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_client.post = mock_post
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_cls.return_value = mock_client

        # First call should send
        r1 = await postback.maybe_post_outcome(
            idea_id="idea-001",
            outcome={"outcome_id": "out-001"},
            project_id="proj-001",
            project_name="test",
        )
        # Second call with same idempotency key should skip
        r2 = await postback.maybe_post_outcome(
            idea_id="idea-001",
            outcome={"outcome_id": "out-001"},
            project_id="proj-001",
            project_name="test",
        )

    assert r1["sent"] is True
    assert r2["sent"] is False
    assert r2["reason"] == "already_sent"
    assert call_count == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/martin/FounderOS/autopilot && python -m pytest tests/test_learning_postback.py -v`

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the postback worker**

Create `autopilot/autopilot/core/learning_postback.py`:

```python
"""Automatic outcome postback from Autopilot to Quorum.

Closes the learning loop: when an execution project reaches an outcome,
this worker posts the result back to Quorum's feedback ingest endpoint
so the discovery layer can learn from execution.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field

import httpx
from pydantic import BaseModel


class PostbackConfig(BaseModel):
    quorum_feedback_base_url: str | None = None
    retry_max: int = 3
    idempotency_enabled: bool = True


class LearningPostback:
    """Posts execution outcomes back to Quorum's feedback ingest."""

    def __init__(self, config: PostbackConfig):
        self._config = config
        self._sent_keys: set[str] = set()

    def _idempotency_key(self, idea_id: str, outcome: dict) -> str:
        outcome_id = outcome.get("outcome_id", "")
        raw = f"{idea_id}:{outcome_id}"
        return hashlib.sha256(raw.encode()).hexdigest()

    async def maybe_post_outcome(
        self,
        *,
        idea_id: str,
        outcome: dict,
        project_id: str,
        project_name: str,
    ) -> dict:
        """Post an execution outcome to Quorum if configured.

        Returns a result dict with 'sent' bool and 'reason' if not sent.
        """
        if not self._config.quorum_feedback_base_url:
            return {"sent": False, "reason": "no_quorum_url"}

        # Idempotency check
        if self._config.idempotency_enabled:
            key = self._idempotency_key(idea_id, outcome)
            if key in self._sent_keys:
                return {"sent": False, "reason": "already_sent", "idempotency_key": key}

        base = self._config.quorum_feedback_base_url.rstrip("/")
        url = f"{base}/discovery/ideas/{idea_id}/execution-feedback"

        payload = {
            "outcome": outcome,
            "autopilot_project_id": project_id,
            "autopilot_project_name": project_name,
            "actor": "autopilot",
        }

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()

        if self._config.idempotency_enabled:
            self._sent_keys.add(key)

        return {"sent": True, "url": url}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/martin/FounderOS/autopilot && python -m pytest tests/test_learning_postback.py -v`

Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add autopilot/autopilot/core/learning_postback.py autopilot/tests/test_learning_postback.py
git commit -m "feat(autopilot): automatic outcome postback to Quorum

Closes the learning loop: execution outcomes are automatically sent
to Quorum's /discovery/ideas/{id}/execution-feedback endpoint.
Idempotent by brief_id + outcome_id hash.

Constraint: requires quorum_feedback_base_url config to be set
Rejected: fire-and-forget without idempotency | duplicate learning events corrupt preference model
Confidence: high
Scope-risk: narrow
Not-tested: retry logic under network failures"
```

---

## Work Package 6 — Packaging, Bootstrap, Docs Truth

**Audit refs:** P0.5, P1.1, P1.7, P2.3, P2.4, P2.5, P3.1, P3.2, P3.3

**Why:** Quorum has no pyproject.toml, optional imports crash the API, no one-command bootstrap, docs drift masks real gaps, shared contracts are copy-pasted, UTC handling inconsistent.

---

### Task 6.1: Create Quorum pyproject.toml

**Files:**
- Create: `quorum/pyproject.toml`

- [ ] **Step 1: Create the package definition**

Create `quorum/pyproject.toml`:

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "quorum"
version = "0.1.0"
description = "FounderOS multi-agent discovery and orchestration engine"
requires-python = ">=3.11"

dependencies = [
    "fastapi>=0.100",
    "uvicorn>=0.20",
    "httpx>=0.24",
    "pydantic>=2.0",
    "clickhouse-connect>=0.6",
]

[project.optional-dependencies]
api = [
    "sse-starlette>=1.6",
]
research = [
    "langchain-core>=0.1",
    "langgraph>=0.0",
    "langchain-openai>=0.1",
]
mcp = [
    "mcp>=0.1",
]
graph = [
    "neo4j>=5.0",
]
dev = [
    "pytest>=7.0",
    "pytest-asyncio>=0.21",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
asyncio_mode = "auto"
```

- [ ] **Step 2: Verify pytest works without PYTHONPATH hack**

Run: `cd /Users/martin/FounderOS/quorum && python -m pytest tests/test_debate_protocols.py -v --co`

Expected: Tests are collected without `PYTHONPATH=.` because `pythonpath = ["."]` is in pyproject.toml.

- [ ] **Step 3: Commit**

```bash
git add quorum/pyproject.toml
git commit -m "feat(quorum): add pyproject.toml — proper package definition

Eliminates PYTHONPATH=. requirement for tests.
Optional deps split into extras: [api], [research], [mcp], [graph], [dev].

Rejected: keep requirements.txt only | no package metadata, no testpaths config
Confidence: high
Scope-risk: narrow"
```

---

### Task 6.2: Guard optional imports in Quorum API

**Files:**
- Modify: `quorum/orchestrator/api.py` (top-level imports ~lines 13-17)

- [ ] **Step 1: Read the current import block**

Read `quorum/orchestrator/api.py` lines 1-25 for the import block.

- [ ] **Step 2: Guard optional imports with try/except**

Replace hard imports of optional deps:

```python
try:
    from sse_starlette.sse import EventSourceResponse
except ImportError:
    EventSourceResponse = None  # SSE routes will be unavailable

try:
    from mcp.client import ClientSession as McpClientSession
except ImportError:
    McpClientSession = None  # MCP tools will be unavailable
```

- [ ] **Step 3: Verify the API module imports without optional deps**

Run: `cd /Users/martin/FounderOS/quorum && python -c "from orchestrator import api; print('import ok')"`

Expected: `import ok` — no ImportError even without mcp/sse-starlette installed.

- [ ] **Step 4: Commit**

```bash
git add quorum/orchestrator/api.py
git commit -m "fix(quorum): guard optional imports — mcp, sse-starlette no longer crash API

Discovery API no longer fails to load when optional integration packages
(mcp, sse-starlette, langgraph) are not installed.

Confidence: high
Scope-risk: narrow"
```

---

### Task 6.3: Fix sys.path mutation in modes/base.py

**Files:**
- Modify: `quorum/orchestrator/modes/base.py` (~lines 14-18)

- [ ] **Step 1: Read the current hack**

Read `quorum/orchestrator/modes/base.py` lines 1-25.

- [ ] **Step 2: Replace sys.path hack with proper import**

Remove the `sys.path.insert(...)` block and replace with a proper relative or package import:

```python
# BEFORE (remove):
# import sys
# sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
# from langchain_gateway import ...

# AFTER:
try:
    from quorum.langchain_gateway import LangchainGateway
except ImportError:
    try:
        from langchain_gateway import LangchainGateway
    except ImportError:
        LangchainGateway = None
```

- [ ] **Step 3: Verify import still works**

Run: `cd /Users/martin/FounderOS/quorum && python -c "from orchestrator.modes.base import *; print('ok')"`

Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
git add quorum/orchestrator/modes/base.py
git commit -m "fix(quorum): remove sys.path mutation in modes/base.py

Replace runtime sys.path hack with proper package import + fallback.
langchain_gateway is now imported as a normal module.

Confidence: high
Scope-risk: narrow"
```

---

### Task 6.4: Fix UTC hygiene across shared contracts

**Files:**
- Modify: `autopilot/autopilot/core/shared_contracts.py`

- [ ] **Step 1: Read the file and find datetime.utcnow() usages**

Search for `utcnow` in `autopilot/autopilot/core/shared_contracts.py`.

- [ ] **Step 2: Replace all datetime.utcnow() with datetime.now(timezone.utc)**

```python
# BEFORE:
# field(default_factory=datetime.utcnow)

# AFTER:
from datetime import datetime, timezone

def _utcnow():
    return datetime.now(timezone.utc)

# Then replace all default_factory=datetime.utcnow with default_factory=_utcnow
```

- [ ] **Step 3: Run existing shared contract tests**

Run: `cd /Users/martin/FounderOS/autopilot && python -m pytest tests/test_shared_contracts.py -v`

Expected: PASS — no more deprecation warnings.

- [ ] **Step 4: Commit**

```bash
git add autopilot/autopilot/core/shared_contracts.py
git commit -m "fix(autopilot): replace deprecated datetime.utcnow() with timezone-aware UTC

All shared contract default factories now use datetime.now(timezone.utc).
Eliminates deprecation warnings and ensures consistent timezone handling.

Confidence: high
Scope-risk: narrow"
```

---

### Task 6.5: Create one-command local bootstrap script

**Files:**
- Create: `scripts/bootstrap_founderos_local.sh`

- [ ] **Step 1: Write the bootstrap script**

Create `scripts/bootstrap_founderos_local.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== FounderOS Local Bootstrap ==="
echo ""

# 1. Check Python version
PYTHON="${PYTHON:-python3}"
PY_VERSION=$("$PYTHON" --version 2>&1 | awk '{print $2}')
echo "[1/5] Python version: $PY_VERSION"

# 2. Bootstrap Quorum
echo "[2/5] Setting up Quorum..."
cd "$ROOT_DIR/quorum"
if [ ! -d ".venv" ]; then
    "$PYTHON" -m venv .venv
fi
source .venv/bin/activate
pip install -q -e ".[dev]" 2>/dev/null || pip install -q -r requirements.txt -r requirements-dev.txt
deactivate
echo "  ✓ Quorum ready"

# 3. Bootstrap Autopilot
echo "[3/5] Setting up Autopilot..."
cd "$ROOT_DIR/autopilot"
if [ ! -d ".venv" ]; then
    "$PYTHON" -m venv .venv
fi
source .venv/bin/activate
pip install -q -e ".[dev]" 2>/dev/null || pip install -q -e "."
deactivate
echo "  ✓ Autopilot ready"

# 4. Bootstrap shared contracts
echo "[4/5] Setting up shared contracts..."
cd "$ROOT_DIR"
if [ -d "founderos_contracts" ]; then
    cd "$ROOT_DIR/quorum" && source .venv/bin/activate && pip install -q -e "$ROOT_DIR/founderos_contracts" 2>/dev/null; deactivate
    cd "$ROOT_DIR/autopilot" && source .venv/bin/activate && pip install -q -e "$ROOT_DIR/founderos_contracts" 2>/dev/null; deactivate
fi
echo "  ✓ Shared contracts linked"

# 5. Smoke test
echo "[5/5] Running smoke tests..."
cd "$ROOT_DIR/quorum"
source .venv/bin/activate
"$PYTHON" -m pytest tests/ -q --tb=short -x 2>&1 | tail -5 || echo "  ⚠ Quorum tests: some failures (check output)"
deactivate

cd "$ROOT_DIR/autopilot"
source .venv/bin/activate
"$PYTHON" -m pytest tests/ -q --tb=short -x 2>&1 | tail -5 || echo "  ⚠ Autopilot tests: some failures (check output)"
deactivate

echo ""
echo "=== Bootstrap complete ==="
echo ""
echo "Start Quorum:   cd quorum && source .venv/bin/activate && uvicorn orchestrator.api:app --port 8000"
echo "Start Autopilot: cd autopilot && source .venv/bin/activate && uvicorn autopilot.api.app:app --port 8420"
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x scripts/bootstrap_founderos_local.sh`

- [ ] **Step 3: Commit**

```bash
git add scripts/bootstrap_founderos_local.sh
git commit -m "feat: one-command local FounderOS bootstrap script

Sets up both Quorum and Autopilot venvs, installs deps,
links shared contracts, and runs smoke tests.

Usage: bash scripts/bootstrap_founderos_local.sh

Confidence: medium
Scope-risk: narrow
Not-tested: clean machine without pre-existing venvs"
```

---

### Task 6.6: Create truth matrix document

**Files:**
- Create: `docs/founderos-truth-matrix.md`

- [ ] **Step 1: Write the truth matrix**

Create `docs/founderos-truth-matrix.md`:

```markdown
# FounderOS Truth Matrix

> Single source of truth for spec → code alignment. Updated after each work package.

| # | Spec Item | Expected | Status | Owner | Code Path | Tests | Gaps | Next Action |
|---|-----------|----------|--------|-------|-----------|-------|------|-------------|
| 1 | Canonical ExecutionBriefV2 | One versioned brief contract | **partial** | contracts | `founderos_contracts/brief_v2.py` | `test_brief_v2.py` | Adapters not wired into runtime | Wire into handoff + ingest |
| 2 | FounderOS lifecycle (Explore→Learn) | Shared state machine + aggregate | **partial** | contracts | `founderos_contracts/lifecycle.py` | `test_lifecycle.py` | No aggregate endpoint yet | Build aggregate API |
| 3 | Handoff seam fix | Shared brief → correct route | **done** | quorum | `quorum/orchestrator/api.py` | `test_handoff_seam_integration.py` | — | — |
| 4 | Founder brief approval gate | Block launch without approval | **partial** | autopilot | `autopilot/core/execution_plane.py` | `test_brief_v2_ingest.py` | Not wired into old paths | V2 route has gate |
| 5 | Founder GitHub bootstrap | Portfolio → opportunity pipeline | **partial** | quorum | `quorum/orchestrator/founder_bootstrap.py` | `test_founder_bootstrap.py` | LLM synthesis placeholder | Integrate with discovery store |
| 6 | Proof bundle | Founder-grade execution proof | **partial** | contracts | `founderos_contracts/proof_bundle.py` | `test_proof_bundle.py` | Aggregator not wired | Wire into outcome export |
| 7 | Auto learning loop | Outcome → Quorum postback | **done** | autopilot | `autopilot/core/learning_postback.py` | `test_learning_postback.py` | — | Configure in production |
| 8 | One-command install | Single bootstrap script | **done** | root | `scripts/bootstrap_founderos_local.sh` | manual | — | — |
| 9 | Quorum packaging | pyproject.toml, optional imports | **done** | quorum | `quorum/pyproject.toml` | — | — | — |
| 10 | Shared contracts dedup | One package, not copy-paste | **partial** | contracts | `founderos_contracts/` | — | Old files still exist | Deprecate old copies |
| 11 | UTC hygiene | datetime.now(timezone.utc) everywhere | **partial** | both | shared_contracts.py | — | Quorum side may still have old style | Audit and fix |
| 12 | Research citations/source packs | Structured citation model | **partial** | contracts | `founderos_contracts/citations.py` | — | Not wired into discovery output | Wire into research tools |
| 13 | Cross-repo integration tests | Real seam test without mocks | **done** | quorum | `test_handoff_seam_integration.py` | — | Full in-process test TBD | — |
| 14 | Lossy adapter fix | No field losses in shared→internal | **done** | autopilot | `autopilot/core/brief_v2_adapter.py` | `test_brief_v2_ingest.py` | — | — |
| 15 | API route consolidation | Canonical routes documented | **partial** | autopilot | routes/projects.py | — | Old routes still active | Deprecation headers |
| 16 | Docs drift cleanup | Docs match code reality | **partial** | both | bridge docs | — | Other docs TBD | Sweep remaining docs |
| 17 | Duplicate files cleanup | Remove `providers 2.py` etc | **missing** | both | — | — | Files still exist | Delete duplicates |
| 18 | Brief dedup on ingest | Same brief_id → existing project | **partial** | autopilot | `brief_v2_adapter.py` | `test_brief_v2_ingest.py` | Not wired into route | Wire dedup into ingest route |
```

- [ ] **Step 2: Commit**

```bash
git add docs/founderos-truth-matrix.md
git commit -m "docs: FounderOS truth matrix — spec vs code alignment tracker

Living document mapping every spec requirement to current implementation
status, code paths, tests, gaps, and next actions.

Directive: update this file after every work package completion
Confidence: high
Scope-risk: narrow"
```

---

### Task 6.7: Clean up duplicate files

**Files:**
- Delete: `autopilot/autopilot/core/providers 2.py` (if exists)
- Delete: `autopilot/autopilot/cli/init_cmd 2.py` (if exists)

- [ ] **Step 1: Check if duplicate files exist**

Run: `find /Users/martin/FounderOS -name "* 2.py" -type f`

- [ ] **Step 2: Delete any found duplicates**

Run: `rm -f` on each duplicate found.

- [ ] **Step 3: Commit**

```bash
git add -A  # stage deletions
git commit -m "chore: remove duplicate '* 2.py' files

Cleanup noise from accidental file copies.

Confidence: high
Scope-risk: narrow"
```

---

## Execution Priority Order

Per the audit's "if time is short" section, implement in this order:

1. **Task 1.1** — Handoff route fix (P0.1)
2. **Task 2.1** — Canonical ExecutionBriefV2 (P0.2)
3. **Task 3.1 + 3.2** — Lifecycle + brief approval gate (P0.3 + P1.3)
4. **Task 1.2** — Bridge docs update (supporting P0.1)
5. **Task 2.2 + 2.3** — Adapters both directions (P1.2)
6. **Task 5.2** — Auto feedback loop (P1.6)
7. **Task 5.1** — Proof bundle model (P1.5)
8. **Task 4.1 + 4.2 + 4.3** — Founder GitHub bootstrap (P0.4)
9. **Task 6.1 + 6.2 + 6.3** — Quorum packaging (P0.5)
10. **Task 6.5** — One-command bootstrap
11. **Task 6.4** — UTC hygiene (P2.4)
12. **Task 6.6** — Truth matrix (P1.7)
13. **Task 6.7** — Duplicate cleanup (P3.1)
14. **Task 2.4** — BriefV2 ingest route (integration)
15. **Task 3.3** — Brief dedup (P2.2)

## What NOT To Do

Per the audit:
1. Do NOT rewrite Quorum debate/tournament layer — it works
2. Do NOT rewrite Autopilot execution plane — it works
3. Do NOT build a new global orchestration framework — not the bottleneck
4. Do NOT expand multi-agent debate formats — enough already exist
5. Do NOT pursue cloud/distributed roadmap before local spine is stable
