from __future__ import annotations

import os

from celery import Celery

celery_app = Celery(
    "client_finder",
    broker=os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0"),
    backend=os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/1"),
    include=[
        "app.tasks.campaign_tasks",
        "app.tasks.agent_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    # At-least-once delivery: only ack after the task body finishes, and
    # re-queue if the worker dies mid-task (OOM kill, spot interruption, deploy).
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    # One unacked task per worker so a heavy campaign cannot starve others and
    # so prefetch never holds a task hostage on a crashed worker.
    worker_prefetch_multiplier=1,
    task_track_started=True,
    result_expires=86400,
    timezone="UTC",
    enable_utc=True,
)

# Importing the recovery module registers its worker_ready signal handler.
from app.tasks import recovery  # noqa: E402,F401
