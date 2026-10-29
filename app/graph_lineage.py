"""Embedded knowledge-graph lineage tracker (SQLite).

Nodes:  Document, Chunk, Entity
Edges:  CONTAINS (Document->Chunk), ABOUT (Chunk->Entity),
        SUPERSEDED_BY (OldChunk->NewChunk), SUPERSEDES (NewDocument->OldDocument)
Plus an ``audit_logs`` table that snapshots every self-healing decision.
"""
from __future__ import annotations

import json
import re
import sqlite3
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional

from .models import utc_now

SCHEMA = """
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    label TEXT NOT NULL,
    props TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS edges (
    src TEXT NOT NULL,
    dst TEXT NOT NULL,
    relation TEXT NOT NULL,
    created_at TEXT NOT NULL,
    reverted INTEGER NOT NULL DEFAULT 0,
    meta TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (src, dst, relation)
);
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    event TEXT NOT NULL,
    old_chunk_id TEXT,
    new_chunk_id TEXT,
    old_doc TEXT,
    new_doc TEXT,
    old_text TEXT,
    new_text TEXT,
    similarity REAL,
    verdict TEXT,
    confidence REAL,
    summary TEXT,
    engine TEXT,
    reverted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_audit_old ON audit_logs(old_chunk_id);
CREATE INDEX IF NOT EXISTS idx_audit_new ON audit_logs(new_chunk_id);
"""

CONFLICT_EVENT = "CONFLICT_HEALED"
DUPLICATE_EVENT = "DUPLICATE_SKIPPED"


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "entity"


def _audit_row(row: sqlite3.Row) -> Dict[str, Any]:
    data = dict(row)
    data["reverted"] = bool(data.get("reverted"))
    return data


class LineageGraph:
    def __init__(self, db_path: Path) -> None:
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(db_path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._lock = threading.RLock()
        with self._lock:
            self._conn.executescript(SCHEMA)
            self._conn.commit()

    # ---- internal helpers (caller holds the lock; no commit)

    def _upsert_node(self, node_id: str, node_type: str, label: str, props: Dict[str, Any]) -> None:
        self._conn.execute(
            "INSERT INTO nodes(id, type, label, props) VALUES (?, ?, ?, ?) "
            "ON CONFLICT(id) DO UPDATE SET label = excluded.label, props = excluded.props",
            (node_id, node_type, label, json.dumps(props)),
        )

    def _add_edge(self, src: str, dst: str, relation: str, meta: Optional[Dict[str, Any]] = None) -> None:
        self._conn.execute(
            "INSERT OR REPLACE INTO edges(src, dst, relation, created_at, reverted, meta) VALUES (?, ?, ?, ?, 0, ?)",
            (src, dst, relation, utc_now(), json.dumps(meta or {})),
        )

    def _insert_audit(self, **fields: Any) -> int:
        columns = [
            "event", "old_chunk_id", "new_chunk_id", "old_doc", "new_doc", "old_text", "new_text",
            "similarity", "verdict", "confidence", "summary", "engine",
        ]
        values = [fields.get(c) for c in columns]
        cur = self._conn.execute(
            f"INSERT INTO audit_logs(created_at, {', '.join(columns)}) VALUES (?, {', '.join('?' for _ in columns)})",
            [utc_now(), *values],
        )
        return int(cur.lastrowid)

    # ---- chunk / document registration

    def register_chunk(self, chunk_id: str, doc_name: str, text: str, status: str = "latest", active: bool = True) -> None:
        with self._lock:
            self._upsert_node(f"doc:{doc_name}", "Document", doc_name, {})
            self._upsert_node(
                f"chunk:{chunk_id}", "Chunk", chunk_id,
                {"doc_name": doc_name, "status": status, "active": active, "preview": text[:160]},
            )
            self._add_edge(f"doc:{doc_name}", f"chunk:{chunk_id}", "CONTAINS")
            self._conn.commit()

    def update_chunk_state(self, chunk_id: str, status: str, active: bool) -> None:
        with self._lock:
            row = self._conn.execute("SELECT props FROM nodes WHERE id = ?", (f"chunk:{chunk_id}",)).fetchone()
            if row is None:
                return
            props = json.loads(row["props"])
            props.update({"status": status, "active": active})
            self._conn.execute("UPDATE nodes SET props = ? WHERE id = ?", (json.dumps(props), f"chunk:{chunk_id}"))
            self._conn.commit()

    # ---- audit events

    def record_conflict(
        self,
        *,
        old_chunk_id: str,
        new_chunk_id: str,
        old_doc: str,
        new_doc: str,
        old_text: str,
        new_text: str,
        similarity: float,
        verdict: str,
        confidence: float,
        summary: Optional[str],
        engine: str,
        entity: str,
    ) -> int:
        with self._lock:
            old_node, new_node = f"chunk:{old_chunk_id}", f"chunk:{new_chunk_id}"
            entity_node = f"entity:{_slug(entity)}"
            self._upsert_node(entity_node, "Entity", entity, {})
            self._add_edge(old_node, new_node, "SUPERSEDED_BY", {"summary": summary, "confidence": confidence})
            self._add_edge(old_node, entity_node, "ABOUT")
            self._add_edge(new_node, entity_node, "ABOUT")
            if old_doc != new_doc:
                self._add_edge(f"doc:{new_doc}", f"doc:{old_doc}", "SUPERSEDES")
            audit_id = self._insert_audit(
                event=CONFLICT_EVENT, old_chunk_id=old_chunk_id, new_chunk_id=new_chunk_id,
                old_doc=old_doc, new_doc=new_doc, old_text=old_text, new_text=new_text,
                similarity=similarity, verdict=verdict, confidence=confidence, summary=summary, engine=engine,
            )
            self._conn.commit()
            return audit_id

    def record_duplicate(
        self, *, old_chunk_id: str, old_doc: str, new_doc: str, old_text: str, new_text: str,
        similarity: float, confidence: float, engine: str,
    ) -> int:
        with self._lock:
            audit_id = self._insert_audit(
                event=DUPLICATE_EVENT, old_chunk_id=old_chunk_id, new_chunk_id=None,
                old_doc=old_doc, new_doc=new_doc, old_text=old_text, new_text=new_text,
                similarity=similarity, verdict="DUPLICATE", confidence=confidence,
                summary="Incoming chunk duplicates an active chunk and was not stored.", engine=engine,
            )
            self._conn.commit()
            return audit_id

    def get_audit(self, audit_id: int) -> Optional[Dict[str, Any]]:
        with self._lock:
            row = self._conn.execute("SELECT * FROM audit_logs WHERE id = ?", (audit_id,)).fetchone()
        return _audit_row(row) if row else None

    def list_audit(self, limit: int = 200, event: Optional[str] = None) -> List[Dict[str, Any]]:
        with self._lock:
            if event:
                rows = self._conn.execute(
                    "SELECT * FROM audit_logs WHERE event = ? ORDER BY id DESC LIMIT ?", (event, limit)
                ).fetchall()
            else:
                rows = self._conn.execute("SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
        return [_audit_row(r) for r in rows]

    def conflicts_for(self, chunk_id: str, role: str, open_only: bool) -> List[Dict[str, Any]]:
        """Healed conflicts in which ``chunk_id`` is the old ('old') or new ('new') side."""
        column = "old_chunk_id" if role == "old" else "new_chunk_id"
        sql = f"SELECT * FROM audit_logs WHERE event = ? AND {column} = ?"
        if open_only:
            sql += " AND reverted = 0"
        sql += " ORDER BY id ASC"
        with self._lock:
            rows = self._conn.execute(sql, (CONFLICT_EVENT, chunk_id)).fetchall()
        return [_audit_row(r) for r in rows]

    def set_reverted(self, audit_id: int, reverted: bool) -> Optional[Dict[str, Any]]:
        with self._lock:
            row = self._conn.execute("SELECT * FROM audit_logs WHERE id = ?", (audit_id,)).fetchone()
            if row is None:
                return None
            self._conn.execute("UPDATE audit_logs SET reverted = ? WHERE id = ?", (1 if reverted else 0, audit_id))
            self._conn.execute(
                "UPDATE edges SET reverted = ? WHERE src = ? AND dst = ? AND relation = 'SUPERSEDED_BY'",
                (1 if reverted else 0, f"chunk:{row['old_chunk_id']}", f"chunk:{row['new_chunk_id']}"),
            )
            self._conn.commit()
        return self.get_audit(audit_id)

    # ---- stats / export / reset

    def conflict_stats(self) -> Dict[str, Any]:
        with self._lock:
            row = self._conn.execute(
                "SELECT COUNT(*) AS c, COALESCE(SUM(reverted), 0) AS r, AVG(confidence) AS a "
                "FROM audit_logs WHERE event = ?", (CONFLICT_EVENT,),
            ).fetchone()
            dups = self._conn.execute(
                "SELECT COUNT(*) AS c FROM audit_logs WHERE event = ?", (DUPLICATE_EVENT,)
            ).fetchone()
            docs = self._conn.execute("SELECT COUNT(*) AS c FROM nodes WHERE type = 'Document'").fetchone()
        return {
            "conflicts": int(row["c"]),
            "reverted": int(row["r"]),
            "avg_confidence": float(row["a"]) if row["a"] is not None else None,
            "duplicates": int(dups["c"]),
            "documents": int(docs["c"]),
        }

    def export(self) -> Dict[str, Any]:
        with self._lock:
            nodes = self._conn.execute("SELECT * FROM nodes ORDER BY type, label").fetchall()
            edges = self._conn.execute("SELECT * FROM edges ORDER BY created_at").fetchall()
        node_list = [
            {"id": n["id"], "type": n["type"], "label": n["label"], "props": json.loads(n["props"])} for n in nodes
        ]
        edge_list = [
            {
                "source": e["src"], "target": e["dst"], "relation": e["relation"],
                "created_at": e["created_at"], "reverted": bool(e["reverted"]), "meta": json.loads(e["meta"]),
            }
            for e in edges
        ]
        counts: Dict[str, int] = {}
        for n in node_list:
            counts[n["type"]] = counts.get(n["type"], 0) + 1
        return {
            "nodes": node_list,
            "edges": edge_list,
            "stats": {"node_counts": counts, "edge_count": len(edge_list), **self.conflict_stats()},
        }

    def reset(self) -> None:
        with self._lock:
            self._conn.executescript(
                "DELETE FROM nodes; DELETE FROM edges; DELETE FROM audit_logs; "
                "DELETE FROM sqlite_sequence WHERE name = 'audit_logs';"
            )
            self._conn.commit()
