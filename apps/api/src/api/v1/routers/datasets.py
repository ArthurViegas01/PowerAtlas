"""Operator-imported datasets (data console). Isolated `datasets` namespace.

Reads are open; writes (import/delete) require a valid admin session (see
core/auth.py: ``Depends(require_admin)``), so only the logged-in operator can
mutate. Every write touches only the `datasets`/`dataset_rows` tables, so the
served power-data payload is never affected. Export is done client-side from the
detail payload, uniform with the built-in datasets, so there is no server export
endpoint.
"""

from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from ....core.auth import require_admin
from ....data import datasets_repo
from ....models.dataset import DatasetDetail, DatasetList, DatasetMeta, ImportRequest

router = APIRouter(prefix="/v1/datasets", tags=["datasets"])


def _pool(request: Request) -> asyncpg.Pool:
    pool = getattr(request.app.state, "db_pool", None)
    if pool is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Nenhum banco configurado; datasets importados exigem o stack no ar.",
        )
    return pool


@router.get("", response_model=DatasetList, response_model_by_alias=True)
async def list_datasets(request: Request) -> DatasetList:
    pool = getattr(request.app.state, "db_pool", None)
    if pool is None:
        return DatasetList(datasets=[])
    return DatasetList(datasets=await datasets_repo.list_datasets(pool))


@router.get("/{dataset_id}", response_model=DatasetDetail, response_model_by_alias=True)
async def get_dataset(request: Request, dataset_id: str) -> DatasetDetail:
    detail = await datasets_repo.get_dataset(_pool(request), dataset_id)
    if detail is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset não encontrado.")
    return detail


@router.post(
    "/import",
    response_model=DatasetMeta,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
async def import_dataset(
    request: Request, payload: ImportRequest, _: None = Depends(require_admin)
) -> DatasetMeta:
    pool = _pool(request)
    keys = {c.key for c in payload.columns}
    if len(keys) != len(payload.columns):
        raise HTTPException(status_code=422, detail="Chaves de coluna duplicadas.")
    return await datasets_repo.create_dataset(pool, payload)


@router.delete("/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dataset(
    request: Request, dataset_id: str, _: None = Depends(require_admin)
) -> Response:
    deleted = await datasets_repo.delete_dataset(_pool(request), dataset_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset não encontrado.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
