"""Celery task definitions (F5 pipeline).

Heavy pipeline work (feed fetching, embedding, LLM scoring) runs here so it
never blocks the read API. F5a ships only the smoke task; ingestion (F5b)
and scoring (F5c) add the real ones.
"""

from __future__ import annotations

from .celery_app import app


@app.task
def pipeline_smoke(echo: str = "ok") -> dict[str, str]:
    """Round-trip probe: proves broker, worker and result backend are wired."""
    return {"status": "ok", "echo": echo}
