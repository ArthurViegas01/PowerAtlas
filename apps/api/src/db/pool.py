"""asyncpg connection pool (F4).

The runtime access layer is raw asyncpg, mirroring the ZapAgent house pattern
(pool.acquire() + conn.fetch), not an ORM. The pool is created on app startup
when a database is configured and stored on ``app.state``.
"""

from __future__ import annotations

import asyncpg

from ..core.config import get_settings


async def create_pool() -> asyncpg.Pool:
    settings = get_settings()
    return await asyncpg.create_pool(dsn=settings.database_url, min_size=1, max_size=5)
