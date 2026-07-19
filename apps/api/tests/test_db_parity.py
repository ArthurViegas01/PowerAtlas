"""Integration: the DB-backed payload must match the mock source JSON (F4).

Opt-in (`-m integration`); requires `docker compose up postgres` + migrate +
seed. Reuses the F3 parity approach: build the expected payload from the raw
mock JSON and assert the endpoint, now reading from PostGIS, returns the same
envelope, region order and content.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from src.core.config import get_settings
from src.main import create_app
from tests.test_power_data_contract import (
    ENVELOPE_KEYS,
    EXPECTED_DISCLAIMER,
    _raw_source,
    assert_region_ordering,
)

pytestmark = pytest.mark.integration

DB_DSN = "postgresql://poweratlas:poweratlas_local_dev@localhost:5432/poweratlas"


@pytest.fixture
def db_payload(monkeypatch: pytest.MonkeyPatch) -> dict:
    monkeypatch.setenv("PA_DATABASE_URL", DB_DSN)
    get_settings.cache_clear()
    try:
        with TestClient(create_app()) as client:
            resp = client.get("/api/v1/power-data")
            assert resp.status_code == 200
            return resp.json()
    finally:
        get_settings.cache_clear()


def test_db_envelope_and_order(db_payload: dict) -> None:
    assert set(db_payload) == ENVELOPE_KEYS
    assert db_payload["schemaVersion"] == 1
    assert db_payload["disclaimer"] == EXPECTED_DISCLAIMER
    assert db_payload["generatedAt"].endswith("Z")
    assert_region_ordering(db_payload["regions"])


def test_db_parity_with_source_json(db_payload: dict) -> None:
    regions_by_id, network = _raw_source()
    got_regions = {r["id"]: r for r in db_payload["regions"]}
    assert got_regions == regions_by_id
    assert db_payload["links"] == network["links"]
    assert db_payload["ambientSignals"] == network["ambientSignals"]
