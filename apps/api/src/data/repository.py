"""Database-backed assembly of the RegionPowerData payload (F4).

Raw asyncpg queries reconstruct the exact same envelope the F3 mock loader
builds, so the endpoint payload is identical whether it is served from JSON or
from PostGIS. Ordering (regions, entities, sources, links, signals) is
preserved so the output stays byte-compatible.
"""

from __future__ import annotations

from datetime import UTC, datetime

import asyncpg

from ..models.power_entity import (
    AmbientSignal,
    InfluenceLink,
    PowerEntity,
    PowerRegion,
    RegionCapital,
    RegionPowerData,
    SourceCitation,
)
from .loader import DISCLAIMER, _collation_key, _now_iso_z


def _fmt_updated_at(value: datetime) -> str:
    """Serialize timestamptz back to the contract's ISO-8601 ``...Z`` string."""
    return value.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


async def load_region_power_data_from_db(pool: asyncpg.Pool) -> RegionPowerData:
    async with pool.acquire() as conn:
        region_rows = await conn.fetch(
            "SELECT id, name, kind, capital_name, "
            "ST_X(capital_geom) AS lon, ST_Y(capital_geom) AS lat, updated_at "
            "FROM regions"
        )
        entity_rows = await conn.fetch(
            "SELECT id, region_id, dimension, name, kind, score, delta, "
            "confidence, status, note FROM entities ORDER BY region_id, dimension, ord"
        )
        source_rows = await conn.fetch(
            "SELECT es.entity_id, s.id, s.label, s.url, s.published_at, s.note "
            "FROM entity_sources es JOIN sources s ON s.id = es.source_id "
            "ORDER BY es.entity_id, es.ord"
        )
        link_rows = await conn.fetch(
            "SELECT id, from_region, to_region, strength, dimension, label "
            "FROM influence_links ORDER BY ord"
        )
        signal_rows = await conn.fetch(
            "SELECT ST_X(geom) AS lon, ST_Y(geom) AS lat, weight "
            "FROM ambient_signals ORDER BY ord"
        )

    sources_by_entity: dict[str, list[SourceCitation]] = {}
    for row in source_rows:
        sources_by_entity.setdefault(row["entity_id"], []).append(
            SourceCitation(
                id=row["id"],
                label=row["label"],
                url=row["url"],
                published_at=row["published_at"],
                note=row["note"],
            )
        )

    entities_by_region: dict[str, dict[str, list[PowerEntity]]] = {}
    for row in entity_rows:
        entity = PowerEntity(
            id=row["id"],
            name=row["name"],
            kind=row["kind"],
            dimension=row["dimension"],
            score=row["score"],
            delta=row["delta"],
            confidence=row["confidence"],
            status=row["status"],
            sources=sources_by_entity.get(row["id"], []),
            note=row["note"],
        )
        buckets = entities_by_region.setdefault(row["region_id"], {"official": [], "hidden": []})
        buckets[row["dimension"]].append(entity)

    regions: list[PowerRegion] = []
    for row in region_rows:
        buckets = entities_by_region.get(row["id"], {"official": [], "hidden": []})
        regions.append(
            PowerRegion(
                id=row["id"],
                name=row["name"],
                kind=row["kind"],
                capital=RegionCapital(
                    name=row["capital_name"],
                    coordinates=(row["lon"], row["lat"]),
                ),
                updated_at=_fmt_updated_at(row["updated_at"]),
                official=buckets["official"],
                hidden=buckets["hidden"],
            )
        )
    regions.sort(key=_collation_key)

    links = [
        InfluenceLink(
            id=row["id"],
            from_=row["from_region"],
            to=row["to_region"],
            strength=row["strength"],
            dimension=row["dimension"],
            label=row["label"],
        )
        for row in link_rows
    ]
    signals = [
        AmbientSignal(coordinates=(row["lon"], row["lat"]), weight=row["weight"])
        for row in signal_rows
    ]

    return RegionPowerData(
        schema_version=1,
        generated_at=_now_iso_z(),
        disclaimer=DISCLAIMER,
        regions=regions,
        links=links,
        ambient_signals=signals,
    )
