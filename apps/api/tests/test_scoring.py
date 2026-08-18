"""Heuristic scoring v0: matching, normalization, bands and the citation rule.

The core (`score_documents`) is pure, so everything here runs without a
database; the DB write path is covered by the `-m integration` test at the
bottom (requires a running Postgres with the pipeline migrations).
"""

from __future__ import annotations

import pytest

from src.scoring.orgs import ORGS
from src.scoring.score_v0 import SimpleDoc, score_documents


def doc(id_: int, title: str, content: str = "") -> SimpleDoc:
    return SimpleDoc(id=id_, title=title, content=content)


def test_matches_are_accent_and_case_insensitive() -> None:
    docs = [doc(1, "CAMARA DOS DEPUTADOS aprova projeto"), doc(2, "nada aqui")]
    ranked = score_documents(docs)
    assert [e.org.name for e in ranked] == ["Câmara dos Deputados"]
    assert ranked[0].doc_ids == [1]


def test_word_boundaries_block_partial_hits() -> None:
    # "PGR" must not fire inside an unrelated token.
    ranked = score_documents([doc(1, "empresa PGRX anuncia resultado")])
    assert ranked == []
    ranked = score_documents([doc(2, "PGR pede investigacao")])
    assert [e.org.name for e in ranked] == ["Ministério Público Federal"]


def test_scores_normalize_to_the_leader_and_keep_a_floor() -> None:
    docs = [doc(i, "Petrobras investe") for i in range(1, 11)]
    docs.append(doc(99, "IBGE divulga censo"))
    ranked = score_documents(docs)
    assert ranked[0].org.name == "Petrobras"
    assert ranked[0].score == 100
    ibge = next(e for e in ranked if e.org.name == "IBGE")
    assert 1 <= ibge.score < 100  # one mention still scores above zero


def test_confidence_bands() -> None:
    many = [doc(i, "Senado Federal vota") for i in range(10)]
    some = [doc(100 + i, "Anvisa aprova") for i in range(3)]
    one = [doc(200, "Ibama autua")]
    ranked = {e.org.name: e for e in score_documents([*many, *some, *one])}
    assert ranked["Senado Federal"].confidence == "high"
    assert ranked["Anvisa"].confidence == "medium"
    assert ranked["Ibama"].confidence == "low"


def test_orgs_without_mentions_never_become_candidates() -> None:
    ranked = score_documents([doc(1, "assunto totalmente alheio")])
    assert ranked == []  # the mandatory-citation rule, by construction


def test_alias_credits_the_canonical_org() -> None:
    ranked = score_documents([doc(1, "Itamaraty convoca embaixador")])
    assert [e.org.name for e in ranked] == ["Ministério das Relações Exteriores"]


def test_dictionary_is_well_formed() -> None:
    names = [org.name for org in ORGS]
    assert len(names) == len(set(names))
    assert all(org.kind in {"office", "institution", "organization"} for org in ORGS)


@pytest.mark.integration
def test_run_scoring_writes_draft_candidates_with_citations() -> None:
    """End to end against Postgres: run -> candidates (draft) -> citations."""
    import asyncio

    import asyncpg

    from src.ingest.service import resolve_dsn
    from src.scoring.score_v0 import run_scoring

    async def scenario() -> None:
        conn = await asyncpg.connect(dsn=resolve_dsn())
        try:
            await conn.execute(
                """
                INSERT INTO ingest_sources (id, name, url, enabled)
                VALUES ('teste-scoring', 'Teste', 'https://example.org/rss', false)
                ON CONFLICT (id) DO NOTHING
                """
            )
            doc_id = await conn.fetchval(
                """
                INSERT INTO raw_documents (source_id, url, title, content, content_hash)
                VALUES ('teste-scoring', 'https://example.org/1',
                        'Petrobras anuncia investimento', 'texto', 'hash-teste-scoring-1')
                ON CONFLICT (content_hash) DO UPDATE SET title = EXCLUDED.title
                RETURNING id
                """
            )
            stats = await run_scoring()
            run_id = stats["run_id"]
            rows = await conn.fetch(
                "SELECT name, status, score FROM entity_candidates WHERE run_id = $1", run_id
            )
            assert any(r["name"] == "Petrobras" for r in rows)
            assert all(r["status"] == "draft" for r in rows)
            cites = await conn.fetchval(
                """
                SELECT count(*) FROM candidate_citations c
                JOIN entity_candidates e ON e.id = c.candidate_id
                WHERE e.run_id = $1 AND c.document_id = $2
                """,
                run_id,
                doc_id,
            )
            assert cites >= 1
        finally:
            await conn.close()

    asyncio.run(scenario())
