# FounderOS Unified Shell UI Pass Handoff

Date: 2026-04-05

## Purpose

This file is a repo-local handoff for continuing the FounderOS unified shell work after the dedicated frontend/UI pass.

This handoff supersedes the old resume point in `<local FounderOS checkout>/HANDOFF_2026-04-04_UNIFIED_SHELL.md`.

The important state change is simple:

- the remaining functional unification/hardening tail that used to block UI work is closed for this pass
- the shell-wide UI pass is now effectively complete
- the next agent should not restart another broad foundation cleanup
- the remaining work is targeted QA, populated-state polish, and any user-directed redesign of unique FounderOS-only surfaces

## Current Status

- Functional unification/hardening: effectively complete for the unified shell pass
- Shared shell UI foundation: complete
- Screen-level Linear-style migration: complete
- Remaining work: targeted populated-state polish and selective UX iteration
- Product-ready progress for the shell: roughly 90%+

## What Is Already Done

### 1. Shell-wide Linear-like UI foundation is in place

The shell now runs on one shared visual/control grammar instead of route-local styling.

Core shared primitives live in:

- `<local FounderOS checkout>/apps/web/components/shell/shell-screen-primitives.tsx`
- `<local FounderOS checkout>/apps/web/components/shell/shell-record-primitives.tsx`
- `<local FounderOS checkout>/apps/web/components/unified-shell-frame.tsx`

High-signal shared primitives now include:

- `ShellSelectionPanel`
- `ShellHeroSearchField`
- `ShellShortcutLegend`
- `ShellRefreshButton`
- `ShellQueueSectionCard`
- `ShellSummaryCard`
- `ShellFactList`
- `ShellFactTileGrid`
- `ShellPreviewListCard`

Verified current exports in `<local FounderOS checkout>/apps/web/components/shell/shell-screen-primitives.tsx`:

- `ShellFactList`
- `ShellFactTileGrid`
- `ShellPreviewListCard`
- `ShellSelectionPanel`
- `ShellHeroSearchField`
- `ShellShortcutLegend`
- `ShellRefreshButton`
- `ShellQueueSectionCard`
- `ShellSummaryCard`

### 2. Screen-level manual card grammar is no longer duplicated

The broad migration from ad hoc `CardHeader/CardTitle/CardContent/CardDescription` usage into shared shell primitives is complete across `apps/web/components` outside `shell/*`.

This was reconfirmed with:

- `rg -n "CardHeader|CardTitle|CardContent|CardDescription" apps/web/components -g '!apps/web/components/shell/**'`

Result:

- no matches

Meaning:

- screen routes now depend on shared shell primitives instead of maintaining their own card anatomy
- future UX work should be done in shared shell layers first, not by reintroducing route-local card patterns

### 3. Unified shell routes are all on the same UI language

The main route families already migrated:

- `/dashboard`
- `/review`
- `/discovery`
- `/discovery/ideas`
- `/discovery/ideas/[ideaId]`
- `/discovery/ideas/[ideaId]/authoring`
- `/discovery/authoring`
- `/discovery/review`
- `/discovery/traces`
- `/discovery/replays`
- `/discovery/board`
- `/discovery/board/ranking`
- `/discovery/board/archive`
- `/discovery/board/finals`
- `/discovery/board/simulations`
- `/execution`
- `/execution/review`
- `/execution/intake`
- `/execution/projects/[projectId]`
- `/execution/handoffs/[handoffId]`
- `/portfolio`
- `/inbox`
- `/settings`

This includes:

- shell hero/header rhythm
- command palette/topbar behavior
- sidebar density
- route search/toolbar treatment
- queue/list cards
- selection/batch controls
- loading/empty/status states
- detail/diagnostics cards
- refresh/operator memory controls

### 4. Final populated-state shared pass is also done

The final broad pass did not just finish foundation cleanup. It also consolidated dense populated-state patterns in:

- `<local FounderOS checkout>/apps/web/components/dashboard/dashboard-workspace.tsx`
- `<local FounderOS checkout>/apps/web/components/portfolio/portfolio-workspace.tsx`
- `<local FounderOS checkout>/apps/web/components/settings/settings-workspace.tsx`

Specifically:

- `dashboard`
  - `Execution source mix`
  - `Intake state`
- `portfolio`
  - execution attention previews
  - latest execution outcome facts
  - authoring coverage text stack
- `settings`
  - `Resolution diagnostics`
  - parity count rows
  - detail drilldown metric pairs
  - remembered review passes

These now use:

- `ShellFactList`
- `ShellFactTileGrid`
- `ShellPreviewListCard`

### 5. Shell chrome and route-scoped behavior are preserved

The shell still preserves:

- route scope via `project_id` and `intake_session_id`
- remembered review entry behavior
- scoped settings/debug links
- command palette navigation
- shell-owned refresh controls
- same-origin shell-first routing

This is important because future visual polish should not accidentally regress scoped navigation semantics.

## Design Sources And Product Constraints

The user explicitly wanted the UI pass to be driven by Linear’s visual system.

Current design sources available in this environment:

- Figma design system link:
  - `https://www.figma.com/design/BA1jsnJWvmXm8iz48J7SeS/Linear-Design-System--Community-?node-id=8-2&p=f&t=IaUEZVIBFMOpJ5On-0`
- local exports:
  - `/Users/martin/Downloads/figma-export.json`
  - `/Users/martin/Downloads/figma-export.css`
  - `/Users/martin/Downloads/allcomponentslinear.css`
  - multiple local PNG exports under `/Users/martin/Downloads/`
- prior CSS dumps:
  - `/Users/martin/Desktop/linearcss.txt`
  - `/Users/martin/Desktop/whitelinear.txt`

Important user instructions:

- use Linear as the base visual system
- black and white themes are both required
- do not use the Linear logo
- unique FounderOS-only surfaces should be discussed or treated separately
- for those unique surfaces, 21st.dev can be used as supporting input

Practical guidance for the next agent:

- do not reopen a generic redesign pass
- do not replace the shared shell system with a new design grammar
- only do targeted polish where real data reveals weak states or where the user asks for additional visual changes

## Latest Confirmed Verification

Latest confirmed green commands at the end of this handoff:

- `npm run typecheck --workspace @founderos/web`
- `npm run lint --workspace @founderos/web`
- `npm run test --workspace @founderos/web`

Latest test result:

- `status: "ok"`

## Latest Live Route Verification

Latest final live checks were run with Chrome DevTools against:

- `http://127.0.0.1:3737/dashboard`
- `http://127.0.0.1:3737/dashboard?project_id=demo-project&intake_session_id=demo-intake`
- `http://127.0.0.1:3737/settings`
- `http://127.0.0.1:3737/portfolio`

Confirmed during final pass:

- no runtime error screen
- no hydration error screen
- scoped dashboard still preserves `project demo-project` and `intake demo-intake`
- `settings` shows the new diagnostics/fact layouts
- `dashboard` shows the new summary/fact layouts
- `portfolio` renders cleanly, but local data was sparse/empty during the final pass, so some preview treatments are verified at route/render level rather than on dense live data

Across the broader UI pass, live checks were also repeatedly run on:

- review family
- discovery family
- execution family
- inbox
- settings
- portfolio

## Recommended Resume Point

If another agent continues from here, do not start with more foundation cleanup.

Start with this order:

1. Reconfirm current baseline:
   - `npm run typecheck --workspace @founderos/web`
   - `npm run lint --workspace @founderos/web`
   - `npm run test --workspace @founderos/web`
2. Run a live populated-state pass on the densest routes:
   - `/portfolio`
   - `/execution`
   - `/execution/review`
   - `/inbox`
   - `/review`
   - `/discovery/board/simulations`
3. Only if real data exposes weak states:
   - polish those specific states
   - keep changes inside shared shell primitives when possible
4. If the user asks for more design work:
   - move to unique FounderOS-only surfaces instead of reopening shell-wide migration

## Highest-Signal Next Tasks

### A. Populated-state QA pass

This is the biggest real remaining task.

Focus on routes where the final UI was only verified under sparse or degraded data:

- `/portfolio`
- `/execution`
- `/execution/handoffs/[handoffId]`
- `/inbox`
- `/review`
- `/discovery/board/simulations`

Goal:

- ensure dense cards, previews, and action lanes still feel consistent under real populated data
- fix only concrete regressions or obviously weak states

### B. FounderOS-only surface design

The shared shell is done. The next meaningful design work is on surfaces that do not map cleanly to Linear:

- founder-specific dashboards
- Tinder/swipe-like discovery mechanics
- unique cross-plane control surfaces
- any richer FounderOS-specific command or operator flows

These should not be treated as “copy Linear more”.

### C. Final QA sweep

If needed, do one short consistency sweep for:

- spacing rhythm
- badge density
- toolbar/search alignment
- action pill consistency
- empty/loading/state transitions

This should be a short polish pass, not a new architecture phase.

## Key Files To Read First

### Core shell UI foundation

- `<local FounderOS checkout>/apps/web/components/shell/shell-screen-primitives.tsx`
- `<local FounderOS checkout>/apps/web/components/shell/shell-record-primitives.tsx`
- `<local FounderOS checkout>/apps/web/components/unified-shell-frame.tsx`

### Highest-signal finalized routes

- `<local FounderOS checkout>/apps/web/components/dashboard/dashboard-workspace.tsx`
- `<local FounderOS checkout>/apps/web/components/portfolio/portfolio-workspace.tsx`
- `<local FounderOS checkout>/apps/web/components/settings/settings-workspace.tsx`
- `<local FounderOS checkout>/apps/web/components/review/review-workspace.tsx`
- `<local FounderOS checkout>/apps/web/components/inbox/inbox-workspace.tsx`
- `<local FounderOS checkout>/apps/web/components/execution/execution-workspace.tsx`
- `<local FounderOS checkout>/apps/web/components/execution/execution-review-workspace.tsx`
- `<local FounderOS checkout>/apps/web/components/discovery/discovery-workspace.tsx`
- `<local FounderOS checkout>/apps/web/components/discovery/discovery-board-workspace.tsx`
- `<local FounderOS checkout>/apps/web/components/discovery/discovery-board-simulations-workspace.tsx`

### Design references

- `<local FounderOS checkout>/HANDOFF_2026-04-04_UNIFIED_SHELL.md`
- `/Users/martin/Downloads/figma-export.json`
- `/Users/martin/Downloads/figma-export.css`
- `/Users/martin/Downloads/allcomponentslinear.css`

## Short Resume Summary

If resuming in a new dialog, the simplest truthful summary is:

- functional hardening is done for this pass
- the unified shell UI pass is done
- do not restart broad cleanup work
- verify with real populated data
- then only do targeted polish or unique FounderOS surface design
