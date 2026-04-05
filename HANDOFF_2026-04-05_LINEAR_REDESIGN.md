# FounderOS Linear Redesign Handoff

**Date:** 2026-04-05
**Priority:** CRITICAL — full visual redesign to match Linear.app pixel-for-pixel
**Previous agent status:** FAILED — produced output that looks nothing like Linear

---

## TL;DR

The current FounderOS frontend must be redesigned to look **identical to Linear.app**. The previous agent claimed "90% complete" but the result is visually unacceptable — it looks like a completely different product. This handoff contains the exact Linear design tokens, the complete file inventory, and a detailed gap analysis.

**Source of truth for design:** The LIVE Linear.app CSS variables (from `linearcss.txt` and `whitelinear.txt`), NOT the community Figma export (which is outdated).

---

## 1. Reference Files (in priority order)

### Live Linear CSS (SOURCE OF TRUTH)
- `/Users/martin/Desktop/linearcss.txt` — Dark mode CSS variables extracted from live linear.app
- `/Users/martin/Desktop/whitelinear.txt` — Light mode CSS variables extracted from live linear.app

### Figma Exports (secondary reference)
- `/Users/martin/Downloads/figma-export.css` — Design tokens: fonts, effects, shadows
- `/Users/martin/Downloads/figma-export.json` — Full color palette, text styles, effect styles as structured data
- `/Users/martin/Downloads/allcomponentslinear.css` — 97,238 lines of every Figma component's CSS (buttons, sidebar, inputs, tooltips, command bar, issues, etc.)

### PNG Component References
- `/Users/martin/Downloads/Navigation Sidebar.png` — Sidebar menu variants, team switcher, workspace selector
- `/Users/martin/Downloads/Buttons.png` — All button states: primary, secondary, ghost, destructive, icon-only, link
- `/Users/martin/Downloads/Command Bar.png` — Command palette layout, search, results
- `/Users/martin/Downloads/Input Fields.png` — Text inputs, selects, dropdowns, tags
- `/Users/martin/Downloads/Issues.png` — Issue list rows, status icons, priority badges
- `/Users/martin/Downloads/Issue Page.png` — Full issue detail layout with sidebar properties
- `/Users/martin/Downloads/Filters.png` — Filter bar, filter tags, sorting UI
- `/Users/martin/Downloads/Tooltips.png` — Tooltip layout with keyboard shortcuts
- `/Users/martin/Downloads/Toggle & Checkbox.png` — Toggle and checkbox states
- `/Users/martin/Downloads/Typography.png` — Full type scale: title1 through micro
- `/Users/martin/Downloads/Colour Palette.png` — Color palette grid
- `/Users/martin/Downloads/Shadows.png` — Shadow variants (button, dropdown, command bar, tooltip)
- `/Users/martin/Downloads/Icons - 16px.png`, `Icons - 24px.png`, `Icons - Other.png` — Icon sizing

---

## 2. Exact Linear Design Tokens (from LIVE linear.app)

### Dark Mode (linearcss.txt)
```
Background:
  --bg-sidebar-dark: #090909
  --bg-base-color-dark: #0f0f11
  --bg-border-color-dark: #1c1e21
  --content-color-dark: #6b6f76
  --content-highlight-color-dark: #ffffff

Semantic bg layers:
  --color-bg-primary: lch(4.52% 0.3 272)     ≈ #090909
  --color-bg-secondary: lch(9.02% 2.1 272)   ≈ #141516
  --color-bg-tertiary: lch(11.27% 3 272)      ≈ #1a1b1f
  --color-bg-quaternary: lch(6.77% 0.75 272)  ≈ #0f1011

Text hierarchy:
  --color-text-primary: #ffffff
  --color-text-secondary: lch(90.35%) ≈ #e2e3e5
  --color-text-tertiary: lch(61.4%)   ≈ #939496
  --color-text-quaternary: lch(36.3%) ≈ #545557

Borders:
  --color-border-primary: lch(8.84% 1.38 272) ≈ #18191a
  --color-border-secondary: same as primary
  --color-border-tertiary: lch(15.32% 1.38 272) ≈ #252628

Accent/brand:
  --sx-n8xqcl: #5e69d1   (primary indigo)
  --sx-1jffjrl: #6974e1  (primary hover)
  --sx-1xaoi8i: #6e7efd  (link/highlight blue)

Surfaces:
  --sx-1m4y240: #060606  (deep bg)
  --sx-g52i5g: #0c0e13   (sidebar darker)
  --sx-1ubxoo9: #0f0f10  (base)
  --sx-1gxylln: #141516  (card)
  --sx-1gm0lru: #18191c  (elevated)
  --sx-1gcjx5j: #1c1e22  (control bg)

Interactive overlays:
  --sx-5igtf4: #ffffff0b  (hover subtle)
  --sx-1ospiv4: #ffffff11 (hover medium)
  --sx-1jmjcvw: #ffffff22 (active/pressed)
  --sx-193njt9: #ffffff1c (border hover)

Shadows:
  --sx-10lzhmx: 0px 4px 4px -1px #0000000a, 0px 1px 1px 0px #00000014
  --sx-1dhg814: 0 3px 8px #0000001f, 0 2px 5px #0000001f, 0 1px 1px #0000001f
  --sx-1k7v50d: 0 4px 40px #00000019, 0 3px 20px #0000001f, 0 3px 12px #0000001f, 0 2px 8px #0000001f, 0 1px 1px #0000001f
```

### Light Mode (whitelinear.txt)
```
Background:
  --bg-sidebar-light: #f5f5f5
  --bg-base-color-light: #fcfcfd
  --bg-border-color-light: #e0e0e0
  --content-color-light: #b0b5c0
  --content-highlight-color-light: #23252a

Semantic bg layers:
  --color-bg-primary: lch(98.94% 0.5 282)    ≈ #fcfcfd
  --color-bg-secondary: lch(93.44% 0.5 282)  ≈ #ececed
  --color-bg-tertiary: lch(91.94% 0.5 282)   ≈ #e6e6e7
  --color-bg-quaternary: lch(96.94% 0.5 282) ≈ #f6f6f7

Text:
  --color-text-primary: lch(9.894%) ≈ #1b1b1b / #23252a
  --color-text-secondary: lch(19.788%) ≈ #2f2f31
  --color-text-tertiary: lch(39.576%) ≈ #5c5d5f / #9e9ea0
  --color-text-quaternary: lch(65.3%) ≈ #9e9ea0

Borders:
  --color-border-primary: lch(96.24%) ≈ #f0f0f0 (very subtle)
  --color-border-secondary: lch(89.49%) ≈ #e0e0e0
  --color-border-tertiary: lch(85.44%) ≈ #d5d5d5
```

### Shared Layout Tokens
```
--sidebar-width: 244px
--control-border-radius: 8px
--scrollbar-width: 12px
--label-dot-size: 9px
--font-size (from figma): micro=11px, mini=12px, small=13px, normal=15px, large=18px
--font-family: "Inter"
--font-weight-regular: 400
--font-weight-medium: 500
```

### Typography (from figma-export.json)
```
micro:  11px / 400 or 500
mini:   12px / 400 or 500
small:  13px / 400 or 500
normal: 15px / 22px line-height / 400 or 500
large:  18px / 400 or 500
title3: 20px / 400 or 500
title2: 24px / 400 or 500
title1: 36px / 400 or 500
issue-title: 22px / 400 or 500
```

### Effects (from figma-export.json)
```
Dropdown:    0px 7px 32px rgba(0,0,0,0.35)
Button:      0px 1px 2px rgba(0,0,0,0.09)
Command bar: 0px 16px 70px rgba(0,0,0,0.5) + background-blur
Dropdown 2:  0px 4px 24px rgba(0,0,0,0.2)
Button 2:    0px 1px 1px rgba(0,0,0,0.15)
Tooltip:     0px 2px 4px rgba(0,0,0,0.1)
Button destructive: 0px 0px 12px -1px #eb5757
```

---

## 3. Current FounderOS Files to Modify

### Critical Files (modify these first)

| File | Lines | What It Does |
|------|-------|-------------|
| `packages/ui/src/styles/globals.css` | 156 | Theme tokens / CSS variables — **THE** place to fix colors |
| `apps/web/app/globals.css` | 144 | App-level shell styles, sidebar, banners |
| `apps/web/components/unified-shell-frame.tsx` | 972 | Main shell: sidebar + topbar + command palette |
| `apps/web/lib/navigation.ts` | 455 | Nav items, section models, sidebar content |
| `packages/ui/src/components/button.tsx` | 46 | Button variants (CVA) |
| `packages/ui/src/components/badge.tsx` | 34 | Badge/pill variants |
| `packages/ui/src/components/card.tsx` | 52 | Card component |

### Screen-Level Files (modify after core)

| File | Lines | Route |
|------|-------|-------|
| `apps/web/components/shell/shell-screen-primitives.tsx` | 1709 | ALL shared primitives (ShellHero, ShellMetricCard, ShellSectionCard, etc.) |
| `apps/web/components/shell/shell-record-primitives.tsx` | ~500 | Record display primitives |
| `apps/web/components/dashboard/dashboard-workspace.tsx` | 1443 | /dashboard |
| `apps/web/components/settings/settings-workspace.tsx` | 1392 | /settings |
| `apps/web/components/review/review-workspace.tsx` | 1853 | /review |
| `apps/web/components/inbox/inbox-workspace.tsx` | 1331 | /inbox |
| `apps/web/components/discovery/discovery-workspace.tsx` | 1451 | /discovery |
| `apps/web/components/execution/execution-workspace.tsx` | 1003 | /execution |
| `apps/web/components/portfolio/portfolio-workspace.tsx` | 1151 | /portfolio |

### Tech Stack
- Next.js 16.2.1 with Turbopack
- React 19.2.4
- Tailwind CSS v4 (using `@tailwindcss/postcss`)
- CVA for component variants
- `clsx` + `tailwind-merge` via `cn()` utility
- `lucide-react` icons
- `next-themes` for theme switching
- Font: Inter (Google Fonts)
- Monorepo: Turborepo with `apps/web` + `packages/ui`

---

## 4. Gap Analysis: What's Wrong

### A. Color Scheme is WRONG

**Current `globals.css` dark mode:**
```css
--background: #0f0f11;        /* ← close but bg-sidebar is wrong */
--card: #191a23;               /* ← Figma color, not live Linear */
--border: #2c2d3c;             /* ← Figma, way too blue/purple */
--shell-sidebar-bg: #191a23;   /* ← WRONG. Live Linear sidebar is #090909 */
--shell-sidebar-border: #2c2d3c; /* ← WRONG. Live Linear is #1c1e21 */
--muted-foreground: #6b6f76;   /* ← correct */
```

**What it should be (from live Linear):**
```css
--background: #0f0f11;
--card: #141516;               /* --sx-1gxylln from live */
--border: #1c1e21;             /* --bg-border-color-dark from live */
--shell-sidebar-bg: #090909;   /* --bg-sidebar-dark from live */
--shell-sidebar-border: #1c1e21; /* same as border */
--shell-control-bg: #141516;
--shell-control-border: #1c1e22;
--shell-control-hover: #ffffff11; /* subtle white overlay */
```

**Current light mode:**
```css
--background: #fcfcfd;   /* ← correct */
--shell-sidebar-bg: #f3f3f4; /* ← close, should be #f5f5f5 */
```

### B. Sidebar Structure is COMPLETELY WRONG

**Current sidebar has:**
1. Sparkles icon + "FounderOS workspace" branded header with chevrons
2. 7 nav items with colored dot indicators and 12px text
3. Section eyebrow label ("Unified Shell", "Cross-plane", etc.)
4. Section status text
5. "Current scope" detail card with badge rows
6. "Current workstreams" text blocks (3-4 items of paragraph text!)
7. "Immediate migration targets" more text blocks
8. "Open settings" and "Back to dashboard" links

**Linear sidebar has (from screenshots):**
1. Workspace switcher: team avatar + name + dropdown chevron — SIMPLE
2. Search icon (Q) + compose icon — two small icon buttons top right
3. **Flat nav list:** Inbox, My issues — plain 13px medium, 16px icons
4. **"Workspace" section label** (grey, uppercase-ish)
5. Projects, Views — plain nav items
6. **"..." More** — collapsible
7. **"Your teams" section label** with + button
8. Team name with collapsible sub-items: Issues, Projects, Views
9. **"Try" section** at bottom: Import issues, + Invite people, Connect GitHub
10. **"? Help"** footer link

That's it. NO paragraphs of text. NO workstream descriptions. NO metric cards. NO scope badges. NO eyebrow labels. Just clean, minimal navigation.

### C. Topbar is WRONG

**Current topbar has:**
- Eyebrow label "Unified Shell" + section name
- Search bar "Search or jump..." with Cmd+K
- Status pills: "Needs attention", "Quorum offline · n/a", "Autopilot offline · n/a"
- "Open settings" link button
- Theme toggle

**Linear topbar has:**
- Just the page title: "Projects", "Preferences", "Rtrtrt" (team name)
- Right side: notification bell, + button, filter/display icons
- NO search in topbar (search is Cmd+K modal only)
- NO status pills
- NO eyebrow labels

### D. Content Area is WRONG

**Current content has (dashboard as example):**
- "Unified shell" badge pill
- "Cross-plane operating picture" hero title
- Hero description paragraph
- Metric summary text row
- Yellow error banner (full width, screaming)
- Metric cards grid: "0 active", "0 ideas", etc.
- "Review pressure" section with tabs

**Linear content has:**
- Page title "Projects" — clean, 24px medium, flush left
- Tab bar: "All projects" (selected pill), settings gear
- Column headers: Name, Health, Priority, Lead, Target date, Status
- Data rows with minimal styling
- MASSIVE white/empty space
- No hero sections, no description paragraphs, no metric cards

### E. Settings Page is COMPLETELY WRONG

**Linear settings (from screenshots):**
- SEPARATE sidebar replacing the main nav
- "< Back to app" link at top
- Sections: Preferences, Profile, Notifications, Security & access, Connected accounts, Agent personalization
- Then grouped: Issues (Labels, Templates, SLAs), Projects (Labels, Templates, Statuses, Updates), Features (AI & Agents, Initiatives, Documents, etc.), Administration
- Content: "Preferences" title, "General" subtitle, then label/value rows separated by thin borders
- Controls are RIGHT-aligned: dropdowns, toggles

**Current FounderOS settings:**
- Uses the same sidebar as all other pages
- Content is a wall of ShellSectionCards, ShellDetailCards, ShellMetricCards
- Shows technical debug info (gateway health, contract audits, parity targets)
- 1392 lines of dense diagnostic content
- Looks like a DevOps dashboard, not a settings page

### F. Specific CSS Issues

1. **border-radius: `4px` on buttons** — Linear uses `8px` (`--control-border-radius: 8px`)
2. **`rounded-[6px]` on nav items** — Linear uses `6px` (this is actually close, but active bg is wrong)
3. **`rounded-[12px]` on cards** — Linear uses `8px` for cards
4. **Text sizes**: nav items are `12px` — should be `13px` (Linear's `small/medium`)
5. **Sidebar width**: `236px` — should be `244px` (from live Linear)
6. **Nav item height**: `28px` (h-7) — Linear uses `28-32px` range with `padding: 6px 8px`
7. **Dot indicators on nav items** — Linear does NOT have dots, uses subtle bg highlight only
8. **Active nav state**: uses `bg-accent/14` purple — Linear uses `rgba(0,0,0,0.06)` in light / `#ffffff11` in dark

---

## 5. Implementation Plan

### Phase 1: Design Tokens (globals.css)
Fix ALL CSS variables in `packages/ui/src/styles/globals.css` to match live Linear values from `linearcss.txt` and `whitelinear.txt`.

### Phase 2: Sidebar Redesign (unified-shell-frame.tsx)
1. Remove ALL sidebar content except navigation links
2. Simplify workspace switcher to avatar + name + chevron
3. Remove dot indicators from nav items
4. Remove eyebrow labels, status text, workstream text, scope cards
5. Add section grouping: main nav, "Workspace", "Your teams" equivalent
6. Fix active state to subtle bg, not accent color
7. Fix sidebar width to 244px
8. Add "?" help link at bottom

### Phase 3: Topbar Redesign (unified-shell-frame.tsx)
1. Remove eyebrow labels
2. Show only page title (from NAV_ITEMS label)
3. Remove status pills from topbar
4. Keep Cmd+K shortcut but remove visible search bar
5. Clean right side: just theme toggle + settings gear

### Phase 4: Content Area Primitives (shell-screen-primitives.tsx)
1. Remove ShellHero concept entirely
2. Implement Linear-style page header: title + optional tab bar
3. Implement Linear-style table/list views
4. Implement Linear-style settings rows (label + control)
5. Fix card styling: `border-radius: 8px`, correct shadows

### Phase 5: Component Library (packages/ui)
1. Button: fix `border-radius` to `8px`, fix color variants
2. Badge: simplify styling
3. Card: fix `border-radius` to `8px`
4. Add: Tab/pill component matching Linear tabs
5. Add: Settings row component (label left, control right, thin border-bottom)

### Phase 6: Page-by-Page Migration
1. Settings — complete redesign with separate sidebar (highest visual impact)
2. Dashboard — replace hero+metrics with clean overview table/list
3. Inbox — list view matching Linear issue list
4. Discovery — table/list layouts
5. Execution — table/list layouts
6. Portfolio — table/list layouts
7. Review — table/list layouts

### Phase 7: Navigation Cleanup (navigation.ts)
1. Remove `eyebrow`, `summary`, `status`, `highlights`, `groups`, `checklist` from SECTION_MODELS — these are displayed in sidebar and they shouldn't be
2. Keep only `key`, `title`, `href` in section models

---

## 6. Linear UI Patterns to Replicate

### Sidebar Pattern
```
[Team Avatar] Team Name ▾        [🔍] [✏️]
─────────────────────────────────────────
📥 Inbox
📋 My issues

Workspace ▾
  📁 Projects
  👁 Views
  ··· More

Your teams ▾                      [+]
  🟢 TeamName ▾
    📋 Issues
    📁 Projects
    👁 Views

Try ▾
  📥 Import issues
  + Invite people
  🔗 Connect GitHub

[?] Help                    [Ask Linear]
```

### Settings Sidebar Pattern (replaces main sidebar)
```
← Back to app

⚙ Preferences          ← highlighted
👤 Profile
🔔 Notifications
🔒 Security & access
🔗 Connected accounts
▷ Agent personalization

Issues
  🏷 Labels
  📄 Templates
  🎯 SLAs

Projects
  🏷 Labels
  📄 Templates
  📊 Statuses
  📰 Updates

Features
  ✨ AI & Agents
  ...
```

### Settings Content Pattern
```
Preferences                    ← 24px medium title

General                        ← 18px medium subtitle
────────────────────────────────────────────────
Default home view              [Linear Agent ▾]
Select which view to display...
────────────────────────────────────────────────
Display names                  [Full name ▾]
Select how names are displayed
────────────────────────────────────────────────
```
Each row: title (15px medium), description (13px grey), control right-aligned, separated by 1px border-bottom.

### Issue List Pattern
```
All issues | Active | Backlog  ⚙    [≡] [⊞] [☰]
──────────────────────────────────────────────────
▾ ○ Todo  4                                   [+]
  ··· RTR-1  ○  Get familiar with Linear    Apr 4 👤
  ··· RTR-2  ○  Set up your teams           Apr 4 👤
  ··· RTR-3  ○  Connect your tools          Apr 4 👤
  ··· RTR-4  ○  Import your data            Apr 4 👤

Go to projects  G then P
```

### Project List Pattern
```
Projects                                       [+]
All projects  ⚙              [≡] [⊞] [☰]
──────────────────────────────────────────────────
Name          Health      Priority  Lead  Date  Status
⚙ rgg        ◌ No updates  ···    👤     🚩    ◌ 0%
```

---

## 7. What NOT to Do

1. **DO NOT** keep the "hero" pattern with eyebrow + title + description + metrics
2. **DO NOT** show workstream text or migration targets in sidebar
3. **DO NOT** show gateway health status in topbar
4. **DO NOT** use colored dot indicators on nav items
5. **DO NOT** use accent-colored active nav states
6. **DO NOT** use `#191a23` for sidebar bg (that's Figma, not live)
7. **DO NOT** use `#2c2d3c` for borders (that's Figma, not live)
8. **DO NOT** display debug/diagnostic info on settings page
9. **DO NOT** use `border-radius: 4px` on buttons (should be 8px)
10. **DO NOT** create "ShellHero" or "ShellMetricCard" layouts — Linear doesn't have these

---

## 8. Running the Project

```bash
cd /Users/martin/FounderOS
npm install        # or npm ci
npm run dev        # starts dev server (Turbopack)
```

The web app runs at `http://127.0.0.1:3737` (configured via `FOUNDEROS_WEB_PORT`).

---

## 9. Verification

After changes, visually compare against:
1. Linear.app (user is logged in on Safari)
2. PNG exports in `/Users/martin/Downloads/` (Navigation Sidebar.png, Buttons.png, etc.)
3. Live CSS values from `/Users/martin/Desktop/linearcss.txt` (dark) and `whitelinear.txt` (light)

Key pages to verify: Dashboard, Settings, Inbox, Discovery (issues-like list)
