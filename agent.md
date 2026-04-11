# FounderOS Agent Notes

This branch is frontend-only.

Read these first:

- `/Users/martin/FounderOS/docs/FRONTEND_DESIGN_AGENT_BRIEF.md`
- `/Users/martin/FounderOS/docs/FRONTEND_DESIGN_AGENT_PROMPT.md`
- `/Users/martin/FounderOS/docs/LINEAR_SOURCE_REGISTRY.md`

Execution mode:

- Move fast. Use subagents aggressively for code reading, gap analysis, route audits, and source normalization.
- Keep browser-heavy work serialized unless a side-by-side comparison explicitly requires parallelism.
- Machine resources are shared across multiple active projects. Assume only 16 GB RAM is available even when CPU is free.
- For Node/browser-heavy helpers, prefer `NODE_OPTIONS=--max-old-space-size=512`.
- Do not give subagents browser, dev-server, bundle, or repo-wide verification tasks unless they are the only reasonable option.
- One browser process per subagent, one context, one page unless the task explicitly needs two-page comparison.
- Reuse the same browser context for a task instead of relaunching fresh browsers for each check.
- Prefer headless mode for DOM/CSS/token extraction. Use headed mode only for interaction debugging or final visual QA.
- Keep trace, video, HAR, and extra debug capture disabled unless the bug depends on them.
- Close tabs, contexts, and browser processes immediately after assertions, screenshots, or token extraction complete.
- Batch checks into one browser launch instead of many small launches.
- Do not slow the overall workflow into an economy mode. Parallelize lightweight subagents and keep browser-heavy jobs tightly scoped.
- Frontend work only in this thread unless the user explicitly expands scope.

Useful commands:

- `npm run design:linear:refs`
- `npm run design:linear:tokens`
