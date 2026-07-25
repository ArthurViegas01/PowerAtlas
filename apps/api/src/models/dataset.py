"""Pydantic models for operator-imported datasets (data console, isolated).

These live in the `datasets`/`dataset_rows` namespace (migration 0003), fully
separate from the served power-entity contract. Column descriptors mirror the
web's TabularDataset shape so an imported CSV round-trips through the same
rendering as the built-in datasets.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

ColumnFormat = Literal[
    "text", "int", "decimal", "brlThousands", "brl", "areaKm2", "density"
]

# Import guards: keep a single upload from exhausting the browser or the DB.
MAX_ROWS = 20_000
MAX_COLUMNS = 40


class _Base(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class DatasetColumn(_Base):
    key: str = Field(min_length=1, max_length=80)
    label: str = Field(min_length=1, max_length=120)
    numeric: bool = False
    format: ColumnFormat = "text"


class DatasetMeta(_Base):
    """Listing entry: metadata without the rows."""

    id: str
    name: str
    source: str
    columns: list[DatasetColumn]
    row_count: int
    created_at: datetime


class DatasetDetail(DatasetMeta):
    """A dataset with its rows (values keyed by column key)."""

    rows: list[dict[str, object]]


class DatasetList(_Base):
    datasets: list[DatasetMeta]


class ImportRequest(_Base):
    name: str = Field(min_length=1, max_length=160)
    source: str = Field(default="IMPORTADO", max_length=160)
    columns: list[DatasetColumn] = Field(min_length=1, max_length=MAX_COLUMNS)
    rows: list[dict[str, object]] = Field(min_length=1, max_length=MAX_ROWS)
