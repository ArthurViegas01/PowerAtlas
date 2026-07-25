"""Stats endpoint: counts + aggregates for the data console's overview.

Database-only by design (like the monitoring feed): without a pool the app
returns an all-zero envelope with ``database: false`` and the console shows the
"no database" state. Read-only; never writes.
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Request

from ....core.config import get_settings
from ....models.stats import (
    ContentStats,
    DayCount,
    PipelineStats,
    SourceStat,
    StatsResponse,
)

router = APIRouter(prefix="/v1", tags=["stats"])

_CONTENT = """
SELECT
  (SELECT count(*) FROM regions)          AS regions,
  (SELECT count(*) FROM entities)         AS entities,
  (SELECT count(*) FROM ambient_signals)  AS ambient_signals,
  (SELECT count(*) FROM influence_links)  AS influence_links
"""

_PIPELINE = """
SELECT
  (SELECT count(*) FROM raw_documents)     AS documents,
  (SELECT count(*) FROM entity_candidates) AS candidates,
  (SELECT count(*) FROM scoring_runs)      AS scoring_runs
"""

_SOURCES = """
SELECT s.id, s.name, count(d.id) AS documents, max(d.published_at) AS last_published
FROM ingest_sources s
LEFT JOIN raw_documents d ON d.source_id = s.id
GROUP BY s.id, s.name
ORDER BY documents DESC, s.name
"""

_BY_DAY = """
SELECT date_trunc('day', coalesce(published_at, fetched_at))::date AS day, count(*) AS count
FROM raw_documents
GROUP BY day
ORDER BY day
"""


def _empty() -> StatsResponse:
    return StatsResponse(
        generated_at=datetime.now(UTC),
        database=False,
        writes_allowed=get_settings().allow_writes,
        content=ContentStats(regions=0, entities=0, ambient_signals=0, influence_links=0),
        pipeline=PipelineStats(
            documents=0, candidates=0, scoring_runs=0, sources=[], documents_by_day=[]
        ),
    )


@router.get(
    "/stats",
    response_model=StatsResponse,
    response_model_by_alias=True,
    summary="Row counts and pipeline aggregates for the data console.",
)
async def get_stats(request: Request) -> StatsResponse:
    pool = getattr(request.app.state, "db_pool", None)
    if pool is None:
        return _empty()

    async with pool.acquire() as conn:
        content_row = await conn.fetchrow(_CONTENT)
        pipeline_row = await conn.fetchrow(_PIPELINE)
        source_rows = await conn.fetch(_SOURCES)
        day_rows = await conn.fetch(_BY_DAY)

    return StatsResponse(
        generated_at=datetime.now(UTC),
        database=True,
        writes_allowed=get_settings().allow_writes,
        content=ContentStats(
            regions=content_row["regions"],
            entities=content_row["entities"],
            ambient_signals=content_row["ambient_signals"],
            influence_links=content_row["influence_links"],
        ),
        pipeline=PipelineStats(
            documents=pipeline_row["documents"],
            candidates=pipeline_row["candidates"],
            scoring_runs=pipeline_row["scoring_runs"],
            sources=[
                SourceStat(
                    id=row["id"],
                    name=row["name"],
                    documents=row["documents"],
                    last_published=row["last_published"],
                )
                for row in source_rows
            ],
            documents_by_day=[
                DayCount(day=row["day"], count=row["count"]) for row in day_rows
            ],
        ),
    )
