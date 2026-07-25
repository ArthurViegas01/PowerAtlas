"""Raw asyncpg access to the isolated `datasets` namespace (migration 0003).

Kept strictly separate from the power-entity repository: these functions only
ever touch `datasets`/`dataset_rows`, so imports can never affect the served
power-data payload.
"""

from __future__ import annotations

import json

import asyncpg

from ..models.dataset import (
    DatasetColumn,
    DatasetDetail,
    DatasetMeta,
    ImportRequest,
)


def _columns(raw: object) -> list[DatasetColumn]:
    data = raw if isinstance(raw, list) else json.loads(str(raw))
    return [DatasetColumn.model_validate(c) for c in data]


def _meta(row: asyncpg.Record) -> DatasetMeta:
    return DatasetMeta(
        id=str(row["id"]),
        name=row["name"],
        source=row["source"],
        columns=_columns(row["columns"]),
        row_count=row["row_count"],
        created_at=row["created_at"],
    )


async def list_datasets(pool: asyncpg.Pool) -> list[DatasetMeta]:
    rows = await pool.fetch(
        "SELECT id, name, source, columns, row_count, created_at "
        "FROM datasets ORDER BY created_at DESC"
    )
    return [_meta(row) for row in rows]


async def get_dataset(pool: asyncpg.Pool, dataset_id: str) -> DatasetDetail | None:
    async with pool.acquire() as conn:
        meta_row = await conn.fetchrow(
            "SELECT id, name, source, columns, row_count, created_at "
            "FROM datasets WHERE id = $1",
            dataset_id,
        )
        if meta_row is None:
            return None
        row_records = await conn.fetch(
            "SELECT data FROM dataset_rows WHERE dataset_id = $1 ORDER BY ord",
            dataset_id,
        )
    meta = _meta(meta_row)
    rows = [
        r["data"] if isinstance(r["data"], dict) else json.loads(r["data"])
        for r in row_records
    ]
    return DatasetDetail(**meta.model_dump(), rows=rows)


async def create_dataset(pool: asyncpg.Pool, request: ImportRequest) -> DatasetMeta:
    columns_json = json.dumps([c.model_dump() for c in request.columns])
    async with pool.acquire() as conn, conn.transaction():
        meta_row = await conn.fetchrow(
            "INSERT INTO datasets(name, source, columns, row_count) "
            "VALUES($1, $2, $3::jsonb, $4) "
            "RETURNING id, name, source, columns, row_count, created_at",
            request.name,
            request.source,
            columns_json,
            len(request.rows),
        )
        assert meta_row is not None
        await conn.executemany(
            "INSERT INTO dataset_rows(dataset_id, ord, data) VALUES($1, $2, $3::jsonb)",
            [
                (meta_row["id"], i, json.dumps(row))
                for i, row in enumerate(request.rows)
            ],
        )
    return _meta(meta_row)


async def delete_dataset(pool: asyncpg.Pool, dataset_id: str) -> bool:
    result = await pool.execute("DELETE FROM datasets WHERE id = $1", dataset_id)
    # asyncpg returns e.g. "DELETE 1"; 0 means nothing matched.
    return result.rsplit(" ", 1)[-1] != "0"
