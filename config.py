"""Environment-driven settings for ContextDrift.

Everything is optional: with no API key the system runs on a local heuristic
evaluator, and if the embedding model cannot be downloaded it falls back to a
local hashing embedder, so the demo always works.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

PROVIDERS = ("groq", "openai", "gemini", "mock")


def _float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def _bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _data_dir() -> Path:
    raw = os.getenv("DATA_DIR", "data")
    path = Path(raw)
    return path if path.is_absolute() else (BASE_DIR / path)


def _resolve_provider() -> str:
    explicit = os.getenv("LLM_PROVIDER", "").strip().lower()
    if explicit in PROVIDERS:
        return explicit
    if os.getenv("GROQ_API_KEY"):
        return "groq"
    if os.getenv("OPENAI_API_KEY"):
        return "openai"
    if os.getenv("GEMINI_API_KEY"):
        return "gemini"
    return "mock"


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    embedding_model: str
    force_hash_embeddings: bool

    llm_provider: str
    groq_api_key: str
    openai_api_key: str
    gemini_api_key: str
    groq_model: str
    openai_model: str
    gemini_model: str
    openai_base_url: str
    llm_timeout: float

    similarity_threshold: float      # neighbourhood search cut-off (cosine similarity)
    neighbor_k: int                  # neighbours compared per incoming chunk
    min_confidence: float            # evaluator confidence needed to act on a verdict
    retrieval_min_similarity: float  # floor for chunks returned by /api/query

    chunk_min_chars: int
    chunk_max_chars: int
    chunk_overlap: int

    def api_key_for(self, provider: str) -> str:
        return {
            "groq": self.groq_api_key,
            "openai": self.openai_api_key,
            "gemini": self.gemini_api_key,
        }.get(provider, "")

    def model_for(self, provider: str) -> str:
        return {
            "groq": self.groq_model,
            "openai": self.openai_model,
            "gemini": self.gemini_model,
        }.get(provider, "heuristic")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        data_dir=_data_dir(),
        embedding_model=os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"),
        force_hash_embeddings=_bool("FORCE_HASH_EMBEDDINGS", False),
        llm_provider=_resolve_provider(),
        groq_api_key=os.getenv("GROQ_API_KEY", "").strip(),
        openai_api_key=os.getenv("OPENAI_API_KEY", "").strip(),
        gemini_api_key=os.getenv("GEMINI_API_KEY", "").strip(),
        groq_model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
        openai_model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
        openai_base_url=os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/"),
        llm_timeout=_float("LLM_TIMEOUT_SECONDS", 30.0),
        similarity_threshold=_float("SIMILARITY_THRESHOLD", 0.70),
        neighbor_k=_int("NEIGHBOR_K", 3),
        min_confidence=_float("MIN_CONFIDENCE", 0.50),
        retrieval_min_similarity=_float("RETRIEVAL_MIN_SIMILARITY", 0.25),
        chunk_min_chars=_int("CHUNK_MIN_CHARS", 300),
        chunk_max_chars=_int("CHUNK_MAX_CHARS", 500),
        chunk_overlap=_int("CHUNK_OVERLAP", 60),
    )
