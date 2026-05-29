from __future__ import annotations

import logging
from typing import Optional

from app.celery_app import celery_app
from app.db.session import SessionLocal
from app.models.search_result import SearchResult

logger = logging.getLogger(__name__)


def _assert_ownership(result_id: int, user_id: int) -> bool:
    """Re-fetch the SearchResult and verify ownership (Section 6).

    Celery tasks must never trust that the caller validated ownership, so every
    task that writes to a user-owned resource re-checks user_id first.
    """
    db = SessionLocal()
    try:
        sr = (
            db.query(SearchResult.user_id)
            .filter(SearchResult.result_id == result_id)
            .first()
        )
        if sr is None:
            logger.warning("agent_task: result_id=%s not found, skipping", result_id)
            return False
        if sr.user_id != user_id:
            logger.warning(
                "agent_task: ownership mismatch result_id=%s expected_user=%s actual_user=%s",
                result_id,
                user_id,
                sr.user_id,
            )
            return False
        return True
    finally:
        db.close()


@celery_app.task(
    bind=True,
    name="app.tasks.agent_tasks.run_relevancy_task",
    acks_late=True,
    reject_on_worker_lost=True,
)
def run_relevancy_task(
    self,
    result_id: int,
    user_id: int,
    context_text: str = "",
    search_intent: str = "",
    context_id: Optional[int] = None,
) -> str:
    """Standalone relevancy run for a single business (Phase 2 offload)."""
    if not _assert_ownership(result_id, user_id):
        return "forbidden"
    # Reuse the engine's exact argument assembly so behavior matches campaigns.
    from app.services.campaign_engine_service import _run_relevance_sync

    _run_relevance_sync(result_id, context_text, search_intent, context_id)
    return "ok"


@celery_app.task(
    bind=True,
    name="app.tasks.agent_tasks.run_verification_task",
    acks_late=True,
    reject_on_worker_lost=True,
)
def run_verification_task(self, result_id: int, user_id: int) -> str:
    """Standalone verification run for a single business (Phase 2 offload)."""
    if not _assert_ownership(result_id, user_id):
        return "forbidden"
    from app.agents.verification.service import run_verification_for_business

    run_verification_for_business(result_id)
    return "ok"
