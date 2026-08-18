"""Pydantic models for the admin login endpoint."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class _Base(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class LoginRequest(_Base):
    password: str


class LoginResponse(_Base):
    token: str
    # Session expiry as epoch seconds; the console stops using the token past it.
    expires_at: int
