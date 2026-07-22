"""Monitoring endpoint tests: mock mode (unit) and DB-backed (integration)."""

from __future__ import annotations

import asyncpg
import pytest
from fastapi.testclient import TestClient

from src.core.config import get_settings
from src.main import create_app

DB_DSN = "postgresql://poweratlas:poweratlas_local_dev@localhost:5432/poweratlas"


def test_monitoring_empty_without_database(client: TestClient) -> None:
    resp = client.get("/api/v1/monitoring/documents")
    assert resp.status_code == 200
    assert resp.json() == {"documents": []}


def test_monitoring_limit_is_validated(client: TestClient) -> None:
    assert client.get("/api/v1/monitoring/documents?limit=0").status_code == 422
    assert client.get("/api/v1/monitoring/documents?limit=51").status_code == 422


@pytest.mark.integration
async def test_monitoring_returns_ingested_documents(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    conn = await asyncpg.connect(dsn=DB_DSN)
    try:
        await conn.execute("DELETE FROM ingest_sources WHERE id = 'test-monitor'")
        await conn.execute(
            "INSERT INTO ingest_sources(id, name, kind, url) "
            "VALUES('test-monitor', 'Fonte de Teste', 'rss', 'https://example.org/m.rss')"
        )
        await conn.execute(
            "INSERT INTO raw_documents(source_id, url, title, published_at, content, content_hash) "
            "VALUES('test-monitor', 'https://example.org/doc', 'Manchete de teste', now(), "
            "'corpo', 'hash-test-monitor')"
        )

        monkeypatch.setenv("PA_DATABASE_URL", DB_DSN)
        get_settings.cache_clear()
        try:
            with TestClient(create_app()) as client:
                resp = client.get("/api/v1/monitoring/documents?limit=50")
                assert resp.status_code == 200
                docs = resp.json()["documents"]
                ours = [d for d in docs if d["sourceId"] == "test-monitor"]
                assert ours and ours[0]["title"] == "Manchete de teste"
                assert ours[0]["sourceName"] == "Fonte de Teste"
                assert ours[0]["url"] == "https://example.org/doc"
        finally:
            get_settings.cache_clear()
    finally:
        await conn.execute("DELETE FROM ingest_sources WHERE id = 'test-monitor'")
        await conn.close()
