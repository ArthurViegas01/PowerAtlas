"""Read-only power-data endpoint (F3).

Serves the aggregated RegionPowerData payload that the web app consumes. This
mirrors the single call the web ``mockDataLoader`` exposes today, so the
frontend swap (``mockDataLoader`` -> ``apiClient``) touches one file and no UI.
"""

from __future__ import annotations

from fastapi import APIRouter

from ....data.loader import load_region_power_data
from ....models.power_entity import RegionPowerData

router = APIRouter(prefix="/v1", tags=["power-data"])


@router.get(
    "/power-data",
    response_model=RegionPowerData,
    response_model_by_alias=True,
    response_model_exclude_none=True,
    summary="Aggregated power-ranking dataset for every mapped region.",
)
async def get_power_data() -> RegionPowerData:
    """Return the full RegionPowerData envelope (regions, links, ambient signals)."""
    return load_region_power_data()
