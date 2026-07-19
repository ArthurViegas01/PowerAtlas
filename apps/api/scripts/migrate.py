"""Apply SQL migrations in db/migrations, tracked in schema_migrations.

Plain-SQL migrations (no ORM), applied in filename order, each in a
transaction and recorded so re-runs are no-ops. Reads PA_DATABASE_URL via
settings. Run: `python -m scripts.migrate` (or `pnpm db-migrate`).
"""

from __future__ import annotations

import asyncio
from pathlib import Path

import asyncpg

from src.core.config import get_settings

MIGRATIONS_DIR = Path(__file__).resolve().parents[3] / "db" / "migrations"

# Local docker-compose default, overridden by PA_DATABASE_URL when set.
DEFAULT_DSN = "postgresql://poweratlas:poweratlas_local_dev@localhost:5432/poweratlas"


async def main() -> None:
    settings = get_settings()
    dsn = settings.database_url or DEFAULT_DSN

    conn = await asyncpg.connect(dsn=dsn)
    try:
        await conn.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations ("
            "filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
        )
        rows = await conn.fetch("SELECT filename FROM schema_migrations")
        applied = {r["filename"] for r in rows}
        for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
            if path.name in applied:
                print(f"skip    {path.name}")
                continue
            async with conn.transaction():
                await conn.execute(path.read_text(encoding="utf-8"))
                await conn.execute(
                    "INSERT INTO schema_migrations(filename) VALUES($1)", path.name
                )
            print(f"applied {path.name}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
