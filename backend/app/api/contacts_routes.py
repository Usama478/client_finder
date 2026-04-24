from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.search_result import SearchResult
from app.api.auth_routes import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/v1/contacts", tags=["contacts"])

@router.get("")
def get_contacts(current_user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    leads = db.query(SearchResult).filter(
        SearchResult.user_id == current_user.user_id,
        SearchResult.is_saved_client == True,
        SearchResult.email_found.isnot(None)
    ).order_by(SearchResult.created_at.desc()).all()
    return [
        {
            "result_id": l.result_id,
            "business_name": l.business_name,
            "email": l.email_found,
            "email_type": l.email_type,
            "phone": (l.all_phones_found or [None])[0],
            "website": l.website,
            "location": l.address,
            "verification_result": l.verification_result,
            "linkedin": l.linkedin_company_url,
            "whatsapp": l.whatsapp_number,
            "social_links": l.social_links or {},
        }
        for l in leads
    ]
