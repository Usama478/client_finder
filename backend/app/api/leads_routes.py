import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.search_result import SearchResult
from app.models.search_session import SearchSession
from app.models.user import User

router = APIRouter(tags=["leads"])

PAGE_SIZE = 40

VALID_FILTERS = {
    "all",
    "pending_relevancy",
    "relevant",
    "irrelevant",
    "low_confidence",
    "pending_verification",
    "verified",
    "failed_verification",
    "has_email",
    "no_email",
}


def _apply_filter(query, filter_name: str):
    if filter_name == "pending_relevancy":
        return query.filter(SearchResult.relevance_decision.is_(None))
    if filter_name == "relevant":
        return query.filter(SearchResult.relevance_decision == "relevant")
    if filter_name == "irrelevant":
        return query.filter(SearchResult.relevance_decision == "irrelevant")
    if filter_name == "low_confidence":
        return query.filter(SearchResult.relevance_decision == "low_confidence")
    if filter_name == "pending_verification":
        return query.filter(
            SearchResult.relevance_decision == "relevant",
            SearchResult.verification_score.is_(None),
        )
    if filter_name == "verified":
        return query.filter(SearchResult.verification_score >= 50)
    if filter_name == "failed_verification":
        return query.filter(
            SearchResult.verification_score.isnot(None),
            SearchResult.verification_score < 50,
        )
    if filter_name == "has_email":
        return query.filter(SearchResult.primary_contact_email.isnot(None))
    if filter_name == "no_email":
        return query.filter(SearchResult.primary_contact_email.is_(None))
    return query


def _serialize_lead(row: SearchResult) -> dict:
    return {
        "id": row.result_id,
        "search_id": row.search_id,
        "name": row.business_name,
        "website": row.website,
        "source": row.source or "maps",
        "relevance_decision": row.relevance_decision,
        "relevance_score": row.relevance_score,
        "relevance_reason": row.relevance_reason,
        "verification_score": row.verification_score,
        "verified_product_catalog": row.verified_product_catalog,
        "primary_contact_email": row.primary_contact_email,
        "campaign_status": row.campaign_status,
        "is_saved_client": bool(row.is_saved_client),
    }


@router.get("")
def get_leads(
    filter: str = Query("all", alias="filter"),
    source: Optional[str] = Query(None),
    session_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Unified paginated list of all leads for the authenticated user."""
    if filter not in VALID_FILTERS:
        raise HTTPException(status_code=400, detail=f"Invalid filter: {filter}")

    if source is not None and source not in ("maps", "serp", "both"):
        raise HTTPException(status_code=400, detail="source must be maps, serp, or both")

    query = (
        db.query(SearchResult)
        .join(SearchSession, SearchResult.search_id == SearchSession.search_id)
        .filter(SearchSession.user_id == current_user.user_id)
    )

    if session_id is not None:
        session = (
            db.query(SearchSession)
            .filter(
                SearchSession.search_id == session_id,
                SearchSession.user_id == current_user.user_id,
            )
            .first()
        )
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        query = query.filter(SearchResult.search_id == session_id)

    if source and source != "both":
        query = query.filter(SearchResult.source == source)

    query = _apply_filter(query, filter)

    total = query.count()
    total_pages = max(1, math.ceil(total / PAGE_SIZE)) if total > 0 else 1
    if page > total_pages and total > 0:
        page = total_pages

    offset = (page - 1) * PAGE_SIZE
    rows = (
        query.order_by(SearchResult.created_at.desc(), SearchResult.result_id.desc())
        .offset(offset)
        .limit(PAGE_SIZE)
        .all()
    )

    return {
        "leads": [_serialize_lead(row) for row in rows],
        "total": total,
        "page": page,
        "total_pages": total_pages if total > 0 else 1,
    }
