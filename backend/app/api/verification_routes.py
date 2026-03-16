from __future__ import annotations

import logging
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.agents.verification.service import run_verification_for_business
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


@router.post("/verify/batch")
def verify_batch(request: BatchVerifyRequest) -> Dict[str, Any]:
    """
    Run the Verification Agent for a list of business IDs sequentially.

    Returns a summary dict with per-business outcomes.
    Individual failures are captured and reported without aborting the batch.
    """
    if not request.business_ids:
        raise HTTPException(status_code=400, detail="No business_ids provided.")

    results: List[Dict[str, Any]] = []

    for business_id in request.business_ids:
        try:
            outcome = run_verification_for_business(business_id)
            results.append({"business_id": business_id, "status": "ok", "result": outcome})
        except ValueError as exc:
            results.append({"business_id": business_id, "status": "not_found", "detail": str(exc)})
        except Exception as exc:
            logger.error(
                "verify_batch FAILED business_id=%s error=%s", business_id, exc, exc_info=True
            )
            results.append({"business_id": business_id, "status": "error", "detail": str(exc)})

    total = len(request.business_ids)
    succeeded = sum(1 for r in results if r["status"] == "ok")
    skipped = sum(1 for r in results if r.get("result", {}).get("status") == "skipped")

    return {
        "total": total,
        "succeeded": succeeded,
        "skipped": skipped,
        "failed": total - succeeded - skipped,
        "results": results,
    }


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
