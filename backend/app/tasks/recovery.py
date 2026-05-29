from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from celery.signals import worker_ready

logger = logging.getLogger(__name__)

# A campaign stuck in "running" with no recent heartbeat is presumed orphaned
# (the worker that owned it died: OOM, deploy restart, spot interruption).
STALE_RUNNING_MINUTES = 10


@worker_ready.connect
def recover_stuck_campaigns(**_kwargs) -> None:
    """Belt-and-suspenders startup sweep (Section 5, Layer 2).

    Runs once when a worker finishes booting. Catches the edge case where the
    broker itself lost a message (Redis restart without persistence) or where a
    Campaign row was committed but the .delay() never fired.
    """
    from app.db.session import SessionLocal
    from app.models.campaign import Campaign
    from app.models.search_result import SearchResult
    from app.tasks.campaign_tasks import resume_campaign_task, run_campaign_task

    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=STALE_RUNNING_MINUTES)

        stale_running = (
            db.query(Campaign)
            .filter(
                Campaign.status == "running",
                Campaign.updated_at < cutoff,
            )
            .all()
        )
        for campaign in stale_running:
            db.query(SearchResult).filter(
                SearchResult.campaign_id == campaign.id,
                SearchResult.campaign_status.in_(
                    ["running_relevance", "running_verification"]
                ),
            ).update(
                {"campaign_status": "pending_relevance"}, synchronize_session=False
            )
            db.commit()
            logger.warning(
                "recovery: re-enqueuing stale running campaign_id=%s (idle since %s)",
                campaign.id,
                campaign.updated_at,
            )
            resume_campaign_task.delay(campaign.id)

        # Campaigns committed as "pending" whose enqueue never landed
        # (crash between db.commit() and .delay(), or broker eviction).
        orphan_pending = (
            db.query(Campaign).filter(Campaign.status == "pending").all()
        )
        for campaign in orphan_pending:
            logger.warning(
                "recovery: re-enqueuing orphan pending campaign_id=%s", campaign.id
            )
            run_campaign_task.delay(campaign.id)
    except Exception:  # never let recovery crash worker boot
        logger.exception("recovery: startup sweep failed")
        db.rollback()
    finally:
        db.close()

    # Verification-level stuck rows (processing lock orphans).
    try:
        from app.agents.verification.service import reset_stale_processing_leads

        reset = reset_stale_processing_leads()
        if reset:
            logger.warning("recovery: reset %s stale verification rows", reset)
    except Exception:
        logger.exception("recovery: reset_stale_processing_leads failed")
