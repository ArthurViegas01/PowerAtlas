"""Pydantic models for the monitoring feed (headlines ingested by F5b).

These expose factual provenance data — headline, source agency, publication
date — from the allowlisted institutional feeds. No scores, no claims: the
content-safety rule (ARCHITECTURE.md §5) is untouched.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class _Base(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class MonitoringDocument(_Base):
    id: int
    source_id: str
    source_name: str
    title: str
    url: str
    published_at: datetime | None = None


class MonitoringResponse(_Base):
    documents: list[MonitoringDocument]
