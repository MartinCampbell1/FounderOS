> Archived internal note. This file is historical context only and is not part of the public FounderOS release contract.

# Backend Handoff

**Date:** 2026-04-06
**Owner:** Codex
**Scope:** backend and integration seams only; no new frontend polish in this pass

## Status

Backend work is in a materially better state for demo/runtime completeness:

- `autopilot` now exposes filtered execution SSE, live/runtime log windows, and headless-control access to those same live outputs.
- `quorum` now has a safer SSE failure mode and a prompt-profile activation action for improvement flows.
- root shared clients now have the typed contracts needed to consume the new execution-plane surfaces without more glue code.

This is not a "whole repo fully green" claim. The backend surfaces touched here are verified, but there are still unrelated failures and unrelated frontend worktree changes elsewhere in the repo.

## What Changed

### 1. `autopilot` execution-plane live monitoring

Added server-side filtering to live events:

- `/api/events/` now supports:
  - `project_id`
  - `runtime_agent_id`
  - `orchestrator_session_id`
  - `initiative_id`
  - `orchestrator`

Added new execution-plane read surfaces:

- `GET /api/execution-plane/agents/tasks/{task_id}/output/live`
- `GET /api/execution-plane/projects/{project_id}/runtime-log`

These support:

- `offset`
- `max_bytes`
- `tail_lines`

They are backed by reusable windowed file-reading helpers, so consumers can poll incrementally instead of downloading full artifacts/logs on every refresh.

Important behavior:

- runtime-agent live output is blocked by open shadow-audit quarantines in the same way as durable output artifacts
- project runtime logs return `status: "live"` only when the project is actively running and not paused

Main files:

- `/Users/martin/FounderOS/autopilot/autopilot/api/routes/events.py`
- `/Users/martin/FounderOS/autopilot/autopilot/api/routes/execution_plane.py`
- `/Users/martin/FounderOS/autopilot/autopilot/core/execution_plane.py`
- `/Users/martin/FounderOS/autopilot/autopilot/core/task_output.py`

### 2. `autopilot` headless runtime control parity

Extended the headless control protocol so external orchestrators / runtime bridges can access the new live surfaces without going through ad hoc HTTP-only code.

New control-request subtypes:

- `get_runtime_agent_task_output_live`
- `get_project_runtime_log`

These are now fully handled in headless control and covered by tests.

Main files:

- `/Users/martin/FounderOS/autopilot/autopilot/core/control_messages.py`
- `/Users/martin/FounderOS/autopilot/autopilot/core/headless_control.py`

### 3. Root typed client contracts

Extended typed API clients for the new execution-plane runtime surfaces:

- live task output client
- project runtime-log client

Also worth knowing: `packages/api-clients/src/autopilot.ts` already includes the earlier execution-plane contract expansion from the previous pass:

- runtime-agent tasks: list/detail/cancel/output/transcript
- orchestrator sessions: create/list/summary/detail/status/events
- session actions: list/summary/execute/preview
- control passes and profiles
- agent action runs
- project command policy + command execute

Main file:

- `/Users/martin/FounderOS/packages/api-clients/src/autopilot.ts`

### 4. `quorum` backend gaps already closed in this stream

Closed Quorum-side backend items from the earlier pass:

- safer SSE fallback when `sse-starlette` is unavailable
- explicit prompt-profile activation endpoint for improvement flows

Relevant files:

- `/Users/martin/FounderOS/quorum/orchestrator/api.py`
- `/Users/martin/FounderOS/quorum/orchestrator/improvement/prompt_evolution.py`
- `/Users/martin/FounderOS/quorum/pyproject.toml`
- `/Users/martin/FounderOS/quorum/requirements.txt`

## Verification

### Green

- `PYTHONPATH=/Users/martin/FounderOS python3 -m pytest /Users/martin/FounderOS/autopilot/tests/test_control_messages.py /Users/martin/FounderOS/autopilot/tests/test_headless_control.py /Users/martin/FounderOS/autopilot/tests/test_execution_plane_api.py /Users/martin/FounderOS/autopilot/tests/test_events_api.py -q`
  - `113 passed`
- `npx tsc --noEmit --project /Users/martin/FounderOS/packages/api-clients/tsconfig.json`
- `npm run lint -- src/autopilot.ts` in `/Users/martin/FounderOS/packages/api-clients`
- `PYTHONPATH=/Users/martin/FounderOS python3 -m pytest /Users/martin/FounderOS/quorum/tests/test_api_contracts.py -k 'session_events_endpoint' -q`
  - `2 passed`
- `PYTHONPATH=/Users/martin/FounderOS python3 -m pytest /Users/martin/FounderOS/quorum/tests/test_improvement_api.py -q`
  - `6 passed`

### Known non-green item

Full `quorum/tests/test_api_contracts.py -q` is not fully green right now. The current unrelated failures are:

- patch target missing: `orchestrator.api.generate_session_execution_brief`
- patch target missing: `orchestrator.api.generate_session_tournament_preparation`

Those failures are outside the specific Quorum changes in this backend pass.

## Commit Surfaces

There are three separate change surfaces:

1. root repo
2. nested `/Users/martin/FounderOS/autopilot`
3. nested `/Users/martin/FounderOS/quorum`

If you split commits cleanly, treat `autopilot` and `quorum` as separate repos.

## Worktree Caveats

Backend-only committers should be careful with the current worktree:

- root repo contains a large amount of unrelated frontend work in `apps/web/**`
- `.omc/state/*` is noisy local state and should not be treated as backend product work
- `docs/FRONTEND_HANDOFF.md` is currently present in the root worktree and unrelated to a backend-only commit

## Highest-Value Next Backend Steps

If there is time for one more backend pass, the highest-value next items are:

1. Extend headless-control parity for project-scoped review surfaces:
   - approvals
   - issues
   - shadow audits
   - tool-permission runtimes
2. Decide whether runtime transcript also needs windowed/live reading like output and project logs.
3. Clean up the unrelated failing Quorum contract tests so the Quorum backend can claim a broader green suite.

## File Inventory

### Root repo

- `/Users/martin/FounderOS/packages/api-clients/src/autopilot.ts`
- `/Users/martin/FounderOS/packages/api-clients/src/quorum.ts`

### Nested `autopilot`

- `/Users/martin/FounderOS/autopilot/autopilot/api/routes/events.py`
- `/Users/martin/FounderOS/autopilot/autopilot/api/routes/execution_plane.py`
- `/Users/martin/FounderOS/autopilot/autopilot/core/control_messages.py`
- `/Users/martin/FounderOS/autopilot/autopilot/core/execution_plane.py`
- `/Users/martin/FounderOS/autopilot/autopilot/core/headless_control.py`
- `/Users/martin/FounderOS/autopilot/autopilot/core/task_output.py`
- `/Users/martin/FounderOS/autopilot/tests/test_control_messages.py`
- `/Users/martin/FounderOS/autopilot/tests/test_events_api.py`
- `/Users/martin/FounderOS/autopilot/tests/test_execution_plane_api.py`
- `/Users/martin/FounderOS/autopilot/tests/test_headless_control.py`
- `/Users/martin/FounderOS/autopilot/tests/test_headless_event_bridge.py`

### Nested `quorum`

- `/Users/martin/FounderOS/quorum/orchestrator/api.py`
- `/Users/martin/FounderOS/quorum/orchestrator/improvement/prompt_evolution.py`
- `/Users/martin/FounderOS/quorum/pyproject.toml`
- `/Users/martin/FounderOS/quorum/requirements.txt`
- `/Users/martin/FounderOS/quorum/tests/test_api_contracts.py`
- `/Users/martin/FounderOS/quorum/tests/test_improvement_api.py`
