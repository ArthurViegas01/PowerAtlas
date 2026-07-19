"""Pydantic mirror of the TypeScript data contract.

Field-for-field port of ``apps/web/src/types/power-entity.ts``. Field names are
snake_case in Python and serialized as camelCase via ``to_camel`` aliases, so
the JSON payload is byte-compatible with what the web ``mockDataLoader`` builds
today. ``extra="forbid"`` makes any drift between the mock JSON and this schema
fail loudly instead of passing silently.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

ConfidenceLevel = Literal["high", "medium", "low"]
ReviewStatus = Literal["draft", "published"]
PowerDimension = Literal["official", "hidden"]
EntityKind = Literal[
    "office",
    "institution",
    "organization",
    "faction",
    "movement",
    "economic-bloc",
]


class _Base(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class SourceCitation(_Base):
    id: str
    label: str
    url: str | None = None
    published_at: str | None = None
    note: str | None = None


class PowerEntity(_Base):
    id: str
    name: str
    kind: EntityKind
    dimension: PowerDimension
    score: int
    delta: int
    confidence: ConfidenceLevel
    status: ReviewStatus
    sources: list[SourceCitation]
    note: str | None = None


class RegionCapital(_Base):
    name: str
    coordinates: tuple[float, float]


class PowerRegion(_Base):
    id: str
    name: str
    kind: Literal["country", "state"]
    capital: RegionCapital
    updated_at: str
    official: list[PowerEntity]
    hidden: list[PowerEntity]


class InfluenceLink(_Base):
    id: str
    from_: str = Field(alias="from")
    to: str
    strength: float
    dimension: PowerDimension
    label: str | None = None


class AmbientSignal(_Base):
    coordinates: tuple[float, float]
    weight: float


class RegionPowerData(_Base):
    schema_version: Literal[1]
    generated_at: str
    disclaimer: str
    regions: list[PowerRegion]
    links: list[InfluenceLink]
    ambient_signals: list[AmbientSignal]
