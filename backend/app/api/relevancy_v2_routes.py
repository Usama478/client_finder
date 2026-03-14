from __future__ import annotations

from typing import Optional

from pydantic import BaseModel
from fastapi import APIRouter, HTTPException

from app.agents.relevancy.service_v2 import run_relevancy_v2_for_business


router = APIRouter(prefix="/api/relevancy/v2", tags=["relevancy-v2"])


class RelevancyV2RunRequest(BaseModel):
    business_id: int
    website: str
    exporter_profile: str
    # Optional full-context metadata — hydrates the LangGraph state
    search_id: int = 0
    business_name: Optional[str] = None
    category: Optional[str] = None
    address: Optional[str] = None
    description: Optional[str] = None


@router.post("/run")
def run_relevancy_v2(request: RelevancyV2RunRequest):
    try:
        output = run_relevancy_v2_for_business(
            business_id=request.business_id,
            website=request.website,
            exporter_profile=request.exporter_profile,
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
