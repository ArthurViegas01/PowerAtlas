"""Monitoring feed endpoint: latest headlines ingested from the allowlist.

Database-only by design: without a pool (offline mock mode) it returns an
empty list and the web hides the panel. Newest first, publication date over
fetch time so re-fetched backlogs do not jump the queue.
"""

from __future__ import annotations

from fastapi import APIRouter, Query, Request

from ....models.monitoring import MonitoringDocument, MonitoringResponse

router = APIRouter(prefix="/v1", tags=["monitoring"])

_QUERY = """
SELECT d.id, d.source_id, s.name AS source_name, d.title, d.url, d.published_at
FROM raw_documents d
JOIN ingest_sources s ON s.id = d.source_id
ORDER BY d.published_at DESC NULLS LAST, d.fetched_at DESC
LIMIT $1
"""


@router.get(
    "/monitoring/documents",
    response_model=MonitoringResponse,
    response_model_by_alias=True,
    summary="Latest documents ingested from the allowlisted institutional feeds.",
)
async def get_monitoring_documents(
    request: Request,
    limit: int = Query(default=20, ge=1, le=50),
) -> MonitoringResponse:
    pool = getattr(request.app.state, "db_pool", None)
    if pool is None:
        return MonitoringResponse(documents=[])
    rows = await pool.fetch(_QUERY, limit)
    return MonitoringResponse(
        documents=[MonitoringDocument(**dict(row)) for row in rows],
    )
