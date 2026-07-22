"""Celery task definitions (F5 pipeline).

Heavy pipeline work (feed fetching, embedding, LLM scoring) runs here so it
never blocks the read API. F5a ships only the smoke task; ingestion (F5b)
and scoring (F5c) add the real ones.
"""

from __future__ import annotations

import asyncio

from src.ingest.service import ingest_all

from .celery_app import app


@app.task
def pipeline_smoke(echo: str = "ok") -> dict[str, str]:
    """Round-trip probe: proves broker, worker and result backend are wired."""
    return {"status": "ok", "echo": echo}


@app.task
def pipeline_ingest() -> dict[str, dict[str, int]]:
    """Fetch every enabled allowlisted feed into raw_documents (F5b)."""
    return asyncio.run(ingest_all())
