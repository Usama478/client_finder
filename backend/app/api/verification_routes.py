from __future__ import annotations

import logging
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from fastapi import Request as FastAPIRequest
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.agents.verification.service import (
    get_phase,
    reset_stale_processing_leads,
)
from app.core.security import get_current_user, get_current_admin_user
from app.db.session import SessionLocal, get_db
from app.models.search_result import SearchResult
from app.services.credit_service import check_credits, deduct_credits
from app.services.activity_service import log_activity
from app.tasks.agent_tasks import run_verification_task

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/verification", tags=["verification"])


# --------------------------------------------------------------------------- #
# Request / Response schemas                                                   #
# --------------------------------------------------------------------------- #

class BatchVerifyRequest(BaseModel):
    business_ids: List[int]


# --------------------------------------------------------------------------- #
# Routes                                                                       #
# --------------------------------------------------------------------------- #

@router.post("/verify/batch")
def verify_batch(
    batch_request: BatchVerifyRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Run the Verification Agent for a list of business IDs sequentially.

    Returns a summary dict with per-business outcomes.
    Individual failures are captured and reported without aborting the batch.
    """
    logger.info(f"[VERIFICATION_BATCH] Parsed business_ids: {batch_request.business_ids}")

    if not batch_request.business_ids:
        raise HTTPException(status_code=400, detail="No business_ids provided.")

    requested = set(batch_request.business_ids)
    owned_ids = [
        r.result_id for r in db.query(SearchResult).filter(
            SearchResult.result_id.in_(requested),
            SearchResult.user_id == current_user.user_id
        ).all()
    ]
    missing = requested - set(owned_ids)
    if missing:
        raise HTTPException(
            status_code=404,
            detail=f"IDs not found or not owned: {sorted(missing)}",
        )

    cost = len(owned_ids) * 5
    check_credits(db, current_user.user_id, cost)

    # Stamp queued + clear stale verification fields so polling cannot report
    # a previous run's terminal state while these tasks wait in the queue.
    # Skip rows currently mid-processing so we do not clobber an in-flight run.
    leads_to_queue: List[int] = []
    for lead in db.query(SearchResult).filter(SearchResult.result_id.in_(owned_ids)).all():
        if lead.verification_status == "processing":
            continue
        lead.verification_status = "queued"
        lead.verification_result = None
        lead.verification_score = None
        leads_to_queue.append(lead.result_id)
    db.commit()

    for bid in leads_to_queue:
        run_verification_task.delay(bid, current_user.user_id)

    deduct_credits(db, current_user.user_id, len(leads_to_queue) * 5, "verification", reference_type="batch")
    db.commit()
    try:
        log_activity(db, current_user.user_id, "verification_run", metadata={"count": len(leads_to_queue)}, credits_consumed=len(leads_to_queue) * 5)
        db.commit()
    except Exception:
        pass

    return JSONResponse(status_code=202, content={"status": "queued", "count": len(leads_to_queue)})


@router.post("/verify/{business_id}")
def verify_single(business_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Run the Verification Agent for a single business synchronously.

    Returns the verification output dict on success.
    Returns HTTP 404 if the business_id does not exist in the database.
    Returns HTTP 500 for any other unexpected failure.
    """
    check_credits(db, current_user.user_id, 5)

    uid = int(current_user.user_id)
    lead = db.query(SearchResult).filter(
        SearchResult.result_id == business_id,
        SearchResult.user_id == uid
    ).first()
    if not lead:
        raise HTTPException(status_code=404, detail=f"Business ID {business_id} not found.")
    if lead.verification_status == "processing":
        raise HTTPException(status_code=409, detail="Verification already running for this business.")

    # Stamp queued + clear stale verification fields so polling cannot report
    # a previous run's terminal state while this task waits in the queue.
    lead.verification_status = "queued"
    lead.verification_result = None
    lead.verification_score = None
    db.commit()

    run_verification_task.delay(business_id, current_user.user_id)
    deduct_credits(db, current_user.user_id, 5, "verification", reference_id=str(business_id), reference_type="business")
    db.commit()
    try:
        log_activity(db, current_user.user_id, "verification_run", business_id=business_id, credits_consumed=5)
        db.commit()
    except Exception:
        pass
    return JSONResponse(status_code=202, content={"status": "queued", "business_id": business_id})


@router.post("/admin/reset-stale")
def reset_stale(max_age_minutes: int = 15, current_user = Depends(get_current_admin_user)) -> Dict[str, Any]:
    """
    Reset leads permanently stuck in ``verification_status="processing"``.

    Finds rows whose ``created_at`` is older than ``max_age_minutes`` minutes
    and whose status is still ``"processing"``, then stamps them ``"failed"``
    so they are visible and re-queueable.

    Query parameter:
    - ``max_age_minutes`` (int, default 15): minimum age before a row is
      considered stale.

    This endpoint is intended for use by operators, cron jobs, or an
    APScheduler beat task.  It is idempotent and safe to call repeatedly.
    """
    try:
        reset_count = reset_stale_processing_leads(max_age_minutes=max_age_minutes)
        return {
            "reset_count": reset_count,
            "max_age_minutes": max_age_minutes,
            "status": "ok",
        }
    except Exception as exc:
        logger.error("reset_stale FAILED error=%s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Reset failed: {exc}")


@router.get("/in-flight")
def get_in_flight_verification(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
) -> Dict[str, Any]:
    leads = (
        db.query(SearchResult)
        .filter(
            SearchResult.user_id == current_user.user_id,
            SearchResult.verification_status.in_(("queued", "processing")),
        )
        .order_by(SearchResult.result_id.asc())
        .all()
    )
    return {
        "items": [
            {
                "business_id": lead.result_id,
                "search_id": lead.search_id,
                "business_name": lead.business_name,
                "status": lead.verification_status,
                "current_phase": get_phase(lead.result_id),
            }
            for lead in leads
        ]
    }


@router.get("/{business_id}/status")
def get_verification_status(business_id: int, current_user = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Return the current verification_status, verification_result, and
    verification_score for a single business.

    Returns HTTP 404 if the business_id does not exist.
    """
    db = SessionLocal()
    try:
        lead = (
            db.query(SearchResult)
            .filter(SearchResult.result_id == business_id, SearchResult.user_id == current_user.user_id)
            .first()
        )
        if not lead:
            raise HTTPException(
                status_code=404,
                detail=f"Business ID {business_id} not found in database.",
            )
        return {
            "business_id": business_id,
            "verification_status": lead.verification_status,
            "verification_result": lead.verification_result,
            "verification_score": lead.verification_score,
            "current_phase": get_phase(business_id),
        }
    finally:
        db.close()
