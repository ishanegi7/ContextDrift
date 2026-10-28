"""LLM conflict auditor with a graceful offline fallback.

Providers: Groq, OpenAI (or any OpenAI-compatible endpoint) and Gemini, all
called over plain HTTPS with ``httpx``. If no key is configured, or a call
fails, a deterministic heuristic evaluator returns the same strict
``EvaluationResult`` structure so the pipeline never stops.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

import httpx

from .config import Settings
from .models import EvaluationResult
from .vector_store import content_words

log = logging.getLogger("contextdrift.evaluator")

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

EVAL_SYSTEM = (
    "You are a strict knowledge-base auditor for a RAG system. "
    "Respond with a single JSON object and nothing else: no markdown, no commentary."
)

EVAL_PROMPT = """Compare Chunk A (Existing) and Chunk B (New Incoming).
Determine if Chunk B contradicts, updates, replaces, or invalidates facts in Chunk A.
Return JSON:
{{
  "is_same_entity": bool,
  "verdict": "CONTRADICTORY" | "ADDITIVE" | "DUPLICATE" | "UNRELATED",
  "conflict_summary": string or null,
  "confidence_score": float
}}

Rules:
- CONTRADICTORY: both chunks describe the same subject and B changes, replaces or invalidates a fact in A (numbers, dates, rules, status).
- ADDITIVE: B adds compatible information about the same subject without invalidating A.
- DUPLICATE: B says essentially the same thing as A.
- UNRELATED: different subjects.
- conflict_summary must briefly state what changed (old value vs new value) when the verdict is CONTRADICTORY, otherwise null.
- confidence_score is between 0 and 1.

Chunk A (Existing) [source: {doc_a}]:
\"\"\"{chunk_a}\"\"\"

Chunk B (New Incoming) [source: {doc_b}]:
\"\"\"{chunk_b}\"\"\"
"""

ANSWER_SYSTEM = (
    "You are a retrieval-augmented assistant. Answer ONLY from the context chunks provided. "
    "If the context does not contain the answer, say you do not have current information. "
    "Cite the chunk ids you used in square brackets, for example [chk_ab12]. Be concise: at most three sentences."
)

# --------------------------------------------------------------------------- heuristic helpers

_NUMBER = re.compile(r"(?<![\w.])\d+(?:[.,]\d+)*")
_YEAR = re.compile(r"(19|20)\d\d")
_NEGATIONS = frozenset(
    ["not", "no", "never", "cannot", "can't", "won't", "isn't", "aren't", "don't", "doesn't", "without", "nor", "longer"]
)
_REPLACE_PHRASES = (
    "no longer", "replaces", "replaced", "supersedes", "superseded", "deprecated",
    "instead of", "effective immediately", "is now", "are now", "has been changed",
    "have been changed", "updated to", "revised to", "changed to",
)
_SENT = re.compile(r"(?<=[.!?])\s+")


def numbers_in(text: str) -> set:
    """Numeric facts in a text. Four-digit years are ignored so '2024' vs '2026'
    in a title does not count as a changed fact."""
    found = set()
    for raw in _NUMBER.findall(text):
        value = raw.replace(",", "")
        if _YEAR.fullmatch(value):
            continue
        found.add(value)
    return found


def entity_label(text_a: str, text_b: str) -> str:
    """Short label for the thing both chunks talk about (their shared key terms)."""
    shared = set(content_words(text_a)) & set(content_words(text_b))
    ranked = sorted(shared, key=lambda w: (-len(w), w))[:3]
    return " / ".join(ranked) if ranked else "shared topic"


def mock_evaluate(chunk_a: str, chunk_b: str) -> EvaluationResult:
    """Deterministic offline evaluator.

    Same subject = high overlap of content words. Then:
    changed numbers or a flipped negation or an explicit 'replaces' phrase => CONTRADICTORY.
    """
    words_a, words_b = set(content_words(chunk_a)), set(content_words(chunk_b))
    union = words_a | words_b
    jaccard = len(words_a & words_b) / len(union) if union else 0.0
    nums_a, nums_b = numbers_in(chunk_a), numbers_in(chunk_b)

    norm_a = " ".join(chunk_a.lower().split())
    norm_b = " ".join(chunk_b.lower().split())
    if norm_a == norm_b or (jaccard >= 0.97 and nums_a == nums_b):
        return EvaluationResult(
            is_same_entity=True, verdict="DUPLICATE", conflict_summary=None, confidence_score=0.97
        )

    if jaccard < 0.25:
        return EvaluationResult(
            is_same_entity=False, verdict="UNRELATED", conflict_summary=None,
            confidence_score=round(min(0.95, 0.7 + (0.25 - jaccard)), 2),
        )

    shared_terms = ", ".join(sorted(words_a & words_b, key=lambda w: (-len(w), w))[:4])
    removed, added = nums_a - nums_b, nums_b - nums_a
    if removed and added:
        summary = (
            f"Same subject ({shared_terms}) but the figure changed from "
            f"{', '.join(sorted(removed))} to {', '.join(sorted(added))}."
        )
        return EvaluationResult(
            is_same_entity=True, verdict="CONTRADICTORY", conflict_summary=summary,
            confidence_score=round(min(0.95, 0.6 + 0.35 * jaccard), 2),
        )

    tokens_a = set(re.findall(r"[a-z']+", chunk_a.lower()))
    tokens_b = set(re.findall(r"[a-z']+", chunk_b.lower()))
    if bool(tokens_a & _NEGATIONS) != bool(tokens_b & _NEGATIONS) and jaccard >= 0.5:
        return EvaluationResult(
            is_same_entity=True, verdict="CONTRADICTORY",
            conflict_summary=f"The new text reverses the polarity of a statement about {shared_terms}.",
            confidence_score=round(min(0.9, 0.55 + 0.3 * jaccard), 2),
        )

    lowered_b, lowered_a = chunk_b.lower(), chunk_a.lower()
    cue = next((p for p in _REPLACE_PHRASES if p in lowered_b and p not in lowered_a), None)
    if cue and jaccard >= 0.4:
        return EvaluationResult(
            is_same_entity=True, verdict="CONTRADICTORY",
            conflict_summary=f"The new text explicitly updates or replaces earlier guidance on {shared_terms} (\"{cue}\").",
            confidence_score=0.7,
        )

    return EvaluationResult(
        is_same_entity=True, verdict="ADDITIVE", conflict_summary=None,
        confidence_score=round(min(0.9, 0.55 + 0.3 * jaccard), 2),
    )


def _extract_json(raw: str) -> Dict[str, Any]:
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip(), flags=re.MULTILINE).strip()
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("model returned no JSON object")
    return json.loads(cleaned[start:end + 1])


def _extractive_answer(question: str, chunks: List[Dict[str, Any]]) -> str:
    query_words = set(content_words(question))
    scored: List[Tuple[float, str, str]] = []
    for chunk in chunks:
        for line in re.split(r"\n+", chunk["text"]):
            for sentence in _SENT.split(line.strip()):
                sentence = sentence.strip().lstrip("#").strip()
                if len(sentence.split()) < 4:
                    continue
                overlap = len(query_words & set(content_words(sentence)))
                if overlap == 0:
                    continue
                score = overlap / (len(query_words) or 1) + 0.25 * float(chunk.get("similarity") or 0.0)
                scored.append((score, sentence, chunk["chunk_id"]))
    scored.sort(key=lambda row: row[0], reverse=True)
    picked: List[Tuple[str, str]] = []
    seen = set()
    for _, sentence, chunk_id in scored:
        if sentence in seen:
            continue
        seen.add(sentence)
        picked.append((sentence, chunk_id))
        if len(picked) == 2:
            break
    if not picked:
        top = chunks[0]
        first = next((s.strip() for s in _SENT.split(top["text"].replace("\n", " ")) if s.strip()), top["text"])
        picked = [(first, top["chunk_id"])]
    return " ".join(f"{sentence} [{chunk_id}]" for sentence, chunk_id in picked)


# --------------------------------------------------------------------------- evaluator


class ConflictEvaluator:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        provider = settings.llm_provider
        self.provider_note: Optional[str] = None
        if provider != "mock" and not settings.api_key_for(provider):
            self.provider_note = f"LLM_PROVIDER={provider} but its API key is empty; using the offline evaluator."
            provider = "mock"
        self.provider = provider
        self.model = settings.model_for(provider)
        self.last_error: Optional[str] = self.provider_note

    @property
    def mode(self) -> str:
        return "live" if self.provider != "mock" else "offline-mock"

    @property
    def engine_label(self) -> str:
        return f"{self.provider}:{self.model}" if self.provider != "mock" else "mock-heuristic"

    # ---- public API

    def evaluate(
        self, old_text: str, new_text: str, old_doc: str = "existing", new_doc: str = "incoming"
    ) -> Tuple[EvaluationResult, str]:
        if self.provider != "mock":
            prompt = EVAL_PROMPT.format(doc_a=old_doc, chunk_a=old_text, doc_b=new_doc, chunk_b=new_text)
            try:
                raw = self._chat(EVAL_SYSTEM, prompt, json_mode=True)
                result = EvaluationResult.model_validate(_extract_json(raw))
                self.last_error = None
                return result, self.engine_label
            except Exception as exc:
                self.last_error = f"{type(exc).__name__}: {exc}"[:300]
                log.warning("LLM evaluation failed, using offline evaluator: %s", self.last_error)
                return mock_evaluate(old_text, new_text), f"mock-fallback ({self.provider} error)"
        return mock_evaluate(old_text, new_text), "mock-heuristic"

    def answer(self, question: str, chunks: List[Dict[str, Any]], blocked_count: int = 0) -> Tuple[str, str]:
        if not chunks:
            if blocked_count:
                return (
                    "I can't answer this from current knowledge. The only matching documents are deprecated "
                    "and were blocked from retrieval. Ingest an up-to-date source or revert the conflict.",
                    "guardrail",
                )
            return ("No indexed knowledge matches this question yet. Ingest a document first.", "guardrail")
        if self.provider != "mock":
            context = "\n\n".join(f"[{c['chunk_id']}] ({c['doc_name']})\n{c['text']}" for c in chunks)
            try:
                text = self._chat(ANSWER_SYSTEM, f"Context:\n{context}\n\nQuestion: {question}", json_mode=False)
                self.last_error = None
                return text.strip(), self.engine_label
            except Exception as exc:
                self.last_error = f"{type(exc).__name__}: {exc}"[:300]
                log.warning("LLM answer failed, using extractive answer: %s", self.last_error)
                return _extractive_answer(question, chunks), f"extractive-fallback ({self.provider} error)"
        return _extractive_answer(question, chunks), "extractive-offline"

    # ---- provider plumbing

    def _chat(self, system: str, user: str, json_mode: bool) -> str:
        key = self.settings.api_key_for(self.provider)
        timeout = self.settings.llm_timeout
        if self.provider in ("groq", "openai"):
            url = GROQ_URL if self.provider == "groq" else f"{self.settings.openai_base_url}/chat/completions"
            payload: Dict[str, Any] = {
                "model": self.model,
                "temperature": 0,
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            }
            if json_mode:
                payload["response_format"] = {"type": "json_object"}
            resp = httpx.post(url, headers={"Authorization": f"Bearer {key}"}, json=payload, timeout=timeout)
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

        if self.provider == "gemini":
            generation: Dict[str, Any] = {"temperature": 0}
            if json_mode:
                generation["responseMimeType"] = "application/json"
            payload = {
                "systemInstruction": {"parts": [{"text": system}]},
                "contents": [{"role": "user", "parts": [{"text": user}]}],
                "generationConfig": generation,
            }
            resp = httpx.post(
                GEMINI_URL.format(model=self.model),
                headers={"x-goog-api-key": key, "Content-Type": "application/json"},
                json=payload,
                timeout=timeout,
            )
            resp.raise_for_status()
            parts = resp.json()["candidates"][0]["content"]["parts"]
            return "".join(p.get("text", "") for p in parts)

        raise RuntimeError(f"unsupported provider: {self.provider}")
