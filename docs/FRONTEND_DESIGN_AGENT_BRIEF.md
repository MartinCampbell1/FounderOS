# FounderOS Frontend Design Agent Brief

**Date:** 2026-04-11
**Audience:** New frontend design / design-to-code agent
**Goal:** Bring FounderOS frontend as close as possible to Linear's visual and interaction quality while preserving FounderOS-specific product structure and routes.

## 1. Mission

You are not starting from zero.

FounderOS already has a large shell-based frontend in place. Your job is not to invent a new visual system. Your job is to:

1. understand the current FounderOS shell,
2. understand the strongest available Linear references,
3. identify where current UI still diverges from Linear,
4. improve parity without breaking FounderOS-specific information architecture.

The strongest design target is **Linear-like fidelity**, not generic SaaS polish.

## 2. Source Of Truth Hierarchy

Use sources in this priority order.

### Tier 1: Live Linear token dumps and structured extracts

These are the strongest references for exact colors, surfaces, borders, spacing feel, and control language.

- `/Users/martin/Desktop/linearcss.txt`
- `/Users/martin/Desktop/whitelinear.txt`
- `/Users/martin/FounderOS/.linear-artifacts/dembrandt/linear.light.tokens.json`
- `/Users/martin/FounderOS/.linear-artifacts/dembrandt/linear.dark.tokens.json`
- `https://fontofweb.com/tokens/linear.app`

These matter more than the community Figma file when there is a conflict.

### Tier 2: Live code recreations and implementation references

These are useful for component anatomy, layout rhythm, motion feel, and implementation cross-checking.

- `/Users/martin/FounderOS/.linear-references/rebuilding-linear.app`
- `/Users/martin/FounderOS/.linear-references/linear-clone`

These do not outrank live token dumps, but they are higher-signal than random inspiration shots.

### Tier 3: Figma and exported design assets

Use these for component anatomy, typography scale, shadows, icon sizing, and visual cross-checking.

- `/Users/martin/Downloads/Linear Design System (Community).fig`
- `/Users/martin/Downloads/figma-export.json`
- `/Users/martin/Downloads/figma-export.css`
- `/Users/martin/Downloads/allcomponentslinear.css`
- `https://www.figma.com/community/file/1222872653732371433/linear-design-system`

Historical Figma URL reference:

- `https://www.figma.com/design/BA1jsnJWvmXm8iz48J7SeS/Linear-Design-System--Community-?node-id=8-2&p=f&t=IaUEZVIBFMOpJ5On-0`

### Tier 4: PNG component references

Use these when you need fast visual validation of component shape and density.

- `/Users/martin/Downloads/Navigation Sidebar.png`
- `/Users/martin/Downloads/Buttons.png`
- `/Users/martin/Downloads/Command Bar.png`
- `/Users/martin/Downloads/Input Fields.png`
- `/Users/martin/Downloads/Issues.png`
- `/Users/martin/Downloads/Issue Page.png`
- `/Users/martin/Downloads/Filters.png`
- `/Users/martin/Downloads/Tooltips.png`
- `/Users/martin/Downloads/Toggle & Checkbox.png`
- `/Users/martin/Downloads/Typography.png`
- `/Users/martin/Downloads/Colour Palette.png`
- `/Users/martin/Downloads/Shadows.png`
- `/Users/martin/Downloads/Icons - 16px.png`
- `/Users/martin/Downloads/Icons - 24px.png`
- `/Users/martin/Downloads/Icons - Other.png`

### Tier 5: Current FounderOS implementation

This is the code you must improve rather than replace wholesale.

- `/Users/martin/FounderOS/apps/web/app/globals.css`
- `/Users/martin/FounderOS/apps/web/components/unified-shell-frame.tsx`
- `/Users/martin/FounderOS/apps/web/components/shell/shell-screen-primitives.tsx`
- `/Users/martin/FounderOS/apps/web/components/shell/shell-record-primitives.tsx`
- `/Users/martin/FounderOS/apps/web/lib/navigation.ts`
- `/Users/martin/FounderOS/docs/FRONTEND_HANDOFF.md`

## 3. Current Frontend Reality

The current frontend is already a large operator shell, not a placeholder.

High-signal characteristics:

- unified shell layout with sidebar, topbar, command palette, and route-scoped navigation
- broad route coverage across discovery, execution, review, portfolio, inbox, and settings
- shared screen primitives already exist and should be reused
- many FounderOS-specific surfaces are functional, but not all are visually at true Linear fidelity

Important constraint:

- do not restart from scratch
- do not replace the shell grammar with a random new design system
- improve the existing shell and primitives first

## 4. Where The Current Design Lives In Code

### Shell chrome

- `/Users/martin/FounderOS/apps/web/components/unified-shell-frame.tsx`

This file controls:

- sidebar chrome
- topbar rhythm
- command palette
- shell-level navigation behavior
- mobile/sidebar collapse behavior

### Global shell styling

- `/Users/martin/FounderOS/apps/web/app/globals.css`

This file controls:

- shell sidebar width
- hover states
- shell surface ramps
- section spacing
- list row hover behavior
- content area spacing

### Shared screen grammar

- `/Users/martin/FounderOS/apps/web/components/shell/shell-screen-primitives.tsx`
- `/Users/martin/FounderOS/apps/web/components/shell/shell-record-primitives.tsx`

These files define the reusable page/card/list/detail grammar. Prefer improving these first before touching route-local components.

### Navigation structure

- `/Users/martin/FounderOS/apps/web/lib/navigation.ts`

This file defines:

- sidebar sections
- route labels and hierarchy
- section models and descriptive copy

This is one of the biggest parity levers, because Linear-like feel is not only color and radius. It is also IA density, copy restraint, and nav rhythm.

## 5. Historical Context You Must Know

There were earlier redesign passes. Some of the highest-signal context is no longer present as normal files in the current working tree and must be recovered from git history.

### Historical docs to inspect

- `git show 9f65549d62feb5823739bb269006fd1d9c200114:docs/archive/internal/HANDOFF_2026-04-05_LINEAR_REDESIGN.md`
- `git show 85da5269606bbc48e706d5c7f290dc2fe0094674:REDESIGN_PLAN.md`
- `git show fbbfaabc877d39d8c883ba42f57b87b87316008c:HANDOFF_2026-04-05_UNIFIED_SHELL_UI_PASS.md`
- `git show fbbfaabc877d39d8c883ba42f57b87b87316008c:HANDOFF_2026-04-04_UNIFIED_SHELL.md`

### Why these matter

They capture:

- earlier failure modes where the UI drifted far away from Linear
- explicit guidance that live CSS dumps outrank community Figma exports
- route-by-route redesign intent
- previous shell unification decisions that should not be casually undone

## 6. Design Principles For This Project

### What to imitate from Linear

- density and restraint
- flat but precise surfaces
- subtle borders instead of loud cards
- compact navigation rhythm
- low-noise typography
- strong hierarchy through spacing and weight, not decorative chrome
- compact controls and list rows
- dark and light themes with real parity

### What not to copy blindly

- Linear branding or logo
- product IA that conflicts with FounderOS concepts
- issue/project semantics that erase FounderOS discovery/execution distinctions

### FounderOS-specific rule

FounderOS has unique surfaces that do not exist in Linear:

- discovery intelligence
- improvement lab
- traces/replays
- execution audits
- execution handoffs
- runtime agent drill-ins

For these, Linear is the visual baseline, not the literal UX blueprint.

## 7. Known Gaps

These are the main open frontend gaps as of this brief.

### Exact Linear parity is not complete

The current UI is Linear-inspired, but not yet a true high-fidelity reproduction in all surfaces.

Areas most likely to drift:

- sidebar density and structure
- page header rhythm
- card borders and surface stacking
- typography choices and title sizing
- action button weight and hover feel
- populated dense states under real data

### Browser QA needs to stay serious

Frontend quality should not rely only on static reading. Validate critical flows in a real browser.

Priority QA targets:

- sidebar and shell navigation
- mobile layout collapse behavior
- loading states
- empty states
- error and offline states
- live events / SSE or polling-driven state transitions
- admin or gated execution actions
- handoff detail routes

### Browser Resource Guardrails

- Keep browser-heavy work fast, but do not run it in parallel unless a comparison explicitly requires it.
- Prefer static code/doc inspection first. Open Playwright, devtools, or browser automation only when a browser is required.
- Use one browser process per subagent, one context at a time, and one page unless the task clearly needs two-page comparison.
- Reuse the same browser tab/context for a task instead of spawning fresh browsers for each check.
- Prefer headless mode for DOM/CSS extraction and token work. Use headed mode only for interaction debugging or final visual QA.
- Do not enable trace, video, HAR, or extra debug capture unless the issue depends on them.
- Close contexts and pages immediately after screenshots, logs, or assertions are collected.
- Batch screenshots and checks into a single run instead of many small launches.
- Avoid multi-viewport or multi-device fanout unless the bug is clearly viewport-specific.
- If RAM pressure appears, reduce browser concurrency first. Do not slow the overall workflow into an economy mode.

### Subagent Operating Mode

- Use subagents aggressively for code reading, gap analysis, route audits, and source normalization.
- Keep browser-heavy subagents serialized and tightly scoped.
- For Node/browser-heavy helpers, prefer `NODE_OPTIONS=--max-old-space-size=512`.
- When new Linear sources are introduced, normalize them into `/Users/martin/FounderOS/docs/LINEAR_SOURCE_REGISTRY.md` instead of relying on chat history.
- Use `npm run design:linear:refs` for lightweight reference sync and `npm run design:linear:tokens` for fresh `dembrandt` extracts.

### Local environment may be messy

Do not assume every historical note still exists in the checked-out filesystem. Some archived files may only be recoverable via `git show`.

## 8. Practical Workflow For New Design Work

Use this order.

1. Read the current shell implementation:
   - `/Users/martin/FounderOS/apps/web/app/globals.css`
   - `/Users/martin/FounderOS/apps/web/components/unified-shell-frame.tsx`
   - `/Users/martin/FounderOS/apps/web/components/shell/shell-screen-primitives.tsx`
   - `/Users/martin/FounderOS/apps/web/lib/navigation.ts`
2. Read the current status doc:
   - `/Users/martin/FounderOS/docs/FRONTEND_HANDOFF.md`
3. Read the historical redesign docs from git history.
4. Inspect raw Linear sources in this order:
   - `linearcss.txt`
   - `whitelinear.txt`
   - fresh `dembrandt` token extracts from `.linear-artifacts/dembrandt/` after running `npm run design:linear:tokens`
   - `https://fontofweb.com/tokens/linear.app`
   - `.linear-references/rebuilding-linear.app`
   - `.linear-references/linear-clone`
   - `figma-export.json`
   - `figma-export.css`
   - `allcomponentslinear.css`
   - PNG references
5. Build a gap list:
   - exact tokens
   - sidebar structure
   - typography
   - route-by-route visual divergence
6. Only then start editing code.

## 9. How To Treat New Design Sources

If new Linear sources are found, do not just paste them into chat and hope the agent remembers them.

Normalize them into this structure:

1. identify whether the source is:
   - token source
   - component anatomy source
   - page screenshot source
   - interaction/behavior source
2. record the absolute path or permanent URL
3. record why it is trustworthy
4. record what it supersedes, if anything
5. explicitly place it in the source hierarchy
6. if it is reusable, add or update the local sync path in `docs/LINEAR_SOURCE_REGISTRY.md`

If a new source disagrees with the old community Figma export but matches live Linear screenshots or CSS, prefer the live source.

## 10. What A Good Design Agent Should Deliver

A good agent in this repo should:

- identify exact parity gaps instead of giving vague polish advice
- edit shared shell layers before route-local duplication
- preserve FounderOS route structure
- use Linear as baseline visual grammar
- call out when a FounderOS-only surface requires original design work
- verify changes in browser, not only by reading files

## 11. Ready-To-Use Bootstrap For A New Chat

Use the prompt in:

- `/Users/martin/FounderOS/docs/FRONTEND_DESIGN_AGENT_PROMPT.md`

That file is the short operational bootstrap. This document is the full context.
