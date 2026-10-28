# ContextDrift

Self-healing middleware and continuous knowledge auditor for RAG pipelines. When a document is updated, ContextDrift finds the older chunks it contradicts, deprecates them, records the lineage, and makes sure retrieval only ever sees active knowledge.

## Quickstart

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open http://127.0.0.1:8000. Requires Python 3.11+.

No API key is needed. Without one, a deterministic offline evaluator makes the conflict decisions. To use a real LLM, copy `.env.example` to `.env` and set one of `GROQ_API_KEY`, `OPENAI_API_KEY` or `GEMINI_API_KEY`.

The first start downloads the `all-MiniLM-L6-v2` embedding model (about 90 MB) through FastEmbed. If the download fails, ContextDrift falls back to a local hashing embedder and says so in the header, so the demo still runs.

## 60-second demo

1. **Ingest and test** tab: click **A, Ingest Leave Policy 2024**, then **B, Ingest Leave Policy 2026**.
2. The result panel shows the neighbourhood search, the verdict (`CONTRADICTORY`, 24 to 15) and a word-level diff. The old chunk is red (deprecated), the new one green (active).
3. **RAG playground** tab: ask *"How many paid annual leaves do employees get?"*. The answer comes from the 2026 chunk; the 2024 chunk appears under **Blocked as stale**.
4. **Conflict resolution** tab: press **Revert / undo**, ask again, and the 2024 chunk is back in use. Press **Re-apply healing** to restore the automatic decision.

More demo documents (refund policy v1/v2, an unrelated remote-work policy) sit under "More demo documents".

## How it works

```
POST /api/ingest
  text/file -> paragraph-aware chunks (300-500 chars, 60 char overlap)
            -> embed (FastEmbed MiniLM)
            -> top-3 ACTIVE neighbours with cosine >= 0.70   (Chroma, where={"active": true})
            -> evaluator(old, new) -> {is_same_entity, verdict, conflict_summary, confidence_score}
                 CONTRADICTORY -> old: active=false, status=deprecated, superseded_by=new
                                  new: active=true,  status=latest,     supersedes=old
                                  lineage edge Old -SUPERSEDED_BY-> New + audit_logs row
                 DUPLICATE     -> new chunk not stored, audit row written
                 ADDITIVE / UNRELATED -> stored, nothing deprecated

POST /api/query
  embed prompt -> Chroma where={"active": true}  -> context for the answer
              -> Chroma where={"active": false} -> "blocked" list shown to the auditor
```

A verdict only triggers action when `confidence_score >= MIN_CONFIDENCE` (0.50). If the LLM call fails or returns invalid JSON, the offline evaluator takes over for that pair and the engine label shows `mock-fallback`.

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/ingest` | JSON `{doc_name, text}` or multipart (`doc_name`, `text` and/or `file`) |
| POST | `/api/query` | `{prompt, top_k}` returns answer, `used_chunks`, `blocked_chunks` |
| GET | `/api/chunks` | Every chunk with its metadata (`?status=deprecated`) |
| GET | `/api/audit-logs` | Self-healing timeline (`?conflicts_only=true`) |
| POST | `/api/conflicts/{id}/toggle` | Revert a healing decision, or re-apply it |
| GET | `/api/lineage` | Graph export: `nodes`, `edges`, `stats` |
| GET | `/api/stats` | Counts and health score |
| GET | `/api/health` | Embedder and evaluator in use |
| POST | `/api/reset` | Clear chunks, lineage and audit log |

Interactive docs: http://127.0.0.1:8000/docs

```bash
curl -s localhost:8000/api/ingest -H 'content-type: application/json' \
  -d '{"doc_name":"leave_2024.md","text":"Employees get 24 paid annual leaves per year."}'
curl -s localhost:8000/api/query -H 'content-type: application/json' \
  -d '{"prompt":"How many annual leaves do employees get?"}'
```

## Design notes

- **Revert semantics.** Reverting a conflict reinstates the old chunk and marks the new one `rejected` (inactive). Chunk state is always recomputed from the audit log, so reverts and re-applies stay consistent even when one chunk is part of several conflicts.
- **Health score.** The auditor's average confidence across healed conflicts, discounted by the share that humans reverted. It reads 100 when nothing has drifted.
- **Lineage.** SQLite stores `Document`, `Chunk` and `Entity` nodes with `CONTAINS`, `ABOUT`, `SUPERSEDED_BY` and (document-level) `SUPERSEDES` edges, exported as JSON at `/api/lineage`.
- **Chroma metadata** cannot hold `null`, so `superseded_by` and `supersedes` are stored as empty strings and returned as `null` by the API.
- **Persistence** lives in `./data` (Chroma plus `lineage.sqlite3`). Delete the folder or call `/api/reset` to start fresh. Switching between the neural and hashing embedders uses separate Chroma collections so vectors are never mixed.
- The UI loads Tailwind and IBM Plex from CDNs, so the browser needs internet access; the backend does not, apart from the one-time model download and LLM calls.

## Layout

```
app/
  main.py           FastAPI app, ingest/query pipeline, static mount
  config.py         Environment settings
  models.py         Pydantic v2 schemas (strict evaluator JSON)
  vector_store.py   Chunker, embedder (+ offline fallback), ChromaDB wrapper
  evaluator.py      Groq / OpenAI / Gemini evaluator + heuristic fallback
  graph_lineage.py  SQLite lineage graph and audit log
  static/           index.html (Tailwind dashboard), app.js
```
