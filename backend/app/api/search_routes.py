from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.db.session import get_db
from app.services.google_maps_service import search_google_maps
from app.models.user import User

router = APIRouter(prefix="/api/v1", tags=["search"])

class SearchRequest(BaseModel):
    user_id: int
    query: str
    page_token: Optional[str] = None

@router.post("/search")
def search_endpoint(request: SearchRequest, db: Session = Depends(get_db)):
    """
    Triggers a Google Maps Search and saves results to DB.
    """
    # Quick Check: Does user exist? (For MVP testing)
    user = db.query(User).filter(User.user_id == request.user_id).first()
    if not user:
        # Create a test user if missing so you don't get Foreign Key errors
        user = User(user_id=request.user_id, name="Test User", email="test@example.com", password_hash="xxx")
        db.add(user)
        db.commit()

    try:
        result = search_google_maps(
            db=db,
            user_id=request.user_id,
            query=request.query,
            page_token=request.page_token
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))