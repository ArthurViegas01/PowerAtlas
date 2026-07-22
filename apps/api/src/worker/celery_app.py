"""Celery application factory (F5a).

Mirrors the Encaixe house convention: broker/backend configuration lives in
one place, tasks are discovered from src.worker.tasks when the worker starts.

Usage (docker compose, the primary path):
    celery -A src.worker.celery_app worker --loglevel=INFO --concurrency=2

On the Windows host (Celery 5 has no native Windows support, so the pool
must be `solo`):
    celery -A src.worker.celery_app worker --loglevel=INFO --pool=solo
"""

from __future__ import annotations

from celery import Celery

from src.core.config import get_settings

settings = get_settings()

app = Celery(
    "poweratlas",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["src.worker.tasks"],
)

app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Only ack after the task finishes (safer for pipeline steps).
    task_acks_late=True,
    # Do not pre-fetch more than one task per worker process.
    worker_prefetch_multiplier=1,
)
