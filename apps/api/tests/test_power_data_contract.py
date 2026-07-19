"""Contract test: the endpoint payload must match the source mock JSON.

Parity is checked against the raw JSON files directly (not via the loader), so
the test independently verifies the envelope, the region ordering property and
that no field is dropped or mutated on the way out. Ordering is asserted as a
property (country first, then pt-BR accent-folded name order) rather than a
hard-coded list, so adding states does not break it.
"""

from __future__ import annotations

import json
import unicodedata
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

MOCK_DIR = Path(__file__).resolve().parents[1] / "src" / "data" / "mock"
NETWORK_FILE = "influence-network.json"

EXPECTED_DISCLAIMER = 'PROTÓTIPO · DADOS SIMULADOS · ENTIDADES DE "PODER OCULTO" SÃO FICTÍCIAS'
ENVELOPE_KEYS = {
    "schemaVersion",
    "generatedAt",
    "disclaimer",
    "regions",
    "links",
    "ambientSignals",
}


def _fold(name: str) -> str:
    return "".join(
        ch for ch in unicodedata.normalize("NFKD", name) if not unicodedata.combining(ch)
    ).casefold()


def assert_region_ordering(regions: list[dict]) -> None:
    """Country first, then states in accent-folded name order."""
    assert regions, "no regions in payload"
    assert regions[0]["kind"] == "country"
    assert all(r["kind"] == "state" for r in regions[1:])
    state_names = [_fold(r["name"]) for r in regions[1:]]
    assert state_names == sorted(state_names)


def _raw_source() -> tuple[dict[str, dict], dict]:
    regions_by_id: dict[str, dict] = {}
    network: dict = {}
    for path in MOCK_DIR.glob("*.json"):
        data = json.loads(path.read_text(encoding="utf-8"))
        if path.name == NETWORK_FILE:
            network = data
        else:
            regions_by_id[data["id"]] = data
    return regions_by_id, network


@pytest.fixture
def payload(client: TestClient) -> dict:
    resp = client.get("/api/v1/power-data")
    assert resp.status_code == 200
    return resp.json()


def test_envelope_shape(payload: dict) -> None:
    assert set(payload) == ENVELOPE_KEYS
    assert payload["schemaVersion"] == 1
    assert payload["disclaimer"] == EXPECTED_DISCLAIMER
    assert payload["generatedAt"].endswith("Z")


def test_region_ordering(payload: dict) -> None:
    assert_region_ordering(payload["regions"])
    regions_by_id, _ = _raw_source()
    assert {r["id"] for r in payload["regions"]} == set(regions_by_id)


def test_parity_with_source_json(payload: dict) -> None:
    regions_by_id, network = _raw_source()

    got_regions = {r["id"]: r for r in payload["regions"]}
    assert got_regions == regions_by_id
    assert payload["links"] == network["links"]
    assert payload["ambientSignals"] == network["ambientSignals"]
