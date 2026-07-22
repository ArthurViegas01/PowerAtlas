"""Worker smoke tests (F5a): celery app config + task registration.

No broker required: these assert configuration and call the task body
directly. The full broker round-trip is part of the manual compose
verification (PLAN, Verificação F5).
"""

from __future__ import annotations

from src.worker.celery_app import app
from src.worker.tasks import pipeline_smoke


def test_celery_app_config() -> None:
    assert app.main == "poweratlas"
    assert app.conf.task_serializer == "json"
    assert app.conf.accept_content == ["json"]
    assert app.conf.task_acks_late is True
    assert app.conf.worker_prefetch_multiplier == 1


def test_smoke_task_registered() -> None:
    assert "src.worker.tasks.pipeline_smoke" in app.tasks


def test_smoke_task_body() -> None:
    assert pipeline_smoke.run(echo="ping") == {"status": "ok", "echo": "ping"}
