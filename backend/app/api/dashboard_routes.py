from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.models.search_result import SearchResult
from app.models.search_session import SearchSession
from pydantic import BaseModel
from typing import List, Dict, Any

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])

class DashboardStatsResponse(BaseModel):
    total_clients: int
    verified_clients: int
    unverified_clients: int
    total_searches: int
    risk_distribution: List[Dict[str, Any]]
    verification_data: List[Dict[str, Any]]

@router.get("/stats", response_model=DashboardStatsResponse)
def get_dashboard_stats(db: Session = Depends(get_db)):
    # Total globally searched sessions
    total_searches = db.query(func.count(SearchSession.search_id)).scalar() or 0

    # Base query for all saved clients
    saved_clients_query = db.query(SearchResult).filter(SearchResult.is_saved_client == True)
    total_clients = saved_clients_query.count()

    # Calculate Verification Distribution
    # Verified: is_verified == True OR verification_score > 70
    verified_clients = saved_clients_query.filter(
        (SearchResult.verification_score > 70)
    ).count()

    # Partially Verified: between 41 and 70
    partially_verified_clients = saved_clients_query.filter(
        SearchResult.verification_score > 40,
        SearchResult.verification_score <= 70
    ).count()

    # Unverified / High Risk Verification
    unverified_clients = total_clients - verified_clients - partially_verified_clients

    # Calculate Risk Distribution (using both relevance and verification scores as placeholders for risk)
    # Low Risk: score > 70
    low_risk_count = saved_clients_query.filter(
        (SearchResult.verification_score > 70) | (SearchResult.relevance_score > 70)
    ).count()

    # High Risk: score <= 40
    high_risk_count = saved_clients_query.filter(
        (SearchResult.verification_score <= 40) | (SearchResult.relevance_score <= 40)
    ).count()

    medium_risk_count = total_clients - low_risk_count - high_risk_count

    risk_distribution = [
        { "name": 'Low Risk', "value": low_risk_count, "color": '#22c55e' },
        { "name": 'Medium Risk', "value": max(0, medium_risk_count), "color": '#eab308' },
        { "name": 'High Risk', "value": high_risk_count, "color": '#ef4444' }
    ]

    verification_data = [
        { "name": 'Verified', "value": verified_clients, "color": '#22c55e' },
        { "name": 'Partially Verified', "value": partially_verified_clients, "color": '#eab308' },
        { "name": 'Not Verified', "value": max(0, unverified_clients), "color": '#ef4444' }
    ]

    return DashboardStatsResponse(
        total_clients=total_clients,
        verified_clients=verified_clients,
        unverified_clients=max(0, unverified_clients),
        total_searches=total_searches,
        risk_distribution=risk_distribution,
        verification_data=verification_data
    )
