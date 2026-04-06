> Archived internal note. This file is historical context only and is not part of the public FounderOS release contract.

# Quorum Backend Issue — Deep Update 2026-04-05

## What Was Actually Wrong

The failure was not one slow SQL query. It was an architectural feedback loop:

1. FounderOS shell snapshot routes were turning one page poll into many upstream Quorum calls.
2. Quorum `GET /orchestrate/discovery/ideas/{idea_id}/dossier` was not a cheap read. It synchronously built:
   - `idea_graph_context`
   - `memory_context`
   - `explainability_context`
3. Those builders repeatedly walked the full discovery portfolio, often by calling `list_dossiers()` again.
4. The FastAPI handlers were `async`, but the actual work inside them was synchronous Python + `sqlite3`.
5. Under dossier fan-out, the uvicorn event loop got starved, so even `GET /health` stopped getting time slices.

This is why the system looked "hung" at the gateway level even though the deeper cause lived in discovery read architecture.

---

## Root Cause Chain

### 1. Shell created an N+1 upstream pattern

`/Users/martin/FounderOS/apps/web/lib/chain-graph-data.ts` was loading:

- `GET /orchestrate/discovery/ideas`
- then N dossier requests with concurrency 6

That meant one shell snapshot could fan out into many Quorum dossier requests.

### 2. Dossier endpoint rebuilt portfolio-derived context synchronously

`/Users/martin/FounderOS/quorum/orchestrator/api.py`

`GET /discovery/ideas/{idea_id}/dossier` was doing:

- `get_dossier(idea_id)`
- `idea_graph_service.get_idea_context(idea_id)`
- `memory_graph_service.get_idea_context(idea_id)`
- `dossier_explainability_service.build(idea_id)`

All of that ran inline inside the request handler.

### 3. The derived services re-scanned the portfolio repeatedly

Before the fix:

- `IdeaGraphService` recomputed a cache key by serializing the full dossier portfolio
- `MemoryGraphService` did the same
- `DiscoveryEvaluationService.evaluate_idea()` rebuilt evaluation context from the full dossier portfolio
- `DossierExplainabilityService` walked recent sessions and loaded full session payloads just to find supporting protocol links

### 4. `list_dossiers()` itself used an internal N+1 pattern

`/Users/martin/FounderOS/quorum/orchestrator/discovery_store.py`

`list_dossiers()` first selected idea ids, then called `get_dossier()` once per idea. So portfolio-level builders were repeatedly opening the same related tables dossier-by-dossier.

### 5. Event loop starvation, not socket failure

The server could still be listening on `127.0.0.1:8800`, but if CPU-heavy synchronous dossier work occupied the single event loop thread, `/health` could still time out. That is why the symptom looked like "gateway dead" while the process stayed alive.

---

## What Was Changed

### Quorum backend

#### 1. Rebuilt dossier portfolio loading as bulk reads

File:
- `/Users/martin/FounderOS/quorum/orchestrator/discovery_store.py`

Changes:
- added bulk dossier assembly inside a single connection
- `list_dossiers()` no longer calls `get_dossier()` N times
- `get_dossier()` now reuses the same dossier assembly path
- added `portfolio_cache_token()` so higher-level services can invalidate cheaply without serializing the full portfolio
- removed an implicit write on read from `get_preference_profile()`, which previously persisted a default profile during reads and could invalidate cache tokens unexpectedly

#### 2. Removed expensive full-portfolio hash rebuilds from graph services

Files:
- `/Users/martin/FounderOS/quorum/orchestrator/idea_graph.py`
- `/Users/martin/FounderOS/quorum/orchestrator/memory_graph.py`

Changes:
- switched cache invalidation to `portfolio_cache_token()`
- added warm in-memory snapshot caching
- avoided recomputing full JSON-based source hashes on every dossier request

#### 3. Cached discovery evaluations

File:
- `/Users/martin/FounderOS/quorum/orchestrator/observability/evals.py`

Changes:
- added cached full-portfolio evaluation pack
- `evaluate_idea()` now serves from cached portfolio evaluation state instead of rebuilding from all dossiers every time

#### 4. Stopped explainability from loading full sessions unnecessarily

Files:
- `/Users/martin/FounderOS/quorum/orchestrator/observability/dossier_explainability.py`
- `/Users/martin/FounderOS/quorum/orchestrator/models.py`

Changes:
- added lightweight `list_recent_protocol_summaries()` to `SessionStore`
- explainability now uses protocol summaries instead of `store.get()` for each session

#### 5. Moved heavy read handlers off the event loop

File:
- `/Users/martin/FounderOS/quorum/orchestrator/api.py`

Changes:
- added thread offload for heavy sync read paths via `asyncio.to_thread(...)`
- applied this to dossier, explainability, idea graph, memory, observability, swipe queue, leaderboard, archive, and related read endpoints

#### 6. Added a bulk dossier API

File:
- `/Users/martin/FounderOS/quorum/orchestrator/api.py`

New route:
- `GET /orchestrate/discovery/dossiers?limit=...&include_archived=...`

This gives shell a single bulk read instead of repeated dossier fan-out.

### FounderOS shell

File:
- `/Users/martin/FounderOS/apps/web/lib/chain-graph-data.ts`

Changes:
- removed N dossier requests with concurrency 6
- replaced them with one bulk `GET /orchestrate/discovery/dossiers`

This is the critical cross-system fix. Without it, Quorum would still get hammered by shell snapshot fan-out.

---

## Measured Before/After Signals

### Direct in-process timings after the fix

Measured on the current local discovery DB:

```text
list_dossiers: 0.0239s
idea_graph_context cold: 0.0979s
idea_graph_context warm: 0.0010s
memory_context cold: 0.0510s
memory_context warm: 0.0036s
evals.evaluate_idea cold: 0.0594s
evals.evaluate_idea warm: 0.0006s
explainability.build cold: 0.0073s
explainability.build warm: 0.0084s
```

Key point:

- warm `idea_graph_context` dropped from about `106ms` to about `1ms`
- warm `memory_context` dropped from about `88ms` to about `3-4ms`
- warm `evaluate_idea` dropped from about `41-59ms` to sub-millisecond

### Isolated HTTP validation on a copied local Quorum state

Quorum was started on `127.0.0.1:8811` against a copied `.multi-agent` state directory.

Baseline:

```text
health    200 0.035s
sessions  200 0.023s
ideas     200 0.186s
dossiers  200 0.187s
```

Under concurrent dossier load:

```text
health_during_load (200, 0.121s)
dossier requests: 0.49s to 0.61s each for 6 parallel calls
```

Under mixed shell-style read load:

```text
health_during_mix (200, 0.118s)
/orchestrate/discovery/ideas?limit=24                      0.202s
/orchestrate/discovery/dossiers?limit=24...               0.158s
/orchestrate/observability/scoreboards/discovery          0.653s
/orchestrate/ranking/leaderboard?limit=10                0.195s
/orchestrate/discovery/swipe-queue?limit=6               0.668s
/orchestrate/sessions                                     0.029s
```

Most important result:

`/health` stayed responsive during concurrent discovery load instead of timing out.

---

## What This Means

The original diagnosis was incomplete. The real problem was a combined architecture issue:

- shell snapshot fan-out
- synchronous heavy dossier enrichment
- repeated full-portfolio rebuilds
- N+1 dossier loading in the store
- event loop starvation from sync work inside async handlers

The fix therefore had to be cross-layer:

1. reduce upstream request multiplicity
2. reduce repeated portfolio recomputation
3. bulk-load dossier data
4. get expensive sync work off the event loop

---

## Files Changed

- `/Users/martin/FounderOS/quorum/orchestrator/discovery_store.py`
- `/Users/martin/FounderOS/quorum/orchestrator/models.py`
- `/Users/martin/FounderOS/quorum/orchestrator/idea_graph.py`
- `/Users/martin/FounderOS/quorum/orchestrator/memory_graph.py`
- `/Users/martin/FounderOS/quorum/orchestrator/observability/evals.py`
- `/Users/martin/FounderOS/quorum/orchestrator/observability/dossier_explainability.py`
- `/Users/martin/FounderOS/quorum/orchestrator/api.py`
- `/Users/martin/FounderOS/apps/web/lib/chain-graph-data.ts`

---

## Remaining Risks

The architecture is materially better now, but there are still follow-up areas worth revisiting:

1. More Quorum read endpoints still use synchronous `sqlite3`; they are now safer because heavy ones are thread-offloaded, but the storage layer is still fundamentally sync.
2. Scoreboard and swipe queue are now responsive, but they still do non-trivial portfolio work and can be cached more aggressively if needed.
3. If multiple independent Quorum processes are pointed at the same state directory, contention can still happen. The duplicate-gateway situation should still be avoided operationally.
