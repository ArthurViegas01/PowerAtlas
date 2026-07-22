"""Ingestion service (F5b): allowlisted feeds -> raw_documents.

Reads the enabled `ingest_sources` rows (the seeded allowlist — never a
hardcoded list), fetches each feed politely (honest User-Agent, timeout,
delay between sources) and inserts documents deduplicated by content_hash.
Shared by the Celery task and the `scripts.ingest` CLI.
"""

from __future__ import annotations

import asyncio
import logging

import asyncpg
import httpx

from src.core.config import get_settings
from src.ingest.feeds import content_hash, fetch_feed, parse_feed

logger = logging.getLogger(__name__)

# Local docker-compose default, overridden by PA_DATABASE_URL when set (same
# convention as scripts/migrate.py and scripts/seed.py).
LOCAL_DEV_DSN = "postgresql://poweratlas:poweratlas_local_dev@localhost:5432/poweratlas"


def resolve_dsn() -> str:
    return get_settings().database_url or LOCAL_DEV_DSN


async def ingest_source(
    conn: asyncpg.Connection, client: httpx.AsyncClient, source: asyncpg.Record
) -> dict[str, int]:
    raw = await fetch_feed(client, source["url"])
    items = parse_feed(raw)
    inserted = 0
    for item in items:
        result = await conn.execute(
            "INSERT INTO raw_documents"
            "(source_id, url, title, published_at, content, content_hash) "
            "VALUES($1, $2, $3, $4, $5, $6) "
            "ON CONFLICT (content_hash) DO NOTHING",
            source["id"],
            item.url,
            item.title,
            item.published_at,
            item.content,
            content_hash(item),
        )
        # asyncpg command tags: "INSERT 0 1" on insert, "INSERT 0 0" on dedup.
        if result.endswith(" 1"):
            inserted += 1
    await conn.execute(
        "UPDATE ingest_sources SET fetched_at = now() WHERE id = $1", source["id"]
    )
    return {"fetched": len(items), "inserted": inserted}


async def ingest_all(dsn: str | None = None) -> dict[str, dict[str, int]]:
    """Ingest every enabled source; one broken feed never aborts the run."""
    settings = get_settings()
    conn = await asyncpg.connect(dsn=dsn or resolve_dsn())
    stats: dict[str, dict[str, int]] = {}
    try:
        sources = await conn.fetch(
            "SELECT id, url FROM ingest_sources WHERE enabled ORDER BY id"
        )
        async with httpx.AsyncClient(
            headers={"User-Agent": settings.ingest_user_agent},
            timeout=settings.ingest_timeout_s,
            follow_redirects=True,
        ) as client:
            for i, source in enumerate(sources):
                if i:
                    await asyncio.sleep(settings.ingest_delay_s)
                try:
                    stats[source["id"]] = await ingest_source(conn, client, source)
                except httpx.HTTPError:
                    logger.warning("ingest failed for %s", source["id"], exc_info=True)
                    stats[source["id"]] = {"fetched": 0, "inserted": 0, "errors": 1}
    finally:
        await conn.close()
    return stats
