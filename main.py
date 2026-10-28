"""ContextDrift API: ingestion with conflict healing, active-filtered RAG proxy, audit + lineage."""
from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError
from starlette.datastructures import UploadFile

from . import __version__
from .config import Settings, get_settings
from .evaluator import ConflictEvaluator, entity_label
from .graph_lineage import CONFLICT_EVENT, LineageGraph
from .models import (
    AuditRecord,
    ChunkView,
    EvaluationTrace,
    HealthResponse,
    IngestRequest,
    IngestResponse,
    LineageExport,
    QueryRequest,
    QueryResponse,
    StatsResponse,
    ToggleResponse,
    utc_now,
)
from .vector_store import Embedder, VectorStore, chunk_text

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("contextdrift")

STATIC_DIR = Path(__file__).resolve().parent / "static"
MAX_UPLOAD_BYTES = 2 * 1024 * 1024
ALLOWED_SUFFIXES = (".md", ".markdown", ".txt", ".text")


@dataclass
class Services:
    settings: Settings
    embedder: Embedder
    store: VectorStore
    graph: LineageGraph
    evaluator: ConflictEvaluator


def build_services() -> Services:
    settings = get_settings()
    embedder = Embedder(settings.embedding_model, force_fallback=settings.force_hash_embeddings)
    store = VectorStore(settings.data_dir / "chroma", embedder)
    graph = LineageGraph(settings.data_dir / "lineage.sqlite3")
    evaluator = ConflictEvaluator(settings)
    log.info(
        "ContextDrift ready | embedder=%s (%s) | evaluator=%s",
        embedder.backend, embedder.model_name, evaluator.engine_label,
    )
    return Services(settings, embedder, store, graph, evaluator)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.svc = await run_in_threadpool(build_services)
    yield


app = FastAPI(
    title="ContextDrift",
    version=__version__,
    description="Self-healing middleware and continuous knowledge auditor for RAG pipelines.",
    lifespan=lifespan,
)


def svc_of(request: Request) -> Services:
    return request.app.state.svc


# --------------------------------------------------------------------------- core pipeline


def ingest_document(svc: Services, doc_name: str, text: str) -> IngestResponse:
    cfg = svc.settings
    pieces = chunk_text(text, cfg.chunk_min_chars, cfg.chunk_max_chars, cfg.chunk_overlap)
    if not pieces:
        raise ValueError("The document has no text to ingest.")

    ingest_id = uuid.uuid4().hex[:8]
    created_at = utc_now()
    embeddings = svc.embedder.embed(pieces)

    created: List[ChunkView] = []
    conflicts: List[AuditRecord] = []
    traces: List[EvaluationTrace] = []
    duplicates = 0
    deprecated_in_batch: set = set()

    for index, (piece, embedding) in enumerate(zip(pieces, embeddings)):
        new_id = f"chk_{uuid.uuid4().hex[:10]}"

        # 1) Neighbourhood search: top-k active neighbours at cosine similarity >= threshold.
        neighbours = svc.store.search_by_embedding(
            embedding, k=cfg.neighbor_k, active=True, min_sim=cfg.similarity_threshold
        )

        # 2) Evaluate (Old_Chunk, New_Chunk) pairs.
        superseded: List[tuple] = []
        is_duplicate = False
        for old in neighbours:
            if old["chunk_id"] in deprecated_in_batch:
                continue
            result, engine = svc.evaluator.evaluate(old["text"], piece, old["doc_name"], doc_name)
            confident = result.confidence_score >= cfg.min_confidence
            if result.verdict == "DUPLICATE" and confident:
                action = "skipped duplicate"
            elif result.verdict == "CONTRADICTORY" and result.is_same_entity and confident:
                action = "deprecated old chunk"
            else:
                action = "no action"
            traces.append(
                EvaluationTrace(
                    new_chunk_id=new_id, old_chunk_id=old["chunk_id"], old_doc=old["doc_name"],
                    similarity=old["similarity"] or 0.0, verdict=result.verdict,
                    is_same_entity=result.is_same_entity, confidence=result.confidence_score,
                    summary=result.conflict_summary, engine=engine, action=action,
                )
            )
            if action == "skipped duplicate":
                is_duplicate = True
                svc.graph.record_duplicate(
                    old_chunk_id=old["chunk_id"], old_doc=old["doc_name"], new_doc=doc_name,
                    old_text=old["text"], new_text=piece, similarity=old["similarity"] or 0.0,
                    confidence=result.confidence_score, engine=engine,
                )
                duplicates += 1
                break
            if action == "deprecated old chunk":
                superseded.append((old, result, engine))

        if is_duplicate:
            continue

        # 3) Store the new chunk as the latest, active version.
        metadata = {
            "chunk_id": new_id,
            "doc_name": doc_name,
            "ingest_id": ingest_id,
            "chunk_index": index,
            "created_at": created_at,
            "active": True,
            "status": "latest",
            "superseded_by": "",
            "supersedes": ",".join(old["chunk_id"] for old, _, _ in superseded),
        }
        svc.store.add([{"id": new_id, "text": piece, "embedding": embedding, "metadata": metadata}])
        svc.graph.register_chunk(new_id, doc_name, piece, "latest", True)

        # 4) Deprecate superseded chunks, record lineage edges and audit entries.
        for old, result, engine in superseded:
            svc.store.update_metadata(
                old["chunk_id"], {"active": False, "status": "deprecated", "superseded_by": new_id}
            )
            svc.graph.update_chunk_state(old["chunk_id"], "deprecated", False)
            audit_id = svc.graph.record_conflict(
                old_chunk_id=old["chunk_id"], new_chunk_id=new_id,
                old_doc=old["doc_name"], new_doc=doc_name,
                old_text=old["text"], new_text=piece,
                similarity=old["similarity"] or 0.0, verdict=result.verdict,
                confidence=result.confidence_score, summary=result.conflict_summary,
                engine=engine, entity=entity_label(old["text"], piece),
            )
            deprecated_in_batch.add(old["chunk_id"])
            record = svc.graph.get_audit(audit_id)
            if record:
                conflicts.append(AuditRecord(**record))

        stored = svc.store.get_chunk(new_id)
        if stored:
            created.append(ChunkView(**stored))

    return IngestResponse(
        ingest_id=ingest_id, doc_name=doc_name, chunks=created, duplicates_skipped=duplicates,
        conflicts=conflicts, evaluations=traces, engine=svc.evaluator.engine_label,
    )


def run_query(svc: Services, prompt: str, top_k: int) -> QueryResponse:
    floor = svc.settings.retrieval_min_similarity
    embedding = svc.embedder.embed([prompt])[0]

    # Only active knowledge may reach the answer.
    active_hits = svc.store.search_by_embedding(embedding, k=top_k, active=True, min_sim=floor)
    # Show what the filter kept out: deprecated / rejected chunks that would otherwise have matched.
    blocked_hits = svc.store.search_by_embedding(embedding, k=top_k, active=False, min_sim=floor)

    blocked_views: List[ChunkView] = []
    for hit in blocked_hits:
        view = ChunkView(**hit)
        replacement = svc.store.get_chunk(hit["superseded_by"]) if hit["superseded_by"] else None
        if hit["status"] == "deprecated" and replacement:
            view.block_reason = f"Deprecated: superseded by {replacement['chunk_id']} ({replacement['doc_name']})"
        elif hit["status"] == "rejected":
            view.block_reason = "Rejected: conflict was reverted by an auditor"
        else:
            view.block_reason = f"Inactive ({hit['status']})"
        blocked_views.append(view)

    answer, engine = svc.evaluator.answer(prompt, active_hits, blocked_count=len(blocked_views))
    return QueryResponse(
        prompt=prompt,
        answer=answer,
        answer_engine=engine,
        used_chunks=[ChunkView(**h) for h in active_hits],
        blocked_chunks=blocked_views,
        stale_context_prevented=bool(blocked_views),
    )


def recompute_chunk_state(svc: Services, chunk_id: str) -> Optional[Dict[str, Any]]:
    """Derive a chunk's state from the audit log so reverts and re-applies always stay consistent."""
    as_old_open = svc.graph.conflicts_for(chunk_id, "old", open_only=True)
    as_new_all = svc.graph.conflicts_for(chunk_id, "new", open_only=False)
    as_new_open = [c for c in as_new_all if not c["reverted"]]
    if as_old_open:
        patch: Dict[str, Any] = {
            "active": False, "status": "deprecated", "superseded_by": as_old_open[-1]["new_chunk_id"],
        }
    elif as_new_all and not as_new_open:
        patch = {"active": False, "status": "rejected", "superseded_by": ""}
    else:
        patch = {"active": True, "status": "latest", "superseded_by": ""}
    patch["supersedes"] = ",".join(c["old_chunk_id"] for c in as_new_open)
    updated = svc.store.update_metadata(chunk_id, patch)
    svc.graph.update_chunk_state(chunk_id, patch["status"], patch["active"])
    return updated


def compute_stats(svc: Services) -> StatsResponse:
    chunks = svc.store.list_chunks()
    stats = svc.graph.conflict_stats()
    total_conflicts, reverted = stats["conflicts"], stats["reverted"]
    if total_conflicts == 0:
        health = 100
    else:
        # Healing trust: how confident the auditor was, discounted by human reversals.
        health = round(100 * (stats["avg_confidence"] or 0.0) * (1 - reverted / total_conflicts))
    return StatsResponse(
        total_chunks=len(chunks),
        active_chunks=sum(1 for c in chunks if c["active"]),
        deprecated_chunks=sum(1 for c in chunks if c["status"] == "deprecated"),
        rejected_chunks=sum(1 for c in chunks if c["status"] == "rejected"),
        documents=len({c["doc_name"] for c in chunks}),
        conflicts_healed=total_conflicts - reverted,
        conflicts_reverted=reverted,
        duplicates_skipped=stats["duplicates"],
        health_score=max(0, min(100, health)),
    )


# --------------------------------------------------------------------------- routes


@app.get("/", include_in_schema=False)
async def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/health", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    svc = svc_of(request)
    return HealthResponse(
        status="ok",
        version=__version__,
        embedder=svc.embedder.backend,
        embedder_model=svc.embedder.model_name,
        embedder_note=svc.embedder.note,
        llm_provider=svc.evaluator.provider,
        llm_model=svc.evaluator.model,
        llm_mode=svc.evaluator.mode,
        last_llm_error=svc.evaluator.last_error,
    )


@app.post("/api/ingest", response_model=IngestResponse)
async def ingest(request: Request) -> IngestResponse:
    """Accepts JSON ({doc_name, text}) or multipart/form-data (doc_name, text and/or file)."""
    svc = svc_of(request)
    content_type = request.headers.get("content-type", "").lower()
    try:
        if content_type.startswith("application/json"):
            body = IngestRequest.model_validate(await request.json())
            doc_name, text = body.doc_name.strip(), body.text
        else:
            form = await request.form()
            doc_name = str(form.get("doc_name") or "").strip()
            text = str(form.get("text") or "")
            upload = form.get("file")
            if isinstance(upload, UploadFile) and upload.filename:
                if not upload.filename.lower().endswith(ALLOWED_SUFFIXES):
                    raise HTTPException(415, "Only Markdown or plain-text files (.md, .markdown, .txt) are supported.")
                raw = await upload.read()
                if len(raw) > MAX_UPLOAD_BYTES:
                    raise HTTPException(413, "File is larger than 2 MB.")
                text = raw.decode("utf-8", errors="replace")
                doc_name = doc_name or upload.filename
    except (ValidationError, ValueError) as exc:
        raise HTTPException(422, f"Invalid request: {exc}") from exc

    if not text.strip():
        raise HTTPException(422, "Provide some text or upload a .md/.txt file.")
    doc_name = doc_name or f"untitled-{uuid.uuid4().hex[:6]}"
    try:
        return await run_in_threadpool(ingest_document, svc, doc_name, text)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@app.post("/api/query", response_model=QueryResponse)
async def query(body: QueryRequest, request: Request) -> QueryResponse:
    return await run_in_threadpool(run_query, svc_of(request), body.prompt.strip(), body.top_k)


@app.get("/api/chunks", response_model=List[ChunkView])
async def chunks(request: Request, status: Optional[str] = Query(default=None)) -> List[ChunkView]:
    rows = await run_in_threadpool(svc_of(request).store.list_chunks)
    if status:
        rows = [r for r in rows if r["status"] == status]
    return [ChunkView(**r) for r in rows]


@app.get("/api/audit-logs", response_model=List[AuditRecord])
async def audit_logs(
    request: Request,
    limit: int = Query(default=100, ge=1, le=500),
    conflicts_only: bool = Query(default=False),
) -> List[AuditRecord]:
    rows = svc_of(request).graph.list_audit(limit=limit, event=CONFLICT_EVENT if conflicts_only else None)
    return [AuditRecord(**r) for r in rows]


@app.post("/api/conflicts/{audit_id}/toggle", response_model=ToggleResponse)
async def toggle_conflict(audit_id: int, request: Request) -> ToggleResponse:
    """Undo a self-healing decision (old chunk reinstated, new chunk rejected) or re-apply it."""
    svc = svc_of(request)

    def work() -> ToggleResponse:
        record = svc.graph.get_audit(audit_id)
        if record is None or record["event"] != CONFLICT_EVENT:
            raise HTTPException(404, f"No conflict with id {audit_id}.")
        updated = svc.graph.set_reverted(audit_id, not record["reverted"])
        old_chunk = recompute_chunk_state(svc, record["old_chunk_id"])
        new_chunk = recompute_chunk_state(svc, record["new_chunk_id"])
        return ToggleResponse(
            conflict=AuditRecord(**updated),
            old_chunk=ChunkView(**old_chunk) if old_chunk else None,
            new_chunk=ChunkView(**new_chunk) if new_chunk else None,
        )

    return await run_in_threadpool(work)


@app.get("/api/lineage", response_model=LineageExport)
async def lineage(request: Request) -> LineageExport:
    return LineageExport(**svc_of(request).graph.export())


@app.get("/api/stats", response_model=StatsResponse)
async def stats(request: Request) -> StatsResponse:
    return await run_in_threadpool(compute_stats, svc_of(request))


@app.post("/api/reset")
async def reset(request: Request) -> Dict[str, str]:
    svc = svc_of(request)

    def work() -> None:
        svc.store.reset()
        svc.graph.reset()

    await run_in_threadpool(work)
    return {"status": "reset"}


app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
