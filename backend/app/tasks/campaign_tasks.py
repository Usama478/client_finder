from __future__ import annotations

import logging

from app.celery_app import celery_app
from app.db.session import SessionLocal
from app.models.campaign import Campaign
from app.services.campaign_engine_service import run_campaign_engine, run_campaign_resume

logger = logging.getLogger(__name__)


def _claim_check(campaign_id: int) -> bool:
    """Point-in-time defense-in-depth guard (Section 7).

    Returns True if this worker may proceed, False if another worker is
    currently holding a transaction lock on the campaign row (i.e. already
    processing it). The lock is released immediately so the engine's own
    SessionLocal() is never blocked.
    """
    db = SessionLocal()
    try:
        locked = (
            db.query(Campaign)
            .filter(Campaign.id == campaign_id)
            .with_for_update(skip_locked=True)
            .first()
        )
        if locked is not None:
            return True
        # skip_locked returned None: either the row is locked elsewhere or it
        # does not exist. Distinguish with a non-locking read.
        exists = db.query(Campaign.id).filter(Campaign.id == campaign_id).first()
        if exists is None:
            logger.warning("campaign_task: campaign_id=%s not found, skipping", campaign_id)
        else:
            logger.warning(
                "campaign_task: campaign_id=%s is locked by another worker, skipping",
                campaign_id,
            )
        return False
    finally:
        db.rollback()
        db.close()


@celery_app.task(
    bind=True,
    name="app.tasks.campaign_tasks.run_campaign_task",
    acks_late=True,
    reject_on_worker_lost=True,
)
def run_campaign_task(self, campaign_id: int) -> str:
    """Run the full campaign engine for a freshly created campaign."""
    if not _claim_check(campaign_id):
        return "skipped"
    logger.info("run_campaign_task start campaign_id=%s task_id=%s", campaign_id, self.request.id)
    run_campaign_engine(campaign_id)
    logger.info("run_campaign_task done campaign_id=%s", campaign_id)
    return "ok"


@celery_app.task(
    bind=True,
    name="app.tasks.campaign_tasks.resume_campaign_task",
    acks_late=True,
    reject_on_worker_lost=True,
)
def resume_campaign_task(self, campaign_id: int) -> str:
    """Resume a paused/stalled campaign (drain pending + discover)."""
    if not _claim_check(campaign_id):
        return "skipped"
    logger.info("resume_campaign_task start campaign_id=%s task_id=%s", campaign_id, self.request.id)
    run_campaign_resume(campaign_id)
    logger.info("resume_campaign_task done campaign_id=%s", campaign_id)
    return "ok"
