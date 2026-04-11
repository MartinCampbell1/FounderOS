# Linear Source Registry

**Date:** 2026-04-11
**Purpose:** Normalize every high-signal Linear reference into a stable hierarchy so new frontend agents can pull from the same source stack without relying on chat history.

## Source Hierarchy

### Tier 1: Live extracted token sources

These are the strongest references for exact colors, typography, spacing, borders, and theme parity.

- `/Users/martin/Desktop/linearcss.txt`
- `/Users/martin/Desktop/whitelinear.txt`
- `/Users/martin/FounderOS/.linear-artifacts/dembrandt/linear.light.tokens.json`
- `/Users/martin/FounderOS/.linear-artifacts/dembrandt/linear.dark.tokens.json`
- `https://fontofweb.com/tokens/linear.app`

Why they are trustworthy:

- they are derived from live `linear.app`
- they capture current computed styles or structured token exports instead of only community-maintained design files
- they are the best source when Figma exports drift away from the live product

Supersedes:

- community Figma exports when there is a direct conflict on tokens or surface values

### Tier 2: Live code recreations and implementation references

These are useful for component anatomy, layout rhythm, motion cues, and implementation patterns. They are not a higher source of truth than live token dumps.

- `/Users/martin/FounderOS/.linear-references/rebuilding-linear.app`
- `/Users/martin/FounderOS/.linear-references/linear-clone`

Why they are trustworthy:

- they are focused attempts to reproduce Linear in code
- they help validate how tokens translate into actual layout and interaction details

Supersedes:

- nothing in Tier 1
- only weaker inspiration-only examples when comparing reproduction quality

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

Use these for fast visual checks of component shape, density, and spacing.

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

Improve these files instead of replacing the shell grammar wholesale.

- `/Users/martin/FounderOS/apps/web/app/globals.css`
- `/Users/martin/FounderOS/apps/web/components/unified-shell-frame.tsx`
- `/Users/martin/FounderOS/apps/web/components/shell/shell-screen-primitives.tsx`
- `/Users/martin/FounderOS/apps/web/components/shell/shell-record-primitives.tsx`
- `/Users/martin/FounderOS/apps/web/lib/navigation.ts`
- `/Users/martin/FounderOS/docs/FRONTEND_HANDOFF.md`

## Local Sync Commands

### Refresh lightweight references

```bash
npm run design:linear:refs
```

This command:

- shallow-clones or fast-forwards the two Linear recreation repos into `.linear-references/`
- saves a current HTML snapshot of `https://fontofweb.com/tokens/linear.app` into `.linear-artifacts/fontofweb/`

### Refresh structured live tokens

```bash
npm run design:linear:tokens
```

This command:

- runs `dembrandt` via `npx`, so there is no committed dependency to maintain
- writes fixed-path artifacts:
  - `/Users/martin/FounderOS/.linear-artifacts/dembrandt/linear.light.tokens.json`
  - `/Users/martin/FounderOS/.linear-artifacts/dembrandt/linear.dark.tokens.json`
- uses `NODE_OPTIONS=--max-old-space-size=512`
- runs light and dark extraction sequentially, one browser-heavy process at a time

## Browser Guardrails For Source Sync

- Do not run multiple `dembrandt` extractions in parallel.
- Prefer the default Chromium path first. Only switch to Firefox if bot detection forces it.
- Keep extraction headless and do not add trace, video, or extra debug capture.
- If a fresh extraction fails, fall back to the existing desktop dumps before changing product code.
