# ContextDrift

> **Self-healing middleware and continuous knowledge auditor for RAG pipelines.**

[![Python](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-green.svg)](https://fastapi.tiangolo.com)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-0.5.5+-orange.svg)](https://www.trychroma.com/)
[![License](https://img.shields.io/badge/license-MIT-purple.svg)](LICENSE)

When documentation or business policies are updated, standard RAG pipelines often retrieve both older and newer conflicting chunks, leading to stale answers and hallucinated outputs. **ContextDrift** acts as a self-healing knowledge layer between your incoming documents and your vector database: it detects contradictions, deprecates outdated chunks, logs knowledge graph lineage, and guarantees that retrieval only serves active, authoritative facts.

---

## The Problem: Context Drift in RAG

```
               [ User Asks: "How many annual leaves do employees get?" ]
                                          │
                                          ▼
                         Standard Vector Similarity Search
                       ┌──────────────────┴──────────────────┐
                       ▼                                     ▼
             [ Leave Policy 2024 ]                 [ Leave Policy 2026 ]
          "Employees get 24 days..."            "Employees get 15 days..."
                       └──────────────────┬──────────────────┘
                                          ▼
                       LLM receives conflicting context:
             "Employees receive either 24 or 15 days of annual leave..."
                                          ❌
```

When new documents are ingested into standard vector stores, old conflicting chunks persist. Both match semantic queries with high cosine similarity, causing LLMs to generate contradictory or outdated answers.

---

## How ContextDrift Solves It

ContextDrift intercepts incoming documents during ingestion and audits them against existing knowledge in real time:

```
POST /api/ingest
  Document (Markdown/Text)
    │
    ▼
  Paragraph-aware Chunking (300-500 chars, 60 char overlap)
    │
    ▼
  FastEmbed Neural Embedding (sentence-transformers/all-MiniLM-L6-v2)
    │
    ▼
  Top-k Active Neighbourhood Search in ChromaDB (where={"active": true}, cosine >= 0.70)
    │
    ▼
  Evaluator (LLM: Groq / OpenAI / Gemini OR Deterministic Heuristic Fallback)
    │
    ├─── CONTRADICTORY ──► Old Chunk: active=false, status="deprecated", superseded_by=New
    │                      New Chunk: active=true,  status="latest",     supersedes=Old
    │                      Lineage:   Old -SUPERSEDED_BY-> New recorded in SQLite & Audit Log
    │
    ├─── DUPLICATE ──────► New chunk skipped (not re-stored), duplicate audit row logged
    │
    └─── ADDITIVE ───────► New chunk stored alongside existing chunks with active=true

POST /api/query
  Embed Prompt ──► ChromaDB (where={"active": true})  ──► Safe, authoritative context for answer
               ──► ChromaDB (where={"active": false}) ──► "Blocked as stale" chunks for auditing
```

---

## Key Features

- **Automated Self-Healing**: Contradictory chunks are automatically superseded without manual database surgery or full re-indexing.
- **Active-Filtered RAG Retrieval**: Answers are generated strictly from `active: true` knowledge. Stale chunks that match the query are intercepted and exposed for inspection.
- **Human-in-the-Loop Reversal**: Revert any self-healing decision with a single click. Reverting reinstates the older chunk as `latest` and marks the newer chunk `rejected`. Re-applying restores the automatic healing verdict.
- **Knowledge Lineage Graph**: Backed by SQLite, ContextDrift tracks `Document`, `Chunk`, and `Entity` nodes with `CONTAINS`, `ABOUT`, `SUPERSEDED_BY`, and `SUPERSEDES` relationships, exportable as JSON.
- **Zero-Config Offline Out of the Box**: Runs locally without requiring an API key using FastEmbed and a deterministic heuristic auditor.
- **Multi-LLM Integration**: Seamlessly switch to live LLM evaluation with Groq, OpenAI (or any OpenAI-compatible API like Ollama/vLLM), or Google Gemini.
- **Visual Dashboard**: Responsive web interface with live word-level diffs, interactive RAG query playground, system health score gauge, and audit log.

---

## Quickstart

### 1. Clone & Set Up Environment

```bash
git clone https://github.com/ishanegi7/ContextDrift.git
cd ContextDrift

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .\.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment (Optional)

```bash
cp .env.example .env
```

*By default, no API key is required.* ContextDrift runs out of the box using FastEmbed and an offline heuristic evaluator. To use a cloud LLM, set ONE of:
- `GROQ_API_KEY=...`
- `OPENAI_API_KEY=...`
- `GEMINI_API_KEY=...`

### 3. Run the Server

```bash
uvicorn app.main:app --reload
```

Open **[http://127.0.0.1:8000](http://127.0.0.1:8000)** in your browser.

---

## 60-Second Demo Walkthrough

1. **Ingest and test tab**:
   - Click **A: Ingest Leave Policy 2024** (*"Employees get 24 paid annual leaves..."*).
   - Click **B: Ingest Leave Policy 2026** (*"Employees get 15 paid annual leaves..."*).
   - Observe the neighborhood search trace, the **`CONTRADICTORY`** verdict (24 to 15), and the real-time word-level diff. The 2024 chunk is marked red (`deprecated`), and the 2026 chunk is marked green (`active`).
2. **RAG playground tab**:
   - Ask: *"How many paid annual leaves do employees get?"*
   - The response cites the 2026 policy. The 2024 policy appears under **Blocked as stale** with the exact deprecation reason.
3. **Conflict resolution tab**:
   - Click **Revert / undo** on the conflict card.
   - Return to the RAG playground and ask the question again: the 2024 chunk is back in use!
   - Click **Re-apply healing** to restore the automated deprecation.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/ingest` | Ingest document via JSON (`{doc_name, text}`) or multipart form (`doc_name`, `text`, `file`) |
| `POST` | `/api/query` | Query RAG with `{prompt, top_k}`; returns `answer`, `used_chunks`, and `blocked_chunks` |
| `GET` | `/api/chunks` | Retrieve all chunks with metadata (`?status=latest|deprecated|rejected`) |
| `GET` | `/api/audit-logs` | Retrieve the self-healing timeline (`?conflicts_only=true&limit=100`) |
| `POST` | `/api/conflicts/{id}/toggle` | Revert or re-apply a specific self-healing decision |
| `GET` | `/api/lineage` | Export the knowledge lineage graph (`nodes`, `edges`, `stats`) |
| `GET` | `/api/stats` | System health score, chunk counts, and healed/reverted metrics |
| `GET` | `/api/health` | Active embedder, model name, and LLM evaluator status |
| `POST` | `/api/reset` | Clear all chunks, SQLite lineage graph, and audit records |

Interactive OpenAPI documentation is available at **[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)**.

---

## Project Structure

```
ContextDrift/
├── app/
│   ├── main.py           # FastAPI application, ingest & query pipelines, routes
│   ├── config.py         # Environment-driven settings and model provider selection
│   ├── models.py         # Pydantic v2 schemas for requests, responses, and evaluation
│   ├── vector_store.py   # Semantic chunker, FastEmbed/hashing embedder, ChromaDB wrapper
│   ├── evaluator.py      # Multi-provider conflict auditor (Groq / OpenAI / Gemini / Mock)
│   ├── graph_lineage.py  # SQLite knowledge lineage graph and audit logger
│   └── static/           # Single-page dashboard (index.html, app.js, Tailwind CSS)
├── .env.example          # Sample environment configuration
├── requirements.txt      # Core dependencies
└── README.md             # Project documentation
```

---

## License

This project is licensed under the MIT License.
