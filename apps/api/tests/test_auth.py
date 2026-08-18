"""Admin authentication: token signing, login endpoint and the write gate.

These are unit-level (no database): the write gate (``require_admin``) runs as a
dependency before the handler touches the pool, so a missing/invalid session is
refused with 401 even with no DB configured.
"""

from __future__ import annotations

import time

import pytest
from fastapi.testclient import TestClient

from src.core.auth import create_token, verify_token
from src.core.config import Settings, get_settings
from src.main import create_app

SAMPLE = {
    "name": "Teste",
    "source": "TESTE",
    "columns": [{"key": "a", "label": "A", "numeric": True, "format": "int"}],
    "rows": [{"a": 1}],
}


def test_token_roundtrip_and_tamper() -> None:
    settings = Settings(admin_password="segredo")
    token, expires_at = create_token(settings)
    assert expires_at > int(time.time())
    assert verify_token(settings, token) is True
    # Any change to the token invalidates the signature.
    assert verify_token(settings, token + "x") is False
    # A different signing key (rotated secret / different password) rejects it.
    assert verify_token(Settings(admin_password="outra"), token) is False


def test_expired_token_is_rejected() -> None:
    settings = Settings(admin_password="segredo", admin_session_ttl_s=-1)
    token, _ = create_token(settings)
    assert verify_token(settings, token) is False


def test_verify_false_when_admin_disabled() -> None:
    enabled = Settings(admin_password="segredo")
    token, _ = create_token(enabled)
    # No password configured -> nothing verifies, writes impossible.
    assert verify_token(Settings(), token) is False


def test_login_unavailable_without_admin(client: TestClient) -> None:
    resp = client.post("/api/v1/auth/login", json={"password": "x"})
    assert resp.status_code == 503


@pytest.fixture
def admin_app(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("PA_ADMIN_PASSWORD", "senha-de-teste")
    get_settings.cache_clear()
    try:
        yield TestClient(create_app())
    finally:
        get_settings.cache_clear()


def test_login_wrong_password(admin_app: TestClient) -> None:
    resp = admin_app.post("/api/v1/auth/login", json={"password": "errada"})
    assert resp.status_code == 401


def test_login_success_returns_token(admin_app: TestClient) -> None:
    resp = admin_app.post("/api/v1/auth/login", json={"password": "senha-de-teste"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["token"]
    assert body["expiresAt"] > int(time.time())


def test_stats_report_writes_allowed_when_admin_set(admin_app: TestClient) -> None:
    body = admin_app.get("/api/v1/stats").json()
    assert body["writesAllowed"] is True


def test_import_needs_token_when_admin_set(admin_app: TestClient) -> None:
    # Admin configured but no bearer token: refused with 401 before any DB work.
    resp = admin_app.post("/api/v1/datasets/import", json=SAMPLE)
    assert resp.status_code == 401


def test_import_rejects_bad_token(admin_app: TestClient) -> None:
    resp = admin_app.post(
        "/api/v1/datasets/import",
        json=SAMPLE,
        headers={"Authorization": "Bearer nao-e-um-token.valido"},
    )
    assert resp.status_code == 401
