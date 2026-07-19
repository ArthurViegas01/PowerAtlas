"""Centralized typed settings loaded from environment variables.

Mirrors the ZapAgent house convention: every value the service consumes goes
through this module (no scattered os.getenv). Prefix is ``PA_`` so the vars do
not collide with the web app or the shell.
"""

from __future__ import annotations

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
