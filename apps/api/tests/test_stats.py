"""Stats endpoint tests: mock mode (unit) and DB-backed (integration)."""

from __future__ import annotations

import asyncpg
import pytest
from fastapi.testclient import TestClient

from src.core.config import get_settings
from src.main import create_app

DB_DSN = "postgresql://poweratlas:poweratlas_local_dev@localhost:5432/poweratlas"


def test_stats_empty_without_database(client: TestClient) -> None:
    resp = client.get("/api/v1/stats")
    assert resp.status_code == 200
    body = resp.json()
    assert body["database"] is False
    assert body["content"] == {
        "regions": 0,
        "entities": 0,
        "ambientSignals": 0,
        "influenceLinks": 0,
    }
    assert body["pipeline"]["documents"] == 0
    assert body["pipeline"]["sources"] == []
    assert body["pipeline"]["documentsByDay"] == []


@pytest.mark.integration
async def test_stats_counts_real_rows(monkeypatch: pytest.MonkeyPatch) -> None:
    conn = await asyncpg.connect(dsn=DB_DSN)
    try:
        await conn.execute("DELETE FROM ingest_sources WHERE id = 'test-stats'")
        await conn.execute(
            "INSERT INTO ingest_sources(id, name, kind, url) "
            "VALUES('test-stats', 'Fonte Stats', 'rss', 'https://example.org/s.rss')"
        )
        await conn.execute(
            "INSERT INTO raw_documents(source_id, url, title, published_at, content, content_hash) "
            "VALUES('test-stats', 'https://example.org/s1', 'Doc Stats', now(), "
            "'corpo', 'hash-test-stats')"
        )

        monkeypatch.setenv("PA_DATABASE_URL", DB_DSN)
        get_settings.cache_clear()
        try:
            with TestClient(create_app()) as client:
                resp = client.get("/api/v1/stats")
                assert resp.status_code == 200
                body = resp.json()
                assert body["database"] is True
                # The fictional seed fills the served tables.
                assert body["content"]["regions"] >= 1
                assert body["pipeline"]["documents"] >= 1
                ours = [s for s in body["pipeline"]["sources"] if s["id"] == "test-stats"]
                assert ours and ours[0]["documents"] >= 1
                assert body["pipeline"]["documentsByDay"]
        finally:
            get_settings.cache_clear()
    finally:
        await conn.execute("DELETE FROM ingest_sources WHERE id = 'test-stats'")
        await conn.close()
