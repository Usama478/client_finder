from __future__ import annotations

import threading
from typing import Optional

from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from app.agents.relevancy.service_v2 import run_relevancy_v2_for_business, rescore_relevancy_v2_for_business
from app.db.session import get_db
from app.models.search_context import SearchContext
from app.models.search_result import SearchResult
from app.core.security import get_current_user
from app.models.user import User
from app.services.credit_service import check_credits, deduct_credits
from app.services.activity_service import log_activity


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


@router.post("/run")
def run_relevancy_v2(request: RelevancyV2RunRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    profile_text = ""
    if request.context_id:
        ctx = db.query(SearchContext).filter(SearchContext.id == request.context_id).first()
        if ctx and ctx.prompt_text:
            profile_text = ctx.prompt_text

    check_credits(db, current_user.user_id, 1)

    try:
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
