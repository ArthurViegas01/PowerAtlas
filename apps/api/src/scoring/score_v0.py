"""Heuristic scoring v0: the F5c resumed with zero AI cost.

Counts mentions of the curated public organizations (orgs.py) across the
ingested ``raw_documents`` and turns the frequencies into DRAFT ranking
candidates with mandatory citations:

- score      0-100, linear on mentioning-document count (leader = 100);
- confidence low < 3 docs, medium < 10, high >= 10;
- citations  the mentioning headlines themselves (newest first);
- no citation -> the org simply never becomes a candidate (tested).

Region attribution is BR-only in v0: the allowlisted feeds are national
agencies, so crediting a UF from them would be guesswork. Everything lands
in the staging tables (status draft, enforced by the DB CHECK) and the
served payload stays byte-identical (parity test).
"""

from __future__ import annotations

import json
import re
import unicodedata
from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Protocol

import asyncpg

from src.ingest.service import resolve_dsn
from src.scoring.orgs import ORGS, Org

MODEL = "heuristic-v0"
PROMPT_VERSION = "freq-mencoes-1"
MAX_CITATIONS = 5


class DocLike(Protocol):
    """The slice of a raw_document the heuristic needs."""

    id: int
    title: str
    content: str


@dataclass
class SimpleDoc:
    id: int
    title: str
    content: str


@dataclass
class ScoredOrg:
    org: Org
    doc_ids: list[int] = field(default_factory=list)
    score: int = 0

    @property
    def confidence(self) -> str:
        n = len(self.doc_ids)
        if n >= 10:
            return "high"
        if n >= 3:
            return "medium"
        return "low"

    def rationale(self, total_docs: int) -> str:
        return (
            f"Heuristica v0 (frequencia de mencoes): citada em {len(self.doc_ids)} "
            f"de {total_docs} documentos ingeridos das agencias publicas."
        )


def _fold(text: str) -> str:
    """Lowercase + strip diacritics, so 'Câmara' and 'camara' meet."""
    decomposed = unicodedata.normalize("NFD", text)
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch)).lower()


def _pattern(org: Org) -> re.Pattern[str]:
    names = sorted((org.name, *org.aliases), key=len, reverse=True)
    alternation = "|".join(re.escape(_fold(name)) for name in names)
    return re.compile(rf"(?<![a-z0-9])(?:{alternation})(?![a-z0-9])")


_PATTERNS: list[tuple[Org, re.Pattern[str]]] = [(org, _pattern(org)) for org in ORGS]


def score_documents(docs: Sequence[DocLike]) -> list[ScoredOrg]:
    """Pure core: mention counts -> scored orgs, leader normalized to 100.

    Orgs mentioned in zero documents are dropped here, which IS the
    'no citation -> discarded' rule: a candidate only exists with evidence.
    """
    scored: dict[str, ScoredOrg] = {}
    for doc in docs:
        haystack = _fold(f"{doc.title}\n{doc.content}")
        for org, pattern in _PATTERNS:
            if pattern.search(haystack):
                scored.setdefault(org.name, ScoredOrg(org=org)).doc_ids.append(doc.id)
    ranked = sorted(scored.values(), key=lambda s: len(s.doc_ids), reverse=True)
    top = len(ranked[0].doc_ids) if ranked else 0
    for entry in ranked:
        entry.score = max(1, round(100 * len(entry.doc_ids) / top)) if top else 0
    return ranked


async def run_scoring(dsn: str | None = None) -> dict[str, object]:
    """Score the ingested corpus into draft candidates + citations."""
    conn = await asyncpg.connect(dsn=dsn or resolve_dsn())
    try:
        rows = await conn.fetch(
            "SELECT id, title, content FROM raw_documents ORDER BY published_at DESC NULLS LAST"
        )
        docs = [SimpleDoc(id=r["id"], title=r["title"], content=r["content"]) for r in rows]
        ranked = score_documents(docs)

        run_id: int = await conn.fetchval(
            "INSERT INTO scoring_runs (model, prompt_version, stats)"
            " VALUES ($1, $2, $3) RETURNING id",
            MODEL,
            PROMPT_VERSION,
            json.dumps({"documents": len(docs), "orgs_matched": len(ranked)}),
        )
        titles = {doc.id: doc.title for doc in docs}
        for entry in ranked:
            if not entry.doc_ids:  # explicit guard for the mandatory-citation rule
                continue
            candidate_id: int = await conn.fetchval(
                """
                INSERT INTO entity_candidates
                    (run_id, region_id, dimension, name, kind, score, confidence, rationale)
                VALUES ($1, 'BR', 'official', $2, $3, $4, $5, $6)
                RETURNING id
                """,
                run_id,
                entry.org.name,
                entry.org.kind,
                entry.score,
                entry.confidence,
                entry.rationale(len(docs)),
            )
            for ord_, doc_id in enumerate(entry.doc_ids[:MAX_CITATIONS]):
                await conn.execute(
                    "INSERT INTO candidate_citations (candidate_id, document_id, ord, excerpt)"
                    " VALUES ($1, $2, $3, $4)",
                    candidate_id,
                    doc_id,
                    ord_,
                    titles.get(doc_id, "")[:500],
                )
        await conn.execute(
            "UPDATE scoring_runs SET finished_at = now() WHERE id = $1", run_id
        )
        return {
            "run_id": run_id,
            "documents": len(docs),
            "candidates": len(ranked),
            "top": [(e.org.name, e.score, len(e.doc_ids)) for e in ranked[:5]],
        }
    finally:
        await conn.close()
