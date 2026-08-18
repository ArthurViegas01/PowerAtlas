"""Pydantic models for the data-console stats endpoint.

Counts and aggregates over what the database holds: the served content tables
(regions/entities/...) and the F5 pipeline staging (ingest sources, ingested
documents, scoring candidates). Provenance and volume only, no scores or
claims, so the content-safety rule (ARCHITECTURE.md section 5) is untouched.
"""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class _Base(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class SourceStat(_Base):
    id: str
    name: str
    documents: int
    last_published: datetime | None = None


class DayCount(_Base):
    day: date
    count: int


class ContentStats(_Base):
    """Row counts of the served (public-contract) tables."""

    regions: int
    entities: int
    ambient_signals: int
    influence_links: int


class PipelineStats(_Base):
    """Row counts + aggregates of the F5 ingestion/scoring staging tables."""

    documents: int
    candidates: int
    scoring_runs: int
    sources: list[SourceStat]
    documents_by_day: list[DayCount]


class StatsResponse(_Base):
    generated_at: datetime
    database: bool
    # Whether an admin is configured (PA_ADMIN_PASSWORD), i.e. writes are
    # possible on this server after login. The console shows the admin login
    # only when this is true; the write tools appear once logged in.
    writes_allowed: bool
    content: ContentStats
    pipeline: PipelineStats
