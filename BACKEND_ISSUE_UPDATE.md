# Quorum Backend Issue — Update 2026-04-05 11:00

## Root Cause Identified

**Quorum gateway hangs after ~10-15 seconds of operation.** The problem is reproducible:

1. Fresh start: `GET /health` responds in 23ms, `GET /orchestrate/sessions` in 13ms
2. Frontend starts polling — sends sessions, ideas, and **6 concurrent dossier requests**
3. After processing these requests, Quorum event loop becomes completely unresponsive
4. Even `GET /health` stops responding (timeout after 5+ seconds)
5. CPU usage jumps to 95-97% and stays there

## Evidence

```bash
# Fresh start — fast:
health: 200 0.023369s
sessions: 200 0.012927s

# After 15s of frontend polling — dead:
health: 000 5.003303s (timeout)
sessions: 000 5.006326s (timeout)

# CPU during hang:
ps aux | grep gateway.py
# Python gateway.py 97.4% CPU
```

## Additional Discovery

**Two gateway.py processes** were running simultaneously at one point (old one from 8:27AM never killed, new one from 10:54AM). Both at 95%+ CPU. This could be a contributing factor if they share SQLite database files with write locks.

## Most Likely Cause

The dossier fan-out from the frontend triggers expensive computation in Quorum:

```
Frontend sends (concurrently):
GET /orchestrate/sessions
GET /orchestrate/discovery/ideas?limit=24
GET /orchestrate/discovery/ideas/idea_c302d9ebc752/dossier
GET /orchestrate/discovery/ideas/idea_1a0995050b7c/dossier
GET /orchestrate/discovery/ideas/idea_5f4dc18af1ba/dossier
GET /orchestrate/discovery/ideas/idea_e8bf932ec339/dossier
GET /orchestrate/discovery/ideas/idea_81f76b72a8c3/dossier
GET /orchestrate/discovery/ideas/idea_a99d818e4aca/dossier
... (up to 12 dossier requests with concurrency 6)
```

Each dossier request likely triggers:
- SQLite reads (evidence, graph, memory, explainability)
- Possible CPU-bound processing (graph rebuilds? embedding lookups?)
- If any of these are synchronous, they block the single-threaded event loop

## What Backend Agent Should Fix

1. **Profile the dossier endpoint** — what makes `GET /orchestrate/discovery/ideas/{id}/dossier` heavy?
2. **Ensure all I/O is async** — any `sqlite3` (sync) usage should be `aiosqlite`
3. **Add request concurrency limits** — limit concurrent dossier requests to 2-3, not 6
4. **Add a batch dossier endpoint** — `POST /orchestrate/discovery/ideas/batch-dossier` 
5. **Check for CPU-bound work** — graph rebuilds, embedding computations should be offloaded to thread pool
6. **Check SQLite WAL mode** — enables concurrent reads without blocking

## Files to Profile

- `/Users/martin/FounderOS/quorum/orchestrator/api.py` — dossier endpoint handler
- `/Users/martin/FounderOS/quorum/orchestrator/discovery_store.py` — SQLite operations
- `/Users/martin/FounderOS/quorum/orchestrator/engine.py` — any graph/embedding work
