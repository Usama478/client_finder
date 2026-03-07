from __future__ import annotations

from pydantic import BaseModel
from fastapi import APIRouter, HTTPException

from app.agents.relevancy.service_v2 import run_relevancy_v2_for_business


router = APIRouter(prefix="/api/relevancy/v2", tags=["relevancy-v2"])


class RelevancyV2RunRequest(BaseModel):
    business_id: int
    website: str
    exporter_profile: str


@router.post("/run")
def run_relevancy_v2(request: RelevancyV2RunRequest):
    try:
        output = run_relevancy_v2_for_business(
            business_id=request.business_id,
            website=request.website,
            exporter_profile=request.exporter_profile,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to run relevancy v2: {exc}") from exc

    return {"business_id": request.business_id, **output}
