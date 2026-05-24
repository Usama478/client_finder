from __future__ import annotations

import threading
from typing import Optional

from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from app.agents.relevancy.phase_tracker import get_relevance_phase
from app.agents.relevancy.service_v2 import run_relevancy_v2_for_business, rescore_relevancy_v2_for_business
from app.db.session import get_db
from app.models.search_context import SearchContext
from app.models.search_result import SearchResult
from app.core.security import get_current_user
from app.models.user import User
from app.services.credit_service import check_credits, deduct_credits
from app.services.activity_service import log_activity
import logging
logger = logging.getLogger(__name__)


router = APIRouter(prefix="/api/relevancy/v2", tags=["relevancy-v2"])


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


@router.post("/run")
def run_relevancy_v2(request: RelevancyV2RunRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    profile_text = ""
    logger.warning(f"[RELEVANCY DEBUG] business_id={request.business_id} context_id={request.context_id}")
    if not request.context_id:
        logger.warning("[RELEVANCY DEBUG] context_id is None or missing — agent will run with empty profile_text")
    else:
        ctx = db.query(SearchContext).filter(SearchContext.id == request.context_id).first()
        if not ctx:
            logger.warning(f"[RELEVANCY DEBUG] SearchContext id={request.context_id} NOT FOUND in DB — raising 404")
            raise HTTPException(status_code=404, detail=f"SearchContext id={request.context_id} not found")
        if not ctx.prompt_text:
            logger.warning(f"[RELEVANCY DEBUG] SearchContext id={request.context_id} found but prompt_text is EMPTY")
        else:
            profile_text = ctx.prompt_text
            logger.warning(f"[RELEVANCY DEBUG] SearchContext id={ctx.id} name={ctx.name!r} prompt_text_preview={ctx.prompt_text[:200]!r}")
    logger.warning(f"[RELEVANCY DEBUG] final profile_text passed to agent — length={len(profile_text)} preview={profile_text[:200]!r}")

    check_credits(db, current_user.user_id, 1)

    # Fast-path: if the lead already has completed scraped content, skip the
    # expensive full-crawl graph and run only the LLM judge (rescore path).
    lead = db.query(SearchResult).filter(
        SearchResult.result_id == request.business_id,
        SearchResult.user_id == current_user.user_id
    ).first()
    use_fast_path = (
        lead is not None
        and lead.scraping_status == "completed"
        and bool(lead.scraped_text_content)
    )
    logger.warning(
        f"[RELEVANCY DEBUG] business_id={request.business_id} use_fast_path={use_fast_path}"
    )

    try:
        if use_fast_path:
            output = rescore_relevancy_v2_for_business(
                business_id=request.business_id,
                exporter_profile=profile_text,
            )
        else:
            output = run_relevancy_v2_for_business(
                business_id=request.business_id,
                website=request.website,
                exporter_profile=profile_text,
                search_id=request.search_id,
                business_name=request.business_name,
                category=request.category,
                address=request.address,
                description=request.description,
            )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to run relevancy v2: {exc}") from exc

    deduct_credits(db, current_user.user_id, 1, "relevancy", reference_id=str(request.business_id), reference_type="business")
    db.commit()
    try:
        log_activity(db, current_user.user_id, "relevancy_run", business_id=request.business_id, credits_consumed=1)
        db.commit()
    except Exception:
        pass

    return {"business_id": request.business_id, **output}


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
