"""Dataset import endpoints: write gate (unit) and DB round-trip (integration).

Also asserts the safety property: importing a dataset never changes the served
power-data payload.
"""

from __future__ import annotations

import json
from typing import Any

import asyncpg
import pytest
from fastapi.testclient import TestClient

from src.core.config import get_settings
from src.main import create_app

DB_DSN = "postgresql://poweratlas:poweratlas_local_dev@localhost:5432/poweratlas"


def _payload_without_timestamp(text: str) -> dict[str, Any]:
    """Drop the per-request generatedAt so two snapshots compare on content."""
    data: dict[str, Any] = json.loads(text)
    data.pop("generatedAt", None)
    return data

SAMPLE = {
    "name": "Teste Import",
    "source": "TESTE",
    "columns": [
        {"key": "cidade", "label": "CIDADE", "numeric": False, "format": "text"},
        {"key": "valor", "label": "VALOR", "numeric": True, "format": "int"},
    ],
    "rows": [
        {"cidade": "Alfa", "valor": 10},
        {"cidade": "Beta", "valor": 20},
    ],
}


def test_list_empty_without_database(client: TestClient) -> None:
    resp = client.get("/api/v1/datasets")
    assert resp.status_code == 200
    assert resp.json() == {"datasets": []}


def test_import_forbidden_without_admin(client: TestClient) -> None:
    # Default settings: no admin configured -> writes disabled, 403 before any
    # DB work.
    resp = client.post("/api/v1/datasets/import", json=SAMPLE)
    assert resp.status_code == 403


@pytest.mark.integration
async def test_import_roundtrip_and_parity(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PA_DATABASE_URL", DB_DSN)
    monkeypatch.setenv("PA_ADMIN_PASSWORD", "senha-de-teste")
    get_settings.cache_clear()
    dataset_id: str | None = None
    try:
        with TestClient(create_app()) as client:
            before = _payload_without_timestamp(client.get("/api/v1/power-data").text)

            token = client.post(
                "/api/v1/auth/login", json={"password": "senha-de-teste"}
            ).json()["token"]
            auth = {"Authorization": f"Bearer {token}"}

            created = client.post("/api/v1/datasets/import", json=SAMPLE, headers=auth)
            assert created.status_code == 201
            meta = created.json()
            dataset_id = meta["id"]
            assert meta["rowCount"] == 2

            listed = client.get("/api/v1/datasets").json()["datasets"]
            assert any(d["id"] == dataset_id for d in listed)

            detail = client.get(f"/api/v1/datasets/{dataset_id}").json()
            assert detail["rows"] == SAMPLE["rows"]

            # The served power payload is identical after the import (only the
            # per-request generatedAt timestamp is allowed to differ).
            after = _payload_without_timestamp(client.get("/api/v1/power-data").text)
            assert before == after

            deleted = client.delete(f"/api/v1/datasets/{dataset_id}", headers=auth)
            assert deleted.status_code == 204
            dataset_id = None
    finally:
        if dataset_id is not None:
            conn = await asyncpg.connect(dsn=DB_DSN)
            try:
                await conn.execute("DELETE FROM datasets WHERE id = $1::uuid", dataset_id)
            finally:
                await conn.close()
        get_settings.cache_clear()
