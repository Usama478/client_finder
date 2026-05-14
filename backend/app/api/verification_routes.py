from __future__ import annotations

import logging
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from fastapi import Request as FastAPIRequest
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.agents.verification.service import (
    reset_stale_processing_leads,
    run_verification_batch,
    run_verification_for_business,
)
from app.core.security import get_current_user
from app.db.session import SessionLocal, get_db
from app.models.search_result import SearchResult
from app.services.credit_service import check_credits, deduct_credits
from app.services.activity_service import log_activity

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

from fastapi import Request as RawRequest

@router.post("/verify/batch-debug")
async def verify_batch_debug(request: RawRequest, current_user = Depends(get_current_user)):
    """Debugging endpoint - shows exactly what the frontend is sending"""
    body = await request.body()
    body_str = body.decode('utf-8')
    
    try:
        import json
        parsed = json.loads(body_str)
        logger.info(f"[BATCH_DEBUG] Raw body: {body_str}")
        logger.info(f"[BATCH_DEBUG] Parsed JSON: {parsed}")
        logger.info(f"[BATCH_DEBUG] Type of business_ids: {type(parsed.get('business_ids'))}")
        if 'business_ids' in parsed:
            logger.info(f"[BATCH_DEBUG] First ID type: {type(parsed['business_ids'][0]) if parsed['business_ids'] else 'empty'}")
        return {"status": "debug", "received": parsed}
    except Exception as e:
        logger.error(f"[BATCH_DEBUG] Failed to parse: {e}")
        return {"status": "error", "raw": body_str, "error": str(e)}

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

    owned_ids = [
        r.result_id for r in db.query(SearchResult).filter(
            SearchResult.result_id.in_(batch_request.business_ids),
            SearchResult.user_id == current_user.user_id
        ).all()
    ]
    if not owned_ids:
        raise HTTPException(status_code=404, detail="No matching business IDs found.")

    cost = len(owned_ids) * 2
    check_credits(db, current_user.user_id, cost)

    results = run_verification_batch(owned_ids)

    deduct_credits(db, current_user.user_id, len(owned_ids) * 2, "verification", reference_type="batch")
    db.commit()
    try:
        log_activity(db, current_user.user_id, "verification_run", metadata={"count": len(owned_ids)}, credits_consumed=len(owned_ids) * 2)
        db.commit()
    except Exception:
        pass

    total = len(owned_ids)
    succeeded = sum(1 for r in results if r["status"] == "ok")
    skipped = sum(1 for r in results if r.get("result", {}).get("status") == "skipped")

    return {
        "total": total,
        "succeeded": succeeded,
        "skipped": skipped,
        "failed": total - succeeded - skipped,
        "results": results,
    }


@router.post("/verify/{business_id}")
def verify_single(business_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Run the Verification Agent for a single business synchronously.

    Returns the verification output dict on success.
    Returns HTTP 404 if the business_id does not exist in the database.
    Returns HTTP 500 for any other unexpected failure.
    """
    check_credits(db, current_user.user_id, 2)
    
    lead = db.query(SearchResult).filter(
        SearchResult.result_id == business_id,
        SearchResult.user_id == current_user.user_id
    ).first()
    if not lead:
        raise HTTPException(status_code=404, detail=f"Business ID {business_id} not found.")
    
    try:
        result = run_verification_for_business(business_id)
        
        deduct_credits(db, current_user.user_id, 2, "verification", reference_id=str(business_id), reference_type="business")
        db.commit()
        try:
            log_activity(db, current_user.user_id, "verification_run", business_id=business_id, credits_consumed=2)
            db.commit()
        except Exception:
            pass
        
        return {"business_id": business_id, "result": result}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.error(
            "verify_single FAILED business_id=%s error=%s", business_id, exc, exc_info=True
        )
        raise HTTPException(status_code=500, detail=f"Verification failed: {exc}")


@router.post("/admin/reset-stale")
def reset_stale(max_age_minutes: int = 15, current_user = Depends(get_current_user)) -> Dict[str, Any]:
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
        }
    finally:
        db.close()
