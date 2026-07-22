"""FastAPI application factory (F3 read API, F4 database).

Mirrors the Encaixe house shape: a ``create_app`` factory plus a module-level
``app`` for uvicorn. When a database is configured the app opens an asyncpg pool
on startup and the endpoint reads from PostGIS; otherwise it falls back to the
bundled mock JSON, so offline dev and unit tests need no Postgres.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import Settings, get_settings

API_VERSION = "0.1.0"


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    app.state.db_pool = None
    if settings.use_database:
        from .db.pool import create_pool

        app.state.db_pool = await create_pool()
    try:
        yield
    finally:
        if app.state.db_pool is not None:
            await app.state.db_pool.close()


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    app = FastAPI(
        title="PowerAtlas API",
        version=API_VERSION,
        description="Read-only power-ranking dataset for the PowerAtlas HUD.",
        lifespan=lifespan,
    )

    # Explicit origin allowlist (web dev + preview). No wildcard.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET"],
        allow_headers=["*"],
    )

    @app.get("/", tags=["meta"])
    async def root() -> dict[str, str]:
        """Landing for whoever opens the API port in a browser: where things live."""
        return {
            "service": "poweratlas-api",
            "health": "/health",
            "data": "/api/v1/power-data",
            "docs": "/docs",
            "hud": "http://localhost:5173",
        }

    @app.get("/health", tags=["meta"])
    async def health() -> dict[str, object]:
        """Liveness probe: process is up, reports whether a database is wired."""
        return {"status": "ok", "version": app.version, "database": settings.use_database}

    from .api.v1.routers.monitoring import router as monitoring_router
    from .api.v1.routers.power_data import router as power_data_router

    app.include_router(power_data_router, prefix="/api")
    app.include_router(monitoring_router, prefix="/api")

    return app


app = create_app()
