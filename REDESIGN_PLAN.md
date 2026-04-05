# FounderOS Complete Redesign Plan

**Date:** 2026-04-05
**Status:** Research complete, ready for implementation
**Design target:** Linear.app quality and UX patterns

---

## Problem Statement

The current FounderOS frontend exposes ~20% of the actual product functionality. The sidebar has 7 flat items while the backend (Quorum + Autopilot) provides 200+ API endpoints covering Sessions, Discovery Ideas, Simulations, Ranking, Research, Repo Intelligence, Improvement Lab, Control Plane, Accounts, Capabilities, and more. None of this is accessible from the UI.

The design quality is also far below Linear's standard — verbose descriptions, DevOps-style metric cards, and slow loading.

---

## 1. Navigation Redesign

### Current sidebar (7 items):
```
Dashboard
Inbox
---
Review
Discovery
Execution
Portfolio
---
Settings
```

### Target sidebar (Linear-style with collapsible sections):
```
Dashboard
Inbox

Discovery ▾
  Sessions          (multi-agent orchestration sessions)
  Ideas             (idea pipeline, dossiers)
  Board             (finals, archive, simulations)
  Ranking           (leaderboard, pairwise comparisons)
  Swipe Queue       (tinder-like idea evaluation)
  Research          (source scanning, observations)
  Authoring         (idea creation/editing)

Execution ▾
  Projects          (all projects with status)
  Intake            (conversational project creation)
  Control Plane     (runtime agents, approvals, issues)
  Handoffs          (shadow audits, quarantine)

Portfolio
Review

Intelligence ▾     (NEW - Quorum capabilities)
  Repo Analysis     (RepoDNA, repo graphs)
  Improvement Lab   (self-play, prompt evolution)
  Observability     (traces, scoreboards, replays)

Configuration ▾
  Settings          (preferences, theme)
  Accounts          (CLI profiles, provider health)
  Capabilities      (connectors, tools, plugins)
  Tools             (MCP tools, guardrails)
```

### Implementation approach:
- Modify `lib/navigation.ts` to add all new NAV_ITEMS with collapsible sections
- Modify `unified-shell-frame.tsx` sidebar to render collapsible groups
- Each nav item links to its route (most routes already exist)
- New routes needed: Research, Repo Analysis, Improvement Lab, Accounts, Capabilities, Tools, Swipe Queue, Control Plane

---

## 2. Page-by-Page Design Specs

### Dashboard
**Current:** 5 stat numbers + session/project lists
**Target:** Linear's project overview style
- Connection status (Quorum/Autopilot) as small dots
- Key numbers in a clean grid: Active sessions, Running projects, Open inbox items, Ideas in pipeline
- Recent activity feed (unified from both planes)
- Quick action buttons: New session, New project, Open inbox
- No verbose descriptions, no "pulse" sections

### Discovery > Sessions
**Current:** Flat session list with search
**Target:** Linear's issue list style
- Table view: Session name | Mode | Status | Created | Duration
- Click to open session detail (real-time conversation monitor)
- "New session" button → wizard to pick mode + agents + task
- Session detail: real-time message stream, pause/resume controls, checkpoint branching

### Discovery > Ideas
**Current:** Not properly accessible
**Target:** Linear's issue detail style
- Idea list with: Title | Stage | Rank | Belief score | Updated
- Click for dossier view: Evidence, Risk analysis, Market fit, Simulation results
- Actions: Swipe (pass/maybe/yes/now), Generate brief, Send to Autopilot

### Discovery > Board
**Current:** Has sub-routes but verbose design
**Target:** Kanban-like board with columns: Simulated | Debated | Handed off | Executed
- Cards showing idea title, rank, stage
- Finals tab, Archive tab, Simulations tab

### Discovery > Ranking
**Current:** Not in sidebar
**Target:** Leaderboard table
- Rank | Idea title | ELO score | Win rate | Matches
- "Compare next pair" button for pairwise evaluation
- MAP-Elites archive view

### Discovery > Swipe Queue
**Current:** Not in sidebar
**Target:** Card-based swipe interface
- One idea at a time, card with key info
- Actions: Pass, Maybe, Yes, Now
- Maybe queue accessible separately

### Discovery > Research
**Current:** Not exposed at all
**Target:** Clean list view
- Observations list with source, date, content preview
- Search across observations
- Daily queue view
- "Run scan" action

### Execution > Projects
**Current:** Flat project list
**Target:** Linear's project list
- Table: Project name | Status | Stories (done/total) | Priority | Last activity
- Click for project detail: Story kanban, timeline, cost, runtime control
- Progress bar per project

### Execution > Intake
**Current:** Has route but sparse UI
**Target:** Chat-like interface
- Conversational flow to define project
- Provider/runtime selection
- Import spec or execution brief buttons
- Generate PRD from conversation

### Execution > Control Plane
**Current:** Not exposed
**Target:** Operator dashboard
- Runtime agents list with status, recommendations
- Pending approvals queue
- Open issues with severity
- Tool permission requests
- Orchestrator sessions

### Portfolio
**Current:** Simplified cards
**Target:** Lifecycle funnel view
- Table/list: Idea → Brief → Project → Outcome
- Status indicators at each stage
- Filter by lifecycle stage
- Aggregate metrics per item

### Inbox
**Current:** Partially cleaned up
**Target:** Linear's inbox/notification style
- Unified list from both planes
- Filters: All, Discovery, Execution, Approvals, Issues, Handoffs
- Each item: Source icon, title, priority, age
- Inline actions where possible
- Mark as read/resolved

### Settings
**Current:** Linear-style preferences (done in Phase 1)
**Target:** Keep current design, add sub-pages:
- Preferences (done)
- Connections (done)
- Accounts (provider profiles, health)
- Capabilities (connectors, tools, plugins)
- About (done)

---

## 3. Design Quality Standards

Every page must match Linear's patterns:

### Typography
- Page title: 24px medium
- Section title: 14px medium
- Body text: 13px regular
- Meta text: 12px regular, muted
- No verbose descriptions anywhere

### Layout
- Sidebar: 244px, clean nav items, collapsible sections
- Content: max-width 1200px for most pages
- Tables: clean borders, minimal padding, hover states
- Cards: 8px radius, subtle border, no shadows
- Empty states: centered icon + one line of text

### Interactions
- All lists: hover highlight, click to navigate
- Filter chips: pill-style, active state with fill
- Search: compact inline, no separate search bar
- Actions: small buttons, right-aligned
- Loading: skeleton screens, not spinner text

### Colors
- Follow exact Linear tokens from HANDOFF document
- Status: green=running, yellow=paused, red=failed, blue=info, gray=idle
- No colored backgrounds on cards
- Borders: subtle, 1px, border color from tokens

---

## 4. Performance Requirements

- Pages render instantly (SSR returns empty shell, client polls for data) ✅ Done
- Upstream timeout: 3000ms (Quorum needs 2s for large responses)
- Loading states: skeleton screens within 100ms
- Data refresh: 5-15s polling interval
- No waterfall requests — all parallel via Promise.allSettled

---

## 5. Priority Order

### Phase 1: Navigation + Core Pages (highest impact)
1. Expand sidebar navigation with collapsible sections
2. Discovery > Sessions page (real-time session monitor)
3. Discovery > Ideas page (idea list + dossier detail)
4. Execution > Projects page (project detail with stories)
5. Execution > Control Plane page (approvals, issues, agents)
6. Fix all runtime errors and data loading issues

### Phase 2: Secondary Pages
7. Discovery > Ranking (leaderboard)
8. Discovery > Swipe Queue
9. Discovery > Research
10. Execution > Intake (chat interface)
11. Inbox redesign (Linear notification style)
12. Dashboard redesign (activity feed)

### Phase 3: Advanced Features
13. Discovery > Board (kanban view)
14. Portfolio lifecycle funnel
15. Repo Intelligence pages
16. Improvement Lab pages
17. Settings > Accounts
18. Settings > Capabilities

### Phase 4: Polish
19. Dark mode perfect pixel match with Linear
20. Mobile responsive design
21. Command palette (Cmd+K) with full search
22. Keyboard shortcuts
23. Animations and transitions

---

## 6. New Routes Needed

| Route | Component | Data Source |
|-------|-----------|------------|
| `/discovery/ranking` | RankingWorkspace | Quorum `/ranking/*` |
| `/discovery/swipe` | SwipeQueueWorkspace | Quorum `/discovery/swipe-queue` |
| `/discovery/research` | ResearchWorkspace | Quorum `/research/*` |
| `/execution/control-plane` | ControlPlaneWorkspace | Autopilot `/execution-plane/*` |
| `/intelligence/repos` | RepoAnalysisWorkspace | Quorum `/repo-digest/*`, `/repo-graph/*` |
| `/intelligence/improvement` | ImprovementLabWorkspace | Quorum `/improvement/*` |
| `/intelligence/observability` | ObservabilityWorkspace | Quorum `/observability/*` |
| `/settings/accounts` | AccountsWorkspace | Autopilot `/accounts/*` |
| `/settings/capabilities` | CapabilitiesWorkspace | Autopilot `/capabilities/*` |
| `/settings/tools` | ToolsWorkspace | Quorum `/settings/tools/*` |

---

## 7. Backend API Coverage

### Quorum endpoints NOT used by frontend:
- `/orchestrate/discovery/swipe-queue` — Swipe queue
- `/orchestrate/discovery/maybe-queue` — Maybe watch queue  
- `/orchestrate/discovery/preferences` — Learned preferences
- `/orchestrate/discovery/daemon/*` — Daemon control
- `/orchestrate/discovery/inbox/*` — Discovery inbox
- `/orchestrate/ranking/*` — All ranking endpoints
- `/orchestrate/research/*` — All research endpoints
- `/orchestrate/repo-digest/*` — Repo analysis
- `/orchestrate/repo-graph/*` — Repo graph
- `/orchestrate/improvement/*` — Improvement lab
- `/orchestrate/observability/*` — Observability (partially used)
- `/orchestrate/settings/*` — Tool/workspace settings
- `/orchestrate/guardrails/*` — Guardrail policies

### Autopilot endpoints NOT used by frontend:
- `/api/execution-plane/agents/*` — Runtime agents
- `/api/execution-plane/orchestrator-sessions/*` — Orchestrator sessions
- `/api/execution-plane/shadow-audits/*` — Shadow audits
- `/api/accounts/*` — Account management
- `/api/capabilities/*` — Capability catalog
- `/api/events/*` — Event stream
- `/api/execution-outcomes/*` — Execution outcomes
- `/api/integrations/*` — GitHub integration
- Most project detail endpoints (cost, trace, audit, runtime-control)
