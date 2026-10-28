"""Pydantic v2 schemas shared by the API, evaluator and lineage tracker."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

Verdict = Literal["CONTRADICTORY", "ADDITIVE", "DUPLICATE", "UNRELATED"]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# --------------------------------------------------------------------------- evaluator


class EvaluationResult(BaseModel):
    """Strict structure every evaluator (LLM or heuristic) must return."""

    is_same_entity: bool
    verdict: Verdict
    conflict_summary: Optional[str] = None
    confidence_score: float = Field(ge=0.0, le=1.0)

    @field_validator("verdict", mode="before")
    @classmethod
    def _normalise_verdict(cls, value: Any) -> str:
        return str(value).strip().upper()

    @field_validator("confidence_score", mode="before")
    @classmethod
    def _clamp_confidence(cls, value: Any) -> float:
        try:
            number = float(value)
        except (TypeError, ValueError):
            return 0.0
        return max(0.0, min(1.0, number))

    @field_validator("conflict_summary", mode="before")
    @classmethod
    def _blank_to_none(cls, value: Any) -> Optional[str]:
        if value is None:
            return None
        text = str(value).strip()
        return text or None


# --------------------------------------------------------------------------- chunks


class ChunkView(BaseModel):
    chunk_id: str
    doc_name: str
    text: str
    created_at: str
    chunk_index: int = 0
    active: bool
    status: str
    superseded_by: Optional[str] = None
    supersedes: Optional[str] = None
    similarity: Optional[float] = None
    block_reason: Optional[str] = None


# --------------------------------------------------------------------------- audit / lineage


class AuditRecord(BaseModel):
    id: int
    created_at: str
    event: str
    old_chunk_id: Optional[str] = None
    new_chunk_id: Optional[str] = None
    old_doc: Optional[str] = None
    new_doc: Optional[str] = None
    old_text: Optional[str] = None
    new_text: Optional[str] = None
    similarity: Optional[float] = None
    verdict: Optional[str] = None
    confidence: Optional[float] = None
    summary: Optional[str] = None
    engine: Optional[str] = None
    reverted: bool = False


class LineageExport(BaseModel):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    stats: Dict[str, Any]


# --------------------------------------------------------------------------- ingestion


class IngestRequest(BaseModel):
    doc_name: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=1)


class EvaluationTrace(BaseModel):
    new_chunk_id: str
    old_chunk_id: str
    old_doc: str
    similarity: float
    verdict: str
    is_same_entity: bool
    confidence: float
    summary: Optional[str] = None
    engine: str
    action: str


class IngestResponse(BaseModel):
    ingest_id: str
    doc_name: str
    chunks: List[ChunkView]
    duplicates_skipped: int
    conflicts: List[AuditRecord]
    evaluations: List[EvaluationTrace]
    engine: str


# --------------------------------------------------------------------------- query


class QueryRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=2000)
    top_k: int = Field(default=4, ge=1, le=10)


class QueryResponse(BaseModel):
    prompt: str
    answer: str
    answer_engine: str
    used_chunks: List[ChunkView]
    blocked_chunks: List[ChunkView]
    stale_context_prevented: bool


# --------------------------------------------------------------------------- misc


class ToggleResponse(BaseModel):
    conflict: AuditRecord
    old_chunk: Optional[ChunkView] = None
    new_chunk: Optional[ChunkView] = None


class StatsResponse(BaseModel):
    total_chunks: int
    active_chunks: int
    deprecated_chunks: int
    rejected_chunks: int
    documents: int
    conflicts_healed: int
    conflicts_reverted: int
    duplicates_skipped: int
    health_score: int


class HealthResponse(BaseModel):
    status: str
    version: str
    embedder: str
    embedder_model: str
    embedder_note: Optional[str] = None
    llm_provider: str
    llm_model: str
    llm_mode: str
    last_llm_error: Optional[str] = None
