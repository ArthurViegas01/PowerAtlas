"""Integration (F5b): ingest into raw_documents, dedup across re-runs.

Opt-in (`-m integration`); requires the dockerized postgres with migrations
applied. The feed itself is mocked with respx — no network involved. Uses a
throwaway source row so the seeded allowlist is untouched; deleting it
cascades the inserted documents away.
"""

from __future__ import annotations

import asyncpg
import httpx
import pytest
import respx

from src.ingest.service import ingest_source
from tests.test_ingest import SAMPLE_RSS

pytestmark = pytest.mark.integration

DB_DSN = "postgresql://poweratlas:poweratlas_local_dev@localhost:5432/poweratlas"
FEED_URL = "https://example.org/test-feed.rss"


@respx.mock
async def test_ingest_dedups_across_runs() -> None:
    respx.get(FEED_URL).respond(content=SAMPLE_RSS)
    conn = await asyncpg.connect(dsn=DB_DSN)
    try:
        await conn.execute("DELETE FROM ingest_sources WHERE id = 'test-feed'")
        await conn.execute(
            "INSERT INTO ingest_sources(id, name, kind, url) "
            "VALUES('test-feed', 'Feed de Teste', 'rss', $1)",
            FEED_URL,
        )
        source = await conn.fetchrow(
            "SELECT id, url FROM ingest_sources WHERE id = 'test-feed'"
        )
        assert source is not None

        async with httpx.AsyncClient() as client:
            first = await ingest_source(conn, client, source)
            second = await ingest_source(conn, client, source)

        assert first == {"fetched": 2, "inserted": 2}
        assert second == {"fetched": 2, "inserted": 0}

        fetched_at = await conn.fetchval(
            "SELECT fetched_at FROM ingest_sources WHERE id = 'test-feed'"
        )
        assert fetched_at is not None

        titles = await conn.fetch(
            "SELECT title FROM raw_documents WHERE source_id = 'test-feed' ORDER BY id"
        )
        assert [r["title"] for r in titles] == [
            "Nova politica & economia",
            "Segunda noticia",
        ]
    finally:
        await conn.execute("DELETE FROM ingest_sources WHERE id = 'test-feed'")
        await conn.close()
