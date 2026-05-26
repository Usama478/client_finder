from __future__ import annotations

import asyncio
from typing import List, Optional
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.campaign import Campaign
from app.models.search_context import SearchContext
from app.models.search_result import SearchResult
from app.core.security import get_current_user
from app.models.user import User
from app.services.campaign_engine_service import estimate_campaign_cost, run_campaign_engine, run_campaign_resume
from app.services.credit_service import get_balance
import json

router = APIRouter(prefix="/api/v1/campaigns", tags=["campaigns"])


class CampaignCreateRequest(BaseModel):
    search_intent: str
    context_id: Optional[int] = None
    target_count: int
    relevance_threshold: int = 60
    credit_budget: int
    discovery_platform: str = "both"


class CampaignResponse(BaseModel):
    id: int
    status: str
    search_intent: str
    target_count: int
    relevance_threshold: int
    credit_budget: int
    discovery_platform: str
    current_pass: int
    verified_count: int
    credits_used: int
    total_discovered: int
    total_relevance_passed: int
    total_verification_passed: int
    estimated_cost_low: Optional[int]
    estimated_cost_high: Optional[int]
    activity_log: Optional[list]
    error_message: Optional[str]
    started_at: Optional[str]
    completed_at: Optional[str]
    created_at: Optional[str]

    class Config:
        from_attributes = True


def _serialize_campaign(c: Campaign) -> dict:
    log = []
    try:
        log = json.loads(c.activity_log or "[]")
    except Exception:
        pass
    return {
        "id": c.id,
        "status": c.status,
        "search_intent": c.search_intent,
        "target_count": c.target_count,
        "relevance_threshold": c.relevance_threshold,
        "credit_budget": c.credit_budget,
        "discovery_platform": c.discovery_platform,
        "current_pass": c.current_pass or 0,
        "verified_count": c.verified_count or 0,
        "credits_used": c.credits_used or 0,
        "total_discovered": c.total_discovered or 0,
        "total_relevance_passed": c.total_relevance_passed or 0,
        "total_verification_passed": c.total_verification_passed or 0,
        "estimated_cost_low": c.estimated_cost_low,
        "estimated_cost_high": c.estimated_cost_high,
        "activity_log": log,
        "error_message": c.error_message,
        "started_at": c.started_at.isoformat() if c.started_at else None,
        "completed_at": c.completed_at.isoformat() if c.completed_at else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


@router.get("/estimate")
def get_estimate(target_count: int = 10, platform: str = "both"):
    return estimate_campaign_cost(target_count, platform)


@router.post("")
async def create_campaign(
    data: CampaignCreateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Only one active campaign per user
    active = db.query(Campaign).filter(
        Campaign.user_id == current_user.user_id,
        Campaign.status.in_(["pending", "running"]),
    ).with_for_update(skip_locked=True).first()
    if active:
        raise HTTPException(status_code=409, detail="You already have an active campaign. Cancel it first.")

    if data.context_id is not None:
        context = db.query(SearchContext).filter(
            SearchContext.id == data.context_id,
            SearchContext.user_id == current_user.user_id,
        ).first()
        if not context:
            raise HTTPException(status_code=404, detail="Not found")

    if data.credit_budget <= 0:
        raise HTTPException(status_code=400, detail="Credit budget must be positive")
    balance = get_balance(db, current_user.user_id)
    if data.credit_budget > balance:
        raise HTTPException(status_code=400, detail="Credit budget exceeds available credits")

    estimate = estimate_campaign_cost(data.target_count, data.discovery_platform)
    campaign = Campaign(
        user_id=current_user.user_id,
        search_intent=data.search_intent,
        context_id=data.context_id,
        target_count=data.target_count,
        relevance_threshold=data.relevance_threshold,
        credit_budget=data.credit_budget,
        discovery_platform=data.discovery_platform,
        estimated_cost_low=estimate["low"],
        estimated_cost_high=estimate["high"],
        status="pending",
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)

    background_tasks.add_task(run_campaign_engine, campaign.id)
    return _serialize_campaign(campaign)


@router.get("")
def list_campaigns(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaigns = db.query(Campaign).filter(
        Campaign.user_id == current_user.user_id
    ).order_by(Campaign.created_at.desc()).limit(20).all()
    return [_serialize_campaign(c) for c in campaigns]


@router.get("/active")
def get_active_campaign(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = db.query(Campaign).filter(
        Campaign.user_id == current_user.user_id,
        Campaign.status.in_(["pending", "running"]),
    ).order_by(Campaign.created_at.desc()).first()
    if not campaign:
        return None
    return _serialize_campaign(campaign)


@router.get("/{campaign_id}")
def get_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = db.query(Campaign).filter(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.user_id,
    ).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return _serialize_campaign(campaign)


@router.get("/{campaign_id}/results")
def get_campaign_results(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = db.query(Campaign).filter(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.user_id,
    ).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    results = db.query(SearchResult).filter(
        SearchResult.campaign_id == campaign_id
    ).order_by(SearchResult.result_id.asc()).all()
    return [
        {
            "result_id": r.result_id,
            "business_name": r.business_name,
            "website": r.website,
            "source": r.source,
            "campaign_status": r.campaign_status,
            "campaign_pass": r.campaign_pass,
            "relevance_decision": r.relevance_decision,
            "relevance_score": r.relevance_score,
            "confidence": r.confidence,
            "relevance_reason": r.relevance_reason,
            "verification_result": r.verification_result,
            "verification_score": r.verification_score,
            "is_saved_client": r.is_saved_client,
            "primary_email": r.email_found,
        }
        for r in results
    ]


@router.post("/{campaign_id}/resume")
async def resume_campaign(
    campaign_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = db.query(Campaign).filter(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.user_id,
    ).with_for_update().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status in ("running", "pending"):
        raise HTTPException(status_code=409, detail="Campaign is already running")
    other_active = db.query(Campaign).filter(
        Campaign.user_id == current_user.user_id,
        Campaign.status.in_(["pending", "running"]),
        Campaign.id != campaign_id,
    ).with_for_update(skip_locked=True).first()
    if other_active:
        raise HTTPException(status_code=409, detail="You already have another active campaign. Cancel it first.")
    pending_count = db.query(SearchResult).filter(
        SearchResult.campaign_id == campaign_id,
        SearchResult.campaign_status == "pending_relevance",
    ).count()
    can_drain = pending_count > 0
    can_discover = (
        (campaign.verified_count or 0) < campaign.target_count
        and (campaign.credits_used or 0) < campaign.credit_budget
    )
    if not can_drain and not can_discover:
        if (campaign.verified_count or 0) >= campaign.target_count:
            raise HTTPException(status_code=400, detail="Target already reached")
        raise HTTPException(status_code=400, detail="Credit budget exhausted")
    campaign.status = "running"
    campaign.error_message = None
    db.commit()
    background_tasks.add_task(run_campaign_resume, campaign_id)
    return _serialize_campaign(campaign)


@router.post("/{campaign_id}/cancel")
def cancel_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = db.query(Campaign).filter(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.user_id,
    ).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    campaign.status = "paused"
    campaign.error_message = None
    db.commit()
    return {"status": "paused"}


@router.post("/{campaign_id}/save-client/{result_id}")
def save_client(
    campaign_id: int,
    result_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign or campaign.user_id != current_user.user_id:
        raise HTTPException(status_code=404, detail="Campaign not found")
    result = db.query(SearchResult).filter(
        SearchResult.result_id == result_id,
        SearchResult.campaign_id == campaign_id,
    ).first()
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    result.is_saved_client = True
    db.commit()
    return {"status": "saved"}
