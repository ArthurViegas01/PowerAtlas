"""Read-only power-data endpoint (F3 mock, F4 database).

Serves the aggregated RegionPowerData payload the web app consumes. Reads from
PostGIS when a pool is present on ``app.state`` (F4), otherwise from the bundled
mock JSON (F3). The payload is identical either way.
"""

from __future__ import annotations

from fastapi import APIRouter, Request

from ....data.loader import load_region_power_data
from ....data.repository import load_region_power_data_from_db
from ....models.power_entity import RegionPowerData

router = APIRouter(prefix="/v1", tags=["power-data"])


@router.get(
    "/power-data",
    response_model=RegionPowerData,
    response_model_by_alias=True,
    response_model_exclude_none=True,
    summary="Aggregated power-ranking dataset for every mapped region.",
)
async def get_power_data(request: Request) -> RegionPowerData:
    """Return the full RegionPowerData envelope (regions, links, ambient signals)."""
    pool = getattr(request.app.state, "db_pool", None)
    if pool is not None:
        return await load_region_power_data_from_db(pool)
    return load_region_power_data()
