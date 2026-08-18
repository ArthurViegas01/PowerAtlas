"""Centralized typed settings loaded from environment variables.

Mirrors the Encaixe house convention: every value the service consumes goes
through this module (no scattered os.getenv). Prefix is ``PA_`` so the vars do
not collide with the web app or the shell.
"""

from __future__ import annotations

import hashlib
from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, read from environment variables (prefix ``PA_``).

    In tests a fixture overrides the singleton via ``get_settings`` so no real
    environment is required.
    """

    model_config = SettingsConfigDict(
        env_prefix="PA_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # -- Runtime -----------------------------------------------------------
    environment: Literal["development", "production", "test"] = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # -- Database ----------------------------------------------------------
    # asyncpg DSN (postgresql://...). Empty means "no database": the API falls
    # back to reading the bundled mock JSON, so offline dev and unit tests need
    # no Postgres. Set it (or run via docker-compose) to read from PostGIS.
    database_url: str = ""

    @property
    def use_database(self) -> bool:
        return bool(self.database_url)

    # -- Writes / admin auth ----------------------------------------------
    # The API is read-only for the power contract. Mutations exist only for the
    # data console's dataset import/delete, which touch ONLY the isolated
    # `datasets` namespace (migration 0003), never the served tables.
    #
    # Single-admin authentication is the write gate: set ``PA_ADMIN_PASSWORD``
    # to enable writes; the console logs in (``POST /api/v1/auth/login``) and
    # every import/delete then requires a valid bearer session token. With no
    # password set, admin_enabled is False and every write is refused, so a
    # public deploy (no password) is read-only for everyone.
    admin_password: str = ""
    # Signing key for the HMAC session tokens. Empty -> derived from the
    # password, so setting only PA_ADMIN_PASSWORD is a complete setup; set a
    # dedicated secret to invalidate outstanding sessions independently.
    auth_secret: str = ""
    # Session lifetime in seconds (default 12h).
    admin_session_ttl_s: int = 43_200

    @property
    def admin_enabled(self) -> bool:
        """True when an admin password is configured, i.e. writes are possible."""
        return bool(self.admin_password)

    @property
    def signing_key(self) -> bytes:
        """32-byte HMAC key for session tokens (from auth_secret or password)."""
        base = self.auth_secret or self.admin_password
        return hashlib.sha256(f"poweratlas-admin::{base}".encode()).digest()

    # -- Worker / pipeline (F5) --------------------------------------------
    # Redis backs the Celery broker and result backend (dbs 1 and 2, with 0
    # reserved for direct use, mirroring Encaixe). Defaults target the
    # dockerized redis from the host (`docker compose up -d redis`); inside
    # the compose network the worker service overrides the hostname.
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # -- Ingest (F5b) ------------------------------------------------------
    # Honest UA for the allowlisted institutional feeds + polite pacing.
    ingest_user_agent: str = "PowerAtlas/0.1 (prototipo de pesquisa; ingest piloto)"
    ingest_timeout_s: float = 30.0
    ingest_delay_s: float = 1.0

    # -- Security ----------------------------------------------------------
    # Comma-separated allowlist of browser origins for CORS. Defaults cover the
    # Vite dev server (5173) and the production-build preview (4173), on both
    # the localhost and 127.0.0.1 hostnames (browsers treat them as distinct
    # origins).
    cors_allowed_origins: str = (
        "http://localhost:5173,http://localhost:4173,"
        "http://127.0.0.1:5173,http://127.0.0.1:4173"
    )

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the singleton settings instance, cached for the process lifetime."""
    return Settings()
