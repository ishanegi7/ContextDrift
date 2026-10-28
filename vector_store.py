"""Vector layer: embeddings, semantic chunking and a ChromaDB wrapper.

Metadata filtering is the heart of the self-healing loop. Every chunk carries
an ``active`` boolean; retrieval for answers uses ``where={"active": True}``
while the audit view uses ``where={"active": False}`` to show what was blocked.
"""
from __future__ import annotations

import hashlib
import logging
import re
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional

import chromadb
import numpy as np
from chromadb.config import Settings as ChromaSettings

log = logging.getLogger("contextdrift.vector")

# --------------------------------------------------------------------------- text helpers

STOPWORDS = frozenset(
    """a an the and or but if then else of to in on at by for with from as is are was were be been being
    it its this that these those there here we you they he she them our your their his her i me my
    do does did done can could should would will shall may might must have has had having
    per via into onto over under about above below up down out off than too very so just also
    all any each every both either neither some such only own same other more most less least
    who whom whose which what when where why how""".split()
)

_WORD = re.compile(r"[a-z][a-z'\-]*")
_SENT = re.compile(r"(?<=[.!?])\s+")


def stem(word: str) -> str:
    """Tiny suffix stripper so that 'leaves' == 'leave' and 'refunds' == 'refund'."""
    if len(word) > 4 and word.endswith("ies"):
        return word[:-3] + "y"
    if len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
        return word[:-1]
    return word


def content_words(text: str) -> List[str]:
    """Lower-cased, stop-word-free, stemmed alphabetic tokens (numbers excluded)."""
    return [stem(w) for w in _WORD.findall(text.lower()) if w not in STOPWORDS and len(w) > 1]


# --------------------------------------------------------------------------- chunking


def _hard_split(piece: str, limit: int) -> List[str]:
    out: List[str] = []
    piece = piece.strip()
    while len(piece) > limit:
        cut = piece.rfind(" ", 0, limit)
        if cut <= 0:
            cut = limit
        out.append(piece[:cut].strip())
        piece = piece[cut:].strip()
    if piece:
        out.append(piece)
    return out


def _units(text: str, max_chars: int) -> List[tuple]:
    """Break text into (piece, separator_before) units: sentences that remember
    whether they opened a new paragraph, a new line or just follow a sentence."""
    units: List[tuple] = []
    for paragraph in re.split(r"\n\s*\n", text):
        if not paragraph.strip():
            continue
        first_in_paragraph = True
        for line in paragraph.split("\n"):
            line = re.sub(r"[ \t]+", " ", line).strip()
            if not line:
                continue
            first_in_line = True
            for sentence in _SENT.split(line):
                for piece in _hard_split(sentence, max_chars):
                    if first_in_paragraph:
                        sep = "\n\n"
                    elif first_in_line:
                        sep = "\n"
                    else:
                        sep = " "
                    units.append((piece, sep))
                    first_in_paragraph = False
                    first_in_line = False
    return units


def _overlap_tail(text: str, size: int) -> str:
    if size <= 0 or len(text) <= size:
        return ""
    tail = text[-size:]
    space = tail.find(" ")
    if space != -1:
        tail = tail[space + 1:]
    return tail.strip()


def chunk_text(text: str, min_chars: int = 300, max_chars: int = 500, overlap: int = 60) -> List[str]:
    """Paragraph-aware chunking.

    Sentences are packed greedily up to ``max_chars``. A paragraph boundary
    closes the current chunk once it holds at least ``min_chars`` so chunks stay
    logically aligned. Consecutive chunks share ``overlap`` trailing characters.
    Short documents simply produce a single, shorter chunk.
    """
    text = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not text:
        return []
    chunks: List[str] = []
    current = ""
    for piece, sep in _units(text, max_chars):
        if not current:
            current = piece
            continue
        projected = len(current) + len(sep) + len(piece)
        paragraph_break = sep == "\n\n" and len(current) >= min_chars
        if projected > max_chars or paragraph_break:
            chunks.append(current)
            tail = _overlap_tail(current, overlap)
            if tail and len(tail) + 1 + len(piece) <= max_chars:
                current = tail + " " + piece
            else:
                current = piece
        else:
            current += sep + piece
    if current:
        chunks.append(current)
    return chunks


# --------------------------------------------------------------------------- embeddings


class HashingEmbedder:
    """Deterministic bag-of-words embedder used when the neural model is unavailable."""

    dim = 384

    def embed(self, texts: List[str]) -> List[List[float]]:
        out: List[List[float]] = []
        for text in texts:
            vec = np.zeros(self.dim, dtype=np.float64)
            tokens = content_words(text) + re.findall(r"\d+", text)
            for token in tokens:
                digest = int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16)
                vec[digest % self.dim] += 1.0 if (digest >> 24) & 1 else -1.0
            for left, right in zip(tokens, tokens[1:]):
                digest = int(hashlib.md5(f"{left}_{right}".encode("utf-8")).hexdigest(), 16)
                vec[digest % self.dim] += 0.5 if (digest >> 24) & 1 else -0.5
            norm = float(np.linalg.norm(vec))
            out.append((vec / norm if norm else vec).tolist())
        return out


class Embedder:
    """FastEmbed (all-MiniLM-L6-v2 by default) with a local hashing fallback."""

    def __init__(self, model_name: str, force_fallback: bool = False) -> None:
        self.model_name = model_name
        self.backend = "hashing"
        self.tag = "hash"
        self.note: Optional[str] = None
        self._model = None
        self._lock = threading.Lock()
        self._fallback = HashingEmbedder()
        if force_fallback:
            self.note = "FORCE_HASH_EMBEDDINGS is set; using the local hashing embedder."
            self.model_name = "hashing-384"
            return
        try:
            from fastembed import TextEmbedding

            self._model = TextEmbedding(model_name=model_name)
            self.backend = "fastembed"
            self.tag = hashlib.md5(model_name.encode("utf-8")).hexdigest()[:8]
        except Exception as exc:  # network/offline, unsupported model, missing wheels...
            log.warning("FastEmbed unavailable (%s). Falling back to hashing embedder.", exc)
            self.note = f"FastEmbed unavailable ({type(exc).__name__}); using the local hashing embedder."
            self.model_name = "hashing-384"

    def embed(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        if self._model is not None:
            with self._lock:
                return [[float(x) for x in vec] for vec in self._model.embed(list(texts))]
        return self._fallback.embed(list(texts))


# --------------------------------------------------------------------------- vector store


def _blank(value: Any) -> Optional[str]:
    return value if isinstance(value, str) and value else None


def to_chunk_dict(chunk_id: str, text: str, meta: Dict[str, Any], similarity: Optional[float] = None) -> Dict[str, Any]:
    return {
        "chunk_id": chunk_id,
        "doc_name": meta.get("doc_name", ""),
        "text": text,
        "created_at": meta.get("created_at", ""),
        "chunk_index": int(meta.get("chunk_index", 0)),
        "active": bool(meta.get("active", False)),
        "status": meta.get("status", "latest"),
        "superseded_by": _blank(meta.get("superseded_by")),
        "supersedes": _blank(meta.get("supersedes")),
        "similarity": None if similarity is None else round(float(similarity), 4),
        "block_reason": None,
    }


class VectorStore:
    """Thin ChromaDB wrapper. Chroma metadata cannot hold None, so empty strings
    are stored and converted back to None on the way out."""

    def __init__(self, persist_dir: Path, embedder: Embedder) -> None:
        persist_dir.mkdir(parents=True, exist_ok=True)
        self.embedder = embedder
        self.name = f"contextdrift_{embedder.tag}"
        self.client = chromadb.PersistentClient(
            path=str(persist_dir),
            settings=ChromaSettings(anonymized_telemetry=False, allow_reset=True),
        )
        self.collection = self._open()
        self._lock = threading.RLock()

    def _open(self):
        return self.client.get_or_create_collection(
            name=self.name,
            metadata={"hnsw:space": "cosine"},
            embedding_function=None,
        )

    # ---- writes

    def add(self, items: List[Dict[str, Any]]) -> None:
        if not items:
            return
        with self._lock:
            self.collection.add(
                ids=[i["id"] for i in items],
                documents=[i["text"] for i in items],
                embeddings=[i["embedding"] for i in items],
                metadatas=[i["metadata"] for i in items],
            )

    def update_metadata(self, chunk_id: str, patch: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        with self._lock:
            res = self.collection.get(ids=[chunk_id], include=["metadatas"])
            metas = res.get("metadatas") or []
            if not metas:
                return None
            merged = dict(metas[0] or {})
            merged.update(patch)
            self.collection.update(ids=[chunk_id], metadatas=[merged])
        return self.get_chunk(chunk_id)

    def reset(self) -> None:
        with self._lock:
            try:
                self.client.delete_collection(self.name)
            except Exception as exc:  # collection may not exist yet
                log.debug("delete_collection: %s", exc)
            self.collection = self._open()

    # ---- reads

    def count(self) -> int:
        return int(self.collection.count())

    def get_chunk(self, chunk_id: str) -> Optional[Dict[str, Any]]:
        res = self.collection.get(ids=[chunk_id], include=["documents", "metadatas"])
        ids = res.get("ids") or []
        if not ids:
            return None
        return to_chunk_dict(ids[0], (res.get("documents") or [""])[0], (res.get("metadatas") or [{}])[0] or {})

    def list_chunks(self) -> List[Dict[str, Any]]:
        res = self.collection.get(include=["documents", "metadatas"])
        ids = res.get("ids") or []
        docs = res.get("documents") or []
        metas = res.get("metadatas") or []
        rows = [to_chunk_dict(ids[i], docs[i], metas[i] or {}) for i in range(len(ids))]
        rows.sort(key=lambda r: (r["created_at"], r["doc_name"], r["chunk_index"]))
        return rows

    def search_by_embedding(
        self, embedding: List[float], k: int, active: bool, min_sim: float
    ) -> List[Dict[str, Any]]:
        """Top-k nearest chunks whose ``active`` flag equals ``active``,
        keeping only those with cosine similarity >= ``min_sim``."""
        total = self.count()
        if total == 0 or k <= 0:
            return []
        try:
            res = self.collection.query(
                query_embeddings=[embedding],
                n_results=min(k, total),
                where={"active": active},
                include=["documents", "metadatas", "distances"],
            )
        except Exception as exc:
            log.debug("Chroma query failed (%s); using exact search fallback.", exc)
            return self._exact_search(embedding, k, active, min_sim)

        ids = (res.get("ids") or [[]])[0]
        docs = (res.get("documents") or [[]])[0]
        metas = (res.get("metadatas") or [[]])[0]
        dists = (res.get("distances") or [[]])[0]
        hits: List[Dict[str, Any]] = []
        for i, cid in enumerate(ids):
            sim = 1.0 - float(dists[i])  # collection uses cosine distance
            if sim >= min_sim:
                hits.append(to_chunk_dict(cid, docs[i], metas[i] or {}, sim))
        hits.sort(key=lambda h: h["similarity"] or 0.0, reverse=True)
        return hits

    def _exact_search(self, embedding: List[float], k: int, active: bool, min_sim: float) -> List[Dict[str, Any]]:
        res = self.collection.get(where={"active": active}, include=["documents", "metadatas", "embeddings"])
        ids = res.get("ids")
        embs = res.get("embeddings")
        if ids is None or len(ids) == 0 or embs is None:
            return []
        docs = res.get("documents") or []
        metas = res.get("metadatas") or []
        q = np.asarray(embedding, dtype=np.float64)
        qn = float(np.linalg.norm(q)) or 1.0
        scored = []
        for i in range(len(ids)):
            v = np.asarray(embs[i], dtype=np.float64)
            vn = float(np.linalg.norm(v)) or 1.0
            sim = float(np.dot(q, v) / (qn * vn))
            if sim >= min_sim:
                scored.append((sim, i))
        scored.sort(reverse=True)
        return [to_chunk_dict(ids[i], docs[i], metas[i] or {}, sim) for sim, i in scored[:k]]
