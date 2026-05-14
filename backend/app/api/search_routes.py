import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.db.session import get_db
from app.services.google_maps_service import search_google_maps
from app.models.user import User
from app.models.search_session import SearchSession
from app.models.search_result import SearchResult
from app.models.search_context import SearchContext
from app.core.security import get_current_user
from app.services.credit_service import check_credits, deduct_credits
from app.services.activity_service import log_activity

router = APIRouter(prefix="/api/v1", tags=["search"])

class SearchRequest(BaseModel):
    user_id: int
    query: str
    page_token: Optional[str] = None
    context_id: Optional[int] = None
    session_id: Optional[int] = None
    ai_context: Optional[str] = None
    discovery_platform: Optional[str] = "both"
    skip_discovery: Optional[bool] = False

class ClientStatusUpdate(BaseModel):
    is_saved_client: bool

class GenerateQueriesRequest(BaseModel):
    session_id: int

@router.get("/health")
def api_health_check():
    return {"status": "Backend API is healthy"}

@router.post("/search")
async def search_endpoint(request: SearchRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Triggers a Google Maps Search and saves results to DB.
    """
    # Quick Check: Does user exist? (For MVP testing)
    user = db.query(User).filter(User.user_id == current_user.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    check_credits(db, current_user.user_id, 10)

    try:
        # If skip_discovery is True, create the session record only (no Maps/SERP calls)
        if request.skip_discovery:
            from app.models.search_session import SearchSession as SS
            from datetime import datetime
            new_session = SS(
                user_id=current_user.user_id,
                search_query=request.query,
                created_at=datetime.utcnow(),
                context_id=request.context_id,
                ai_context=request.ai_context,
                discovery_platform=request.discovery_platform or "both",
            )
            db.add(new_session)
            db.commit()
            db.refresh(new_session)
            result = {
                "status": "session_created",
                "search_id": new_session.search_id,
                "results_added": 0,
                "next_page_token": None,
            }
        else:
            result = search_google_maps(
                db=db,
                user_id=current_user.user_id,
                query=request.query,
                page_token=request.page_token,
                context_id=request.context_id,
                session_id=request.session_id,
                ai_context=request.ai_context,
                discovery_platform=request.discovery_platform or "both",
            )
            if "error" in result:
                raise HTTPException(status_code=400, detail=result["error"])

            session_id_used = result.get("search_id")
            if session_id_used:
                search_sess = db.query(SearchSession).filter(
                    SearchSession.search_id == session_id_used
                ).first()
                platform = (search_sess.discovery_platform or "both") if search_sess else "both"

                if search_sess and search_sess.approved_queries:
                    if platform in ("serp", "both"):
                        web_queries = search_sess.approved_queries.get("web_queries") or []
                        if web_queries:
                            from app.services.serp_discovery_service import discover_via_serp
                            serp_results = await discover_via_serp(
                                web_queries=web_queries,
                                session_id=session_id_used,
                                user_id=current_user.user_id,
                                db=db,
                            )
                            result["serp_results_added"] = len(serp_results)

        deduct_credits(db, current_user.user_id, 10, "search_session", reference_id=str(result.get("search_id")), reference_type="session")
        db.commit()
        try:
            log_activity(db, current_user.user_id, "search_created", metadata={"query": request.query}, session_id=result.get("search_id"), credits_consumed=10)
            db.commit()
        except Exception:
            pass
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions/{user_id}")
def get_search_sessions_deprecated(user_id: int, current_user: User = Depends(get_current_user)):
    raise HTTPException(status_code=410, detail="Use /sessions (JWT-authenticated, no user_id param needed)")


@router.get("/sessions")
def list_search_sessions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """List search sessions for the authenticated user, ordered by most recent."""
    try:
        from sqlalchemy import func
        sessions = (
            db.query(SearchSession)
            .filter(SearchSession.user_id == current_user.user_id)
            .order_by(SearchSession.created_at.desc())
            .all()
        )

        # Bulk-fetch all search_ids for result counts and scoring status
        search_ids = [s.search_id for s in sessions]

        # Count total results per session in one query
        counts_rows = (
            db.query(SearchResult.search_id, func.count(SearchResult.result_id))
            .filter(SearchResult.search_id.in_(search_ids))
            .group_by(SearchResult.search_id)
            .all()
        )
        counts_map = {row[0]: row[1] for row in counts_rows}

        # Count unscored results per session to derive status
        unscored_rows = (
            db.query(SearchResult.search_id, func.count(SearchResult.result_id))
            .filter(SearchResult.search_id.in_(search_ids))
            .filter(SearchResult.relevance_decision.is_(None))
            .group_by(SearchResult.search_id)
            .all()
        )
        unscored_map = {row[0]: row[1] for row in unscored_rows}

        result = []
        for session in sessions:
            results_count = counts_map.get(session.search_id, 0)
            unscored = unscored_map.get(session.search_id, 0)
            status = "scoring" if (results_count > 0 and unscored > 0) else "done"

            context_name = None
            if session.context_id:
                ctx = db.query(SearchContext).filter(SearchContext.id == session.context_id).first()
                if ctx:
                    context_name = ctx.name

            session_dict = {
                "search_id": session.search_id,
                "user_id": session.user_id,
                "search_query": session.search_query,
                "context_id": session.context_id,
                "context_name": context_name,
                "created_at": session.created_at.isoformat() if session.created_at else None,
                "results_count": results_count,
                "status": status,
                "next_page_token": session.next_page_token,
            }
            result.append(session_dict)

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/sessions/{session_id}/approved-queries")
async def update_approved_queries(
    session_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Save user-edited approved queries back to the session before triggering discovery."""
    session = db.query(SearchSession).filter(
        SearchSession.search_id == session_id,
        SearchSession.user_id == current_user.user_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.approved_queries = payload
    db.commit()
    return {"status": "updated"}


@router.post("/sessions/{session_id}/generate-queries")
async def generate_search_queries_endpoint(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate search queries for a session based on exporter profile and AI context."""
    # Fetch session and verify ownership
    session = db.query(SearchSession).filter(
        SearchSession.search_id == session_id,
        SearchSession.user_id == current_user.user_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Fetch exporter profile
    from app.models.exporter_profile import ExporterProfile
    profile = db.query(ExporterProfile).filter(
        ExporterProfile.user_id == current_user.user_id
    ).first()
    
    if not profile:
        user_profile = {}
    else:
        user_profile = {k: str(v) for k, v in profile.__dict__.items() if k != "_sa_instance_state"}.copy()
        user_profile.pop('_sa_instance_state', None)
    
    # Get AI context
    ai_context = session.ai_context or session.search_query
    
    # Generate queries
    from app.services.query_generator_service import generate_search_queries
    suggestions = await generate_search_queries(user_profile=user_profile, ai_context=ai_context, search_intent=session.search_query or "")
    
    # Save to session
    session.approved_queries = suggestions
    db.commit()
    
    return suggestions


@router.get("/results/{search_id}")
def get_search_results(
    search_id: int, 
    status: Optional[str] = None, 
    min_relevancy: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fetch all scraped results linked to a search_id, with optional smart filtering."""
    try:
        # Ownership guard — ensures the session belongs to the current user before
        # returning any rows; prevents cross-user data leakage via direct search_id access.
        session = db.query(SearchSession).filter(
            SearchSession.search_id == search_id,
            SearchSession.user_id == current_user.user_id
        ).first()
        if not session:
            raise HTTPException(status_code=403, detail="Access denied.")

        query = db.query(SearchResult).filter(SearchResult.search_id == search_id)
        
        if status:
            query = query.filter(SearchResult.verification_status == status)
            
        if min_relevancy is not None:
            query = query.filter(SearchResult.relevance_score >= min_relevancy)
            
        results = query.all()

        context_name = session.context.name if session.context else None
        context_prompt = session.context.prompt_text if session.context else None
        
        # Attach context to each result transiently for frontend
        for result_item in results:
            result_item.context_name = context_name
            result_item.context_prompt = context_prompt
            
        # If no results found (e.g., all were deduplicated), return empty array instead of 404
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/lead/{place_id}")
def get_lead_details(place_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Fetch the full details of a single lead by place_id."""
    try:
        lead = db.query(SearchResult).join(SearchSession, SearchResult.search_id == SearchSession.search_id).filter(SearchResult.place_id == place_id).filter(SearchSession.user_id == current_user.user_id).first()
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        return lead
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/results/{result_id}/client-status")
def update_client_status(
    result_id: str,
    payload: ClientStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Toggle the is_saved_client status for a specific lead."""
    try:
        # result_id might be the place_id or actual integer ID depending on frontend passing, so we check both
        # Actually frontend usually passes result.id, result.result_id, or result.place_id as cardId. 
        # So let's check place_id primarily or result_id if it's digit.
        if result_id.isdigit():
            lead = db.query(SearchResult).join(SearchSession, SearchResult.search_id == SearchSession.search_id).filter(
                (SearchResult.result_id == int(result_id)) | (SearchResult.place_id == result_id)
            ).filter(SearchSession.user_id == current_user.user_id).first()
        else:
            lead = db.query(SearchResult).join(SearchSession, SearchResult.search_id == SearchSession.search_id).filter(SearchResult.place_id == result_id).filter(SearchSession.user_id == current_user.user_id).first()
            
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found.")

        lead.is_saved_client = payload.is_saved_client
        db.commit()
        db.refresh(lead)
        return {"status": "success", "is_saved_client": lead.is_saved_client}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/clients")
def get_saved_clients(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Fetch all saved clients (is_saved_client == True) from the database."""
    try:
        clients = db.query(SearchResult).join(SearchSession, SearchResult.search_id == SearchSession.search_id).filter(SearchResult.is_saved_client == True).filter(SearchSession.user_id == current_user.user_id).all()
        return clients
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/clients")
def delete_clients(
    result_ids: list[int],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Set is_saved_client=False for specified client result IDs."""
    try:
        updated_count = 0
        for result_id in result_ids:
            lead = db.query(SearchResult).join(SearchSession, SearchResult.search_id == SearchSession.search_id).filter(
                SearchResult.result_id == result_id
            ).filter(SearchSession.user_id == current_user.user_id).first()
            
            if lead:
                lead.is_saved_client = False
                updated_count += 1
        
        db.commit()
        return {"status": "success", "updated_count": updated_count}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/leads/{search_result_id}/find-email")
async def find_email_for_lead(
    search_result_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.hunter_service import find_emails_for_domain

    lead = (
        db.query(SearchResult)
        .join(SearchSession, SearchResult.search_id == SearchSession.search_id)
        .filter(
            SearchResult.result_id == search_result_id,
            SearchSession.user_id == current_user.user_id,
        )
        .first()
    )
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    if lead.hunter_emails is not None:
        return {
            "cached": True,
            "emails": lead.hunter_emails,
            "primary_contact_email": lead.primary_contact_email,
        }

    website = lead.website or ""
    domain_match = re.search(r"(?:https?://)?(?:www\.)?([^/\s]+)", website)
    if not domain_match:
        raise HTTPException(
            status_code=400,
            detail="This lead has no website URL to extract a domain from",
        )
    domain = domain_match.group(1)

    check_credits(db, current_user.user_id, 1)

    try:
        emails = await find_emails_for_domain(domain)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=f"Hunter.io lookup failed: {exc}")
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Hunter.io lookup failed: {exc}")

    lead.hunter_emails = emails
    lead.primary_contact_email = emails[0]["email"] if emails else None

    deduct_credits(
        db,
        current_user.user_id,
        1,
        "hunter_lookup",
        reference_id=str(search_result_id),
        reference_type="search_result",
    )

    db.commit()

    return {
        "cached": False,
        "emails": lead.hunter_emails,
        "primary_contact_email": lead.primary_contact_email,
        "message": (
            f"Found {len(emails)} verified contact email(s)"
            if emails
            else "No emails above confidence threshold were found for this domain. 1 credit was used."
        ),
    }
