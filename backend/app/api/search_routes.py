from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.db.session import get_db
from app.services.google_maps_service import search_google_maps
from app.models.user import User
from app.models.search_session import SearchSession
from app.models.search_result import SearchResult

router = APIRouter(prefix="/api/v1", tags=["search"])

class SearchRequest(BaseModel):
    user_id: int
    query: str
    page_token: Optional[str] = None

@router.get("/health")
def api_health_check():
    return {"status": "Backend API is healthy"}

@router.post("/search")
def search_endpoint(request: SearchRequest, db: Session = Depends(get_db)):
    """
    Triggers a Google Maps Search and saves results to DB.
    """
    # Quick Check: Does user exist? (For MVP testing)
    user = db.query(User).filter(User.user_id == request.user_id).first()
    if not user:
        # Create a test user with a UNIQUE email to prevent IntegrityError crashes
        user = User(
            user_id=request.user_id, 
            name=f"Test User {request.user_id}", 
            email=f"test_{request.user_id}@example.com", 
            password_hash="xxx"
        )
        db.add(user)
        db.commit()

    try:
        result = search_google_maps(
            db=db,
            user_id=request.user_id,
            query=request.query,
            page_token=request.page_token
        )
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions/{user_id}")
def get_search_sessions(user_id: int, db: Session = Depends(get_db)):
    """Fetch all search sessions for a user, ordered by most recent."""
    try:
        sessions = db.query(SearchSession).filter(
            SearchSession.user_id == user_id
        ).order_by(SearchSession.created_at.desc()).all()
        
        if not sessions:
            raise HTTPException(status_code=404, detail="No search sessions found for this user.")
            
        return sessions
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/results/{search_id}")
def get_search_results(
    search_id: int, 
    status: Optional[str] = None, 
    min_relevancy: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Fetch all scraped results linked to a search_id, with optional smart filtering."""
    try:
        query = db.query(SearchResult).filter(SearchResult.search_id == search_id)
        
        if status:
            query = query.filter(SearchResult.verification_status == status)
            
        if min_relevancy is not None:
            query = query.filter(SearchResult.relevance_score >= min_relevancy)
            
        results = query.all()
        
        # If no results found (e.g., all were deduplicated), return empty array instead of 404
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/lead/{place_id}")
def get_lead_details(place_id: str, db: Session = Depends(get_db)):
    """Fetch the full details of a single lead by place_id."""
    try:
        lead = db.query(SearchResult).filter(SearchResult.place_id == place_id).first()
        
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found.")
            
        return lead
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))