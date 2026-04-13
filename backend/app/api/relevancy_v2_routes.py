from __future__ import annotations

import threading
from typing import Optional

from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from app.agents.relevancy.service_v2 import run_relevancy_v2_for_business, rescore_relevancy_v2_for_business
from app.db.session import get_db
from app.models.exporter_profile import ExporterProfile
from app.models.search_result import SearchResult
from app.core.security import get_current_user
from app.models.user import User


router = APIRouter(prefix="/api/relevancy/v2", tags=["relevancy-v2"])


class RelevancyV2RunRequest(BaseModel):
    business_id: int
    website: str
    exporter_profile: str = ""
    # Optional full-context metadata — hydrates the LangGraph state
    search_id: int = 0
    business_name: Optional[str] = None
    category: Optional[str] = None
    address: Optional[str] = None
    description: Optional[str] = None


@router.post("/run")
def run_relevancy_v2(request: RelevancyV2RunRequest, db: Session = Depends(get_db)):
    profile = db.query(ExporterProfile).filter(
        ExporterProfile.is_default == True
    ).first()
    
    profile_text = ""
    if profile:
        parts = []
        if profile.company_name:
            parts.append(f"Company: {profile.company_name}")
        if profile.company_location:
            parts.append(f"Location: {profile.company_location}")
        if profile.product_categories:
            parts.append(f"Products: {', '.join(profile.product_categories)}")
        if profile.specializations:
            parts.append(f"Specializations: {', '.join(profile.specializations)}")
        if profile.export_markets:
            parts.append(f"Target markets: {', '.join(profile.export_markets)}")
        if profile.target_buyer_types:
            parts.append(f"Target buyers: {', '.join(profile.target_buyer_types)}")
        if profile.value_proposition:
            parts.append(f"Value proposition: {profile.value_proposition}")
        if profile.moq:
            parts.append(f"MOQ: {profile.moq} pieces")
        profile_text = ". ".join(parts)

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
    
    # Get exporter profile
    profile = db.query(ExporterProfile).filter(
        ExporterProfile.is_default == True
    ).first()
    
    profile_text = ""
    if profile:
        parts = []
        if profile.company_name:
            parts.append(f"Company: {profile.company_name}")
        if profile.company_location:
            parts.append(f"Location: {profile.company_location}")
        if profile.product_categories:
            parts.append(f"Products: {', '.join(profile.product_categories)}")
        if profile.specializations:
            parts.append(f"Specializations: {', '.join(profile.specializations)}")
        if profile.export_markets:
            parts.append(f"Target markets: {', '.join(profile.export_markets)}")
        if profile.target_buyer_types:
            parts.append(f"Target buyers: {', '.join(profile.target_buyer_types)}")
        if profile.value_proposition:
            parts.append(f"Value proposition: {profile.value_proposition}")
        if profile.moq:
            parts.append(f"MOQ: {profile.moq} pieces")
        profile_text = ". ".join(parts)
    
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
