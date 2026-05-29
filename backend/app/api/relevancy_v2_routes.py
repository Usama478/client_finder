from __future__ import annotations

import threading
from typing import Optional

from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.agents.relevancy.phase_tracker import get_relevance_phase
from app.agents.relevancy.service_v2 import rescore_relevancy_v2_for_business
from app.db.session import get_db
from app.models.search_context import SearchContext
from app.models.search_result import SearchResult
from app.core.security import get_current_user
from app.models.user import User
from app.services.credit_service import check_credits, deduct_credits
from app.services.activity_service import log_activity
from app.tasks.agent_tasks import run_relevancy_task
import logging
logger = logging.getLogger(__name__)


router = APIRouter(prefix="/api/v1/relevancy/v2", tags=["relevancy-v2"])


class RelevancyV2RunRequest(BaseModel):
    business_id: int
    website: str
    context_id: Optional[int] = None
    # Optional full-context metadata — hydrates the LangGraph state
    search_id: int = 0
    business_name: Optional[str] = None
    category: Optional[str] = None
    address: Optional[str] = None
    description: Optional[str] = None


@router.get("/{business_id}/status")
def get_relevancy_status(
    business_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lead = db.query(SearchResult).filter(
        SearchResult.result_id == business_id,
        SearchResult.user_id == current_user.user_id,
    ).first()
    if not lead:
        raise HTTPException(status_code=404, detail=f"Business ID {business_id} not found.")
    return {
        "business_id": business_id,
        "relevance_status": lead.relevance_status,
        "relevance_decision": lead.relevance_decision,
        "relevance_score": lead.relevance_score,
        "current_phase": get_relevance_phase(business_id),
    }


@router.get("/in-flight")
def get_in_flight_relevancy(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    leads = (
        db.query(SearchResult)
        .filter(
            SearchResult.user_id == current_user.user_id,
            SearchResult.relevance_status.in_(("queued", "processing")),
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
                "status": lead.relevance_status,
                "current_phase": get_relevance_phase(lead.result_id),
            }
            for lead in leads
        ]
    }


@router.post("/run")
def run_relevancy_v2(request: RelevancyV2RunRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    profile_text = ""
    logger.warning(f"[RELEVANCY DEBUG] business_id={request.business_id} context_id={request.context_id}")
    if not request.context_id:
        logger.warning("[RELEVANCY DEBUG] context_id is None or missing — agent will run with empty profile_text")
    else:
        ctx = db.query(SearchContext).filter(
            SearchContext.id == request.context_id,
            SearchContext.user_id == current_user.user_id,
        ).first()
        if not ctx:
            logger.warning(f"[RELEVANCY DEBUG] SearchContext id={request.context_id} NOT FOUND in DB — raising 404")
            raise HTTPException(status_code=404, detail=f"SearchContext id={request.context_id} not found")
        if not ctx.prompt_text:
            logger.warning(f"[RELEVANCY DEBUG] SearchContext id={request.context_id} found but prompt_text is EMPTY")
        else:
            profile_text = ctx.prompt_text
            logger.warning(f"[RELEVANCY DEBUG] SearchContext id={ctx.id} name={ctx.name!r} prompt_text_preview={ctx.prompt_text[:200]!r}")
    logger.warning(f"[RELEVANCY DEBUG] final profile_text passed to agent — length={len(profile_text)} preview={profile_text[:200]!r}")

    lead = db.query(SearchResult).filter(
        SearchResult.result_id == request.business_id,
        SearchResult.user_id == current_user.user_id,
    ).first()
    if lead is None:
        raise HTTPException(status_code=404, detail=f"Business ID {request.business_id} not found.")
    if lead.relevance_status == "processing":
        raise HTTPException(status_code=409, detail="Relevance already running for this business.")

    # Stamp queued + clear stale decision so the polling status endpoint cannot
    # report a previous run's terminal state while this task waits in the queue.
    lead.relevance_status = "queued"
    lead.relevance_decision = None
    lead.relevance_reason = None
    lead.relevance_score = None
    db.commit()

    run_relevancy_task.delay(
        request.business_id,
        current_user.user_id,
        profile_text,
        "",
        request.context_id,
    )
    deduct_credits(db, current_user.user_id, 2, "relevancy", reference_id=str(request.business_id), reference_type="business")
    db.commit()
    try:
        log_activity(db, current_user.user_id, "relevancy_run", business_id=request.business_id, credits_consumed=2)
        db.commit()
    except Exception:
        pass
    return JSONResponse(status_code=202, content={"status": "queued", "business_id": request.business_id})


@router.post("/rescore/{business_id}")
def rescore_relevancy_v2_endpoint(
    business_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Re-runs only the LLM judge using cached scraped_text_content.
    Skips all collection nodes. Runs in background thread.
    """
    # Verify the lead belongs to current_user
    lead = db.query(SearchResult).filter(
        SearchResult.result_id == business_id,
        SearchResult.user_id == current_user.user_id
    ).first()
    
    if not lead:
        raise HTTPException(
            status_code=404,
            detail=f"Business ID {business_id} not found or does not belong to current user"
        )
    
    profile_text = ""
    
    # Run rescore in background thread
    def _rescore_task():
        try:
            rescore_relevancy_v2_for_business(
                business_id=business_id,
                exporter_profile=profile_text,
            )
        except Exception:
            pass
    
    thread = threading.Thread(target=_rescore_task, daemon=True)
    thread.start()
    
    return {
        "status": "started",
        "message": f"Rescore started for business_id={business_id}",
        "business_id": business_id
    }
