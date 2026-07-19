"""FastAPI application factory (F3).

Mirrors the ZapAgent house shape: a ``create_app`` factory plus a module-level
``app`` for uvicorn. Scope is deliberately narrow (read-only, no database, no
auth); those arrive in later phases.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import Settings, get_settings

API_VERSION = "0.1.0"


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    app = FastAPI(
        title="PowerAtlas API",
        version=API_VERSION,
        description="Read-only power-ranking dataset for the PowerAtlas HUD (F3).",
    )

    # Explicit origin allowlist (web dev + preview). No wildcard.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET"],
        allow_headers=["*"],
    )

    @app.get("/health", tags=["meta"])
    async def health() -> dict[str, str]:
        """Liveness probe: process is up."""
        return {"status": "ok", "version": app.version}

    from .api.v1.routers.power_data import router as power_data_router

    app.include_router(power_data_router, prefix="/api")

    return app


app = create_app()
