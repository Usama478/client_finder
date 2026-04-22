from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.models.search_result import SearchResult
from app.models.search_session import SearchSession
from app.models.email_draft import EmailDraft
from app.models.user import User
from app.models.user_credit import UserCredit
from app.core.security import get_current_user
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
    leads_found: int
    relevant_leads: int
    emails_sent: int

@router.get("/stats", response_model=DashboardStatsResponse)
def get_dashboard_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Total globally searched sessions
    total_searches = db.query(func.count(SearchSession.search_id)).filter(SearchSession.user_id == current_user.user_id).scalar() or 0

    # Base query for all saved clients
    saved_clients_query = db.query(SearchResult).join(SearchSession, SearchResult.search_id == SearchSession.search_id).filter(SearchResult.is_saved_client == True).filter(SearchSession.user_id == current_user.user_id)
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

    # New KPI fields
    leads_found = db.query(func.count(SearchResult.result_id)).join(SearchSession, SearchResult.search_id == SearchSession.search_id).filter(SearchSession.user_id == current_user.user_id).scalar() or 0
    relevant_leads = db.query(SearchResult).join(SearchSession, SearchResult.search_id == SearchSession.search_id).filter(
        SearchResult.relevance_decision == 'relevant'
    ).filter(SearchSession.user_id == current_user.user_id).count()
    emails_sent = db.query(EmailDraft).join(SearchResult, EmailDraft.business_id == SearchResult.result_id).join(SearchSession, SearchResult.search_id == SearchSession.search_id).filter(
        EmailDraft.status == 'sent'
    ).filter(SearchSession.user_id == current_user.user_id).count()

    return DashboardStatsResponse(
        total_clients=total_clients,
        verified_clients=verified_clients,
        unverified_clients=max(0, unverified_clients),
        total_searches=total_searches,
        risk_distribution=risk_distribution,
        verification_data=verification_data,
        leads_found=leads_found,
        relevant_leads=relevant_leads,
        emails_sent=emails_sent
    )

@router.get("/activity")
def get_activity(limit: int = 50, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    events = []
    sessions = db.query(SearchSession).filter(SearchSession.user_id == current_user.user_id).order_by(
        SearchSession.created_at.desc()).limit(15).all()
    for s in sessions:
        events.append({
            "type": "search",
            "text": f"Search started — \"{s.search_query or 'Search'}\"",
            "time": s.created_at.isoformat() if s.created_at else "",
            "color": "#3b82f6",
        })
    verified = db.query(SearchResult).join(SearchSession, SearchResult.search_id == SearchSession.search_id).filter(
        SearchResult.verification_result.in_(["verified", "partial"])
    ).filter(SearchSession.user_id == current_user.user_id).order_by(SearchResult.created_at.desc()).limit(15).all()
    for r in verified:
        events.append({
            "type": "verification",
            "text": f"Verification complete — {r.business_name}",
            "time": r.created_at.isoformat() if r.created_at else "",
            "color": "#10b981",
        })
    relevant = db.query(SearchResult).join(SearchSession, SearchResult.search_id == SearchSession.search_id).filter(
        SearchResult.relevance_decision == "relevant"
    ).filter(SearchSession.user_id == current_user.user_id).order_by(SearchResult.created_at.desc()).limit(15).all()
    for r in relevant:
        events.append({
            "type": "relevance",
            "text": f"AI relevance scored — {r.business_name}",
            "time": r.created_at.isoformat() if r.created_at else "",
            "color": "#8b5cf6",
        })
    sent_drafts = db.query(EmailDraft).join(SearchResult, EmailDraft.business_id == SearchResult.result_id).join(SearchSession, SearchResult.search_id == SearchSession.search_id).filter(
        EmailDraft.status == "sent"
    ).filter(SearchSession.user_id == current_user.user_id).order_by(EmailDraft.sent_at.desc()).limit(10).all()
    for d in sent_drafts:
        lead = db.query(SearchResult).filter(
            SearchResult.result_id == d.business_id).first()
        events.append({
            "type": "email",
            "text": f"Email sent to {lead.business_name if lead else 'lead'}",
            "time": d.sent_at.isoformat() if d.sent_at else "",
            "color": "#10b981",
        })
    events.sort(key=lambda x: x["time"] or "", reverse=True)
    return events[:limit]

@router.get("/result/{result_id}")
def get_result_detail(result_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lead = db.query(SearchResult).join(SearchSession, SearchResult.search_id == SearchSession.search_id).filter(
        SearchResult.result_id == result_id).filter(SearchSession.user_id == current_user.user_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    from app.models.search_context import SearchContext
    session_row = db.query(SearchSession).filter(SearchSession.search_id == lead.search_id).first()
    context_name = None
    if session_row and session_row.context_id:
        ctx = db.query(SearchContext).filter(SearchContext.id == session_row.context_id).first()
        if ctx:
            context_name = ctx.name
    drafts = db.query(EmailDraft).filter(
        EmailDraft.business_id == result_id
    ).order_by(EmailDraft.created_at.desc()).all()
    return {
        "result_id": lead.result_id,
        "place_id": lead.place_id,
        "business_name": lead.business_name,
        "address": lead.address,
        "website": lead.website,
        "phone_number": lead.phone_number,
        "business_type": lead.business_type,
        "primary_niche": lead.primary_niche,
        "relevance_decision": lead.relevance_decision,
        "relevance_score": lead.relevance_score,
        "relevance_reason": lead.relevance_reason,
        "relevance_status": lead.relevance_status,
        "confidence": lead.confidence,
        "match_reasons": lead.match_reasons or [],
        "mismatch_reasons": lead.mismatch_reasons or [],
        "verification_result": lead.verification_result,
        "verification_score": lead.verification_score,
        "verification_reason": lead.verification_reason,
        "verification_status": lead.verification_status,
        "risk_flags": lead.risk_flags or [],
        "email_found": lead.email_found,
        "email_type": lead.email_type,
        "all_emails_found": lead.all_emails_found or [],
        "all_phones_found": lead.all_phones_found or [],
        "whatsapp_number": lead.whatsapp_number,
        "linkedin_company_url": lead.linkedin_company_url,
        "social_links": lead.social_links or {},
        "contact_form_present": lead.contact_form_present,
        "has_about_page": lead.has_about_page,
        "has_contact_page": lead.has_contact_page,
        "has_policy_pages": lead.has_policy_pages,
        "wholesale_page_found": lead.wholesale_page_found,
        "wholesale_page_url": lead.wholesale_page_url,
        "legitimacy_score": lead.legitimacy_score,
        "domain_age_years": lead.domain_age_years,
        "company_name_confirmed": lead.company_name_confirmed,
        "country_confirmed": lead.country_confirmed,
        "domain_match_confidence": lead.domain_match_confidence,
        "employee_range": lead.employee_range,
        "revenue_band": lead.revenue_band,
        "verification_artifacts": lead.verification_artifacts or {},
        "email_context": lead.email_context or {},
        "is_saved_client": lead.is_saved_client,
        "created_at": lead.created_at.isoformat() if lead.created_at else None,
        "context_name": context_name,
        "email_drafts": [
            {
                "id": d.id,
                "sequence_position": d.sequence_position,
                "subject": d.subject,
                "body": d.body,
                "status": d.status,
                "sent_at": d.sent_at.isoformat() if d.sent_at else None,
                "opened_at": d.opened_at.isoformat() if d.opened_at else None,
                "clicked_at": d.clicked_at.isoformat() if d.clicked_at else None,
            }
            for d in drafts
        ]
    }

@router.get("/credits")
def get_credits(db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    credit = db.query(UserCredit).filter(
        UserCredit.user_id == current_user.user_id).first()
    if not credit:
        return {
            "credits_remaining": 0,
            "allocated_total": 0,
            "low_credits": True,
            "empty": True,
        }
    return {
        "credits_remaining": credit.credits_remaining,
        "allocated_total": credit.allocated_total,
        "low_credits": credit.credits_remaining < 20,
        "empty": credit.credits_remaining <= 0,
    }
