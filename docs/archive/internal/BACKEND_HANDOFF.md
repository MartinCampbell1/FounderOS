> Archived internal note. This file is historical context only and is not part of the public FounderOS release contract.

# FounderOS Backend Handoff: Quorum Availability and Latency

**Date:** 2026-04-05
**From:** Frontend shell pass
**To:** Backend specialist
**Priority:** High

---

## Executive Summary

The blocking issue is not just that `GET /orchestrate/sessions` is heavy. In the current local stack, the Quorum process is listening on `127.0.0.1:8800` but does not return even the base `GET /health` endpoint within 15 seconds. Autopilot is reachable and returns normally.

That changes the debugging priority:

1. First confirm why the Quorum gateway is hanging at all.
2. Only after that, optimize `GET /orchestrate/sessions` payload size and query cost.

The frontend shell is configured with a 3000 ms upstream timeout for normal JSON fetches and a 1000 ms timeout for health checks, so any Quorum stall immediately surfaces as empty discovery pages and timeout errors.

---

## Confirmed Current State

### Stack topology in this workspace

Use the repo-local stack layout below, not older external clone paths:

- Shell repo root: `/Users/martin/FounderOS`
- Web app: `/Users/martin/FounderOS/apps/web`
- Quorum wrapper package: `/Users/martin/FounderOS/apps/quorum-api/package.json`
- Quorum runtime root: `/Users/martin/FounderOS/quorum`
- Autopilot wrapper package: `/Users/martin/FounderOS/apps/autopilot-api/package.json`
- Autopilot runtime root: `/Users/martin/FounderOS/autopilot`
- Managed stack launcher: `/Users/martin/FounderOS/scripts/run-stack.mjs`

### How the local stack actually starts

- Quorum wrapper script runs `cd ../../quorum && ${QUORUM_PYTHON_BIN:-./.venv/bin/python} gateway.py`
- Autopilot wrapper script runs `cd ../../autopilot && ${AUTOPILOT_PYTHON_BIN:-./.venv/bin/python} -m autopilot.api.serve`
- Managed stack defaults:
  - Quorum base URL: `http://127.0.0.1:8800`
  - Autopilot base URL: `http://127.0.0.1:8420/api`
  - Web shell: `http://127.0.0.1:3737`

### Live measurements captured on 2026-04-05

The following checks were run from `/Users/martin/FounderOS`:

```bash
curl -s -o /dev/null -w 'quorum sessions %{http_code} %{time_total}s\n' --max-time 15 http://127.0.0.1:8800/orchestrate/sessions
# quorum sessions 000 15.006365s

curl -s -o /dev/null -w 'quorum health %{http_code} %{time_total}s\n' --max-time 15 http://127.0.0.1:8800/health
# quorum health 000 15.002368s

curl -s -o /dev/null -w 'quorum ideas %{http_code} %{time_total}s\n' --max-time 15 'http://127.0.0.1:8800/orchestrate/discovery/ideas?limit=24'
# quorum ideas 000 15.001757s

curl -s -o /dev/null -w 'autopilot projects %{http_code} %{time_total}s\n' --max-time 15 http://127.0.0.1:8420/api/projects/
# autopilot projects 200 0.469569s
```

Also confirmed:

```bash
lsof -nP -iTCP:8800 -sTCP:LISTEN
# Python ... TCP 127.0.0.1:8800 (LISTEN)

ps -p 7076 -o pid=,etime=,command=
# 7076 ... Python gateway.py
```

So Quorum is not down at the socket level. It is accepting the port bind and then hanging badly enough that even `/health` does not complete.

---

## Frontend Impact

### Hard timeout thresholds

- Normal upstream JSON fetches use a default timeout of **3000 ms**
  - Source: `/Users/martin/FounderOS/apps/web/lib/upstream.ts`
- Shell gateway health probes use a timeout of **1000 ms**
  - Source: `/Users/martin/FounderOS/apps/web/lib/gateway.ts`

Because Quorum is currently taking more than 15 seconds without a response, the shell will consistently mark it degraded or offline and render discovery surfaces with timeout failures.

### Routes that depend on Quorum

These shell snapshot builders call Quorum directly:

- Discovery sessions/detail: `/Users/martin/FounderOS/apps/web/lib/discovery.ts`
- Discovery replay/session history: `/Users/martin/FounderOS/apps/web/lib/discovery-history.ts`
- Discovery board data: `/Users/martin/FounderOS/apps/web/lib/discovery-board.ts`
- Dashboard rollups also pull session data: `/Users/martin/FounderOS/apps/web/lib/dashboard.ts`
- Parity audit also checks `orchestrate/sessions`: `/Users/martin/FounderOS/apps/web/lib/shell-parity-audit.ts`

### Important correction to the previous handoff

The shell does **not** load idea dossiers strictly one-by-one in a long sequential chain.

Current behavior in `/Users/martin/FounderOS/apps/web/lib/chain-graph-data.ts`:

- dossier fetches are fanned out with concurrency `6`
- each dossier request uses a `5000 ms` timeout
- duplicate in-flight dossier requests are deduped briefly with an in-memory cache

This still creates N+1 pressure on Quorum once it is responsive, but it is not the same as "12 sequential dossier requests."

---

## What Is Confirmed vs. What Is Still a Hypothesis

### Confirmed

- Quorum is reachable on TCP port `8800` but does not return `GET /health` within 15 seconds.
- `GET /orchestrate/sessions` is also timing out, but that is currently part of a broader Quorum hang, not yet proven to be the root cause by itself.
- Autopilot is serving requests normally.
- Frontend timeouts are much shorter than the observed Quorum stall, so the UX failure is expected.

### Not yet confirmed

- whether `list_sessions` itself is doing an expensive DB scan or serialization pass
- whether SQLite locking is the main cause
- whether the gateway event loop is blocked before request routing
- whether background jobs, startup hooks, or shared global state are starving request handling
- whether payload size is the dominant issue once the gateway hang is fixed

The old claims about "94 KB JSON", "34 sessions", and exact per-session payload cost should be treated as historical observations unless they are re-measured against the current hung process.

---

## Backend Investigation Order

### 1. Treat this as a gateway responsiveness problem first

Since `/health` also hangs, start above the `list_sessions` query layer:

- inspect `gateway.py` request handling and startup state
- check whether the event loop is blocked by sync work
- check whether a global lock, DB open, or background worker is stalling all requests
- inspect whether a middleware or dependency runs on every request and is hanging

### 2. Capture evidence from the live hung process

Use the live PID while a request is hanging:

```bash
lsof -nP -iTCP:8800 -sTCP:LISTEN
ps -p <pid> -o pid=,etime=,command=
```

Then capture:

- Quorum logs during a blocked `curl`
- Python stack dump or thread dump for the running `gateway.py`
- DB file location and lock state
- whether the process is CPU-bound, blocked on I/O, or waiting on SQLite

### 3. Only then optimize hot endpoints

Once `GET /health` is reliably fast again, profile:

- `GET /orchestrate/sessions`
- `GET /orchestrate/discovery/ideas`
- `GET /orchestrate/discovery/ideas/{id}/dossier`
- `GET /orchestrate/ranking/leaderboard`
- `GET /orchestrate/discovery/swipe-queue`

Likely improvements after the gateway is healthy:

- add pagination to session list routes
- ship a lighter session summary payload
- omit verbose `runtime_state.reasons` from list views
- add or verify indexes for common filters and ordering
- reduce N+1 dossier fan-out with a batch or summary route

---

## Relevant Files

### FounderOS shell

- `/Users/martin/FounderOS/scripts/run-stack.mjs`
- `/Users/martin/FounderOS/apps/web/lib/upstream.ts`
- `/Users/martin/FounderOS/apps/web/lib/gateway.ts`
- `/Users/martin/FounderOS/apps/web/lib/discovery.ts`
- `/Users/martin/FounderOS/apps/web/lib/discovery-history.ts`
- `/Users/martin/FounderOS/apps/web/lib/discovery-board.ts`
- `/Users/martin/FounderOS/apps/web/lib/chain-graph-data.ts`

### Quorum runtime

- `/Users/martin/FounderOS/quorum/gateway.py`
- `/Users/martin/FounderOS/quorum/orchestrator/api.py`
- `/Users/martin/FounderOS/quorum/orchestrator/models.py`
- `/Users/martin/FounderOS/quorum/orchestrator/discovery_store.py`
- `/Users/martin/FounderOS/quorum/orchestrator/engine.py`

### Autopilot reference

- `/Users/martin/FounderOS/autopilot/autopilot/api/serve.py`

---

## Reproduction Commands

### Preferred full-stack launch

```bash
cd /Users/martin/FounderOS
npm run dev:stack
```

### Direct service launch

```bash
cd /Users/martin/FounderOS/quorum
./.venv/bin/python gateway.py
```

```bash
cd /Users/martin/FounderOS/autopilot
./.venv/bin/python -m autopilot.api.serve
```

### Basic probes

```bash
curl -i --max-time 3 http://127.0.0.1:8800/health
curl -i --max-time 3 http://127.0.0.1:8800/orchestrate/sessions
curl -i --max-time 3 'http://127.0.0.1:8800/orchestrate/discovery/ideas?limit=24'
curl -i --max-time 3 http://127.0.0.1:8420/api/projects/
```

### If Quorum is hanging but still listening

```bash
lsof -nP -iTCP:8800 -sTCP:LISTEN
ps -p <pid> -o pid=,etime=,command=
```

---

## Bottom Line

This should be handed to backend as:

"Quorum is currently hanging at the gateway level in the local FounderOS stack. Even `GET /health` does not return within 15 seconds, while Autopilot remains responsive. Frontend failures are real but downstream of that problem. Fix Quorum responsiveness first, then optimize `orchestrate/sessions` and dossier-heavy discovery routes."
