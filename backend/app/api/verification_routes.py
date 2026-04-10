from __future__ import annotations

import logging
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException
from fastapi import Request as FastAPIRequest
from pydantic import BaseModel

from app.agents.verification.service import (
    reset_stale_processing_leads,
    run_verification_batch,
    run_verification_for_business,
)
from app.db.session import SessionLocal
from app.models.search_result import SearchResult

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
async def verify_batch_debug(request: RawRequest):
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
async def verify_batch(
    batch_request: BatchVerifyRequest,
    raw_request: FastAPIRequest
) -> Dict[str, Any]:
    """
    Run the Verification Agent for a list of business IDs sequentially.

    Returns a summary dict with per-business outcomes.
    Individual failures are captured and reported without aborting the batch.
    """
    # Log the raw body
    body = await raw_request.json()
    logger.info(f"[VERIFICATION_BATCH] Raw body received: {body}")
    logger.info(f"[VERIFICATION_BATCH] Parsed business_ids: {batch_request.business_ids}")

    if not batch_request.business_ids:
        raise HTTPException(status_code=400, detail="No business_ids provided.")

    results = run_verification_batch(batch_request.business_ids)

    total = len(batch_request.business_ids)
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
def verify_single(business_id: int) -> Dict[str, Any]:
    """
    Run the Verification Agent for a single business synchronously.

    Returns the verification output dict on success.
    Returns HTTP 404 if the business_id does not exist in the database.
    Returns HTTP 500 for any other unexpected failure.
    """
    try:
        result = run_verification_for_business(business_id)
        return {"business_id": business_id, "result": result}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.error(
            "verify_single FAILED business_id=%s error=%s", business_id, exc, exc_info=True
        )
        raise HTTPException(status_code=500, detail=f"Verification failed: {exc}")


@router.post("/admin/reset-stale")
def reset_stale(max_age_minutes: int = 15) -> Dict[str, Any]:
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
def get_verification_status(business_id: int) -> Dict[str, Any]:
    """
    Return the current verification_status, verification_result, and
    verification_score for a single business.

    Returns HTTP 404 if the business_id does not exist.
    """
    db = SessionLocal()
    try:
        lead = (
            db.query(SearchResult)
            .filter(SearchResult.result_id == business_id)
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
