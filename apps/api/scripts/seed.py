"""Seed the database from the API's own mock JSON copy (F4).

Truncates and reloads every table so it is repeatable. Array order becomes the
`ord` columns, so the DB payload matches the mock loader's ordering. Point
geometries are built with ST_MakePoint(lon, lat) in EPSG:4326.
Run: `python -m scripts.seed` (or `pnpm db-seed`).
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime
from pathlib import Path

import asyncpg

from src.core.config import get_settings

MOCK_DIR = Path(__file__).resolve().parents[1] / "src" / "data" / "mock"
NETWORK_FILE = "influence-network.json"

# Local docker-compose default, overridden by PA_DATABASE_URL when set.
DEFAULT_DSN = "postgresql://poweratlas:poweratlas_local_dev@localhost:5432/poweratlas"


async def main() -> None:
    settings = get_settings()
    dsn = settings.database_url or DEFAULT_DSN

    regions: list[dict] = []
    network: dict = {}
    for path in sorted(MOCK_DIR.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        if path.name == NETWORK_FILE:
            network = data
        else:
            regions.append(data)

    conn = await asyncpg.connect(dsn=dsn)
    try:
        async with conn.transaction():
            await conn.execute(
                "TRUNCATE regions, entities, sources, entity_sources, "
                "influence_links, ambient_signals RESTART IDENTITY CASCADE"
            )
            seen_sources: set[str] = set()
            for region in regions:
                cap = region["capital"]
                await conn.execute(
                    "INSERT INTO regions(id, name, kind, capital_name, capital_geom, updated_at) "
                    "VALUES($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326), $7)",
                    region["id"], region["name"], region["kind"], cap["name"],
                    cap["coordinates"][0], cap["coordinates"][1],
                    datetime.fromisoformat(region["updatedAt"]),
                )
                for dimension in ("official", "hidden"):
                    for ord_, entity in enumerate(region[dimension]):
                        await conn.execute(
                            "INSERT INTO entities(id, region_id, dimension, ord, name, kind, "
                            "score, delta, confidence, status, note) "
                            "VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
                            entity["id"], region["id"], dimension, ord_, entity["name"],
                            entity["kind"], entity["score"], entity["delta"],
                            entity["confidence"], entity["status"], entity.get("note"),
                        )
                        for s_ord, source in enumerate(entity["sources"]):
                            sid = source["id"]
                            if sid not in seen_sources:
                                seen_sources.add(sid)
                                await conn.execute(
                                    "INSERT INTO sources(id, label, url, published_at, note) "
                                    "VALUES($1, $2, $3, $4, $5)",
                                    sid, source["label"], source.get("url"),
                                    source.get("publishedAt"), source.get("note"),
                                )
                            await conn.execute(
                                "INSERT INTO entity_sources(entity_id, source_id, ord) "
                                "VALUES($1, $2, $3)",
                                entity["id"], sid, s_ord,
                            )
            for ord_, link in enumerate(network["links"]):
                await conn.execute(
                    "INSERT INTO influence_links(id, ord, from_region, to_region, "
                    "strength, dimension, label) VALUES($1, $2, $3, $4, $5, $6, $7)",
                    link["id"], ord_, link["from"], link["to"],
                    link["strength"], link["dimension"], link.get("label"),
                )
            for ord_, signal in enumerate(network["ambientSignals"]):
                await conn.execute(
                    "INSERT INTO ambient_signals(ord, geom, weight) "
                    "VALUES($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4)",
                    ord_, signal["coordinates"][0], signal["coordinates"][1], signal["weight"],
                )
        counts = await conn.fetchrow(
            "SELECT (SELECT count(*) FROM regions) AS regions, "
            "(SELECT count(*) FROM entities) AS entities, "
            "(SELECT count(*) FROM sources) AS sources, "
            "(SELECT count(*) FROM influence_links) AS links, "
            "(SELECT count(*) FROM ambient_signals) AS signals"
        )
        print(f"seeded: {dict(counts)}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
