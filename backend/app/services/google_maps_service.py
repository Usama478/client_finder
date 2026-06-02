import os
import requests
import time
import logging
from datetime import datetime

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.models.search_session import SearchSession
from app.models.search_result import SearchResult

logger = logging.getLogger(__name__)

# Get Key from .env
GOOGLE_MAPS_API_KEY = os.getenv("MAPS_API_KEY")
PLACES_TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
PLACES_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"

def get_place_details(place_id: str):
    """
    Fetches the Website and Phone Number for a specific Place ID.
    Costs extra API credits, but ensures we have the 'ultimate source'.
    """
    params = {
        "place_id": place_id,
        "fields": "name,formatted_phone_number,website,url,international_phone_number",
        "key": GOOGLE_MAPS_API_KEY
    }
    try:
        response = requests.get(PLACES_DETAILS_URL, params=params, timeout=10)
        if response.status_code == 200:
            result = response.json().get("result", {})
            return {
                "website": result.get("website"),
                "phone": result.get("formatted_phone_number") or result.get("international_phone_number"),
                "url": result.get("url") # Google Maps Link
            }
        else:
            logger.warning(f"⚠️ Failed to fetch details for {place_id}: HTTP {response.status_code}")
    except Exception as e:
        logger.warning(f"⚠️ Failed to fetch details for {place_id}: {e}")
    
    return {"website": None, "phone": None, "url": None}


def _search_result_insert_values(search_result: SearchResult) -> dict:
    """Build a PostgreSQL INSERT payload from a SearchResult instance."""
    return {
        column.key: getattr(search_result, column.key)
        for column in SearchResult.__table__.columns
        if column.key != "result_id"
    }


def search_google_maps(db: Session, user_id: int, query: str, page_token: str = None, context_id: int = None, session_id: int = None, ai_context: str = None, discovery_platform: str = "both"):
    """
    1. Search Text API (Get List)
    2. For EACH result -> Call Details API (Get Website/Phone)
    3. Save to DB
    """
    
    # 1. Check for API Key
    if not GOOGLE_MAPS_API_KEY:
        return {"error": "Server configuration error (Missing API Key)"}

    if session_id:
        search_session = db.query(SearchSession).filter(
            SearchSession.search_id == session_id
        ).filter(
            SearchSession.user_id == user_id
        ).first()
        if not search_session:
            raise ValueError("Session not found")
    else:
        search_session = SearchSession(
            user_id=user_id,
            search_query=query,
            created_at=datetime.utcnow(),
            next_page_token=page_token,
            context_id=context_id,
            ai_context=ai_context,
            discovery_platform=discovery_platform or "both",
        )
        try:
            db.add(search_session)
            db.commit()
            db.refresh(search_session)
        except Exception as e:
            db.rollback()
            logger.error(f"Database error while saving search session: {e}")
            return {"error": f"Database transaction failed: {e}"}

    # 3. Prepare API request
    params = {
        "query": query,
        "key": GOOGLE_MAPS_API_KEY
    }
    if page_token:
        params["pagetoken"] = page_token

    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = requests.get(PLACES_TEXT_SEARCH_URL, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            api_status = data.get("status")
            if api_status and api_status not in ["OK", "ZERO_RESULTS"]:
                error_msg = data.get("error_message", "No details")
                logger.error(f"Google Maps API failed: {api_status} - {error_msg}")
                return {"error": f"Google Maps API failed: {api_status} - {error_msg}"}
            break
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
            else:
                logger.error(f"Failed to contact Google Maps: {str(e)}")
                return {"error": f"Failed to contact Google Maps: {str(e)}"}

    # 4. Save next_page_token
    search_session.next_page_token = data.get("next_page_token")
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Database error while updating next_page_token: {e}")
        return {"error": f"Database transaction failed: {e}"}

    # 5. Process results
    results_added = 0
    total_found = len(data.get("results", []))

    try:
        for item in data.get("results", []):
            place_id = item.get("place_id")
            if not place_id:
                continue

            # 🛑 Deduplication per user+place_id
            exists = db.query(SearchResult).filter(
                SearchResult.place_id == place_id,
                SearchResult.user_id == user_id
            ).first()
            if exists:
                continue

            # Check if another user already scraped this place
            other_user_lead = db.query(SearchResult).filter(
                SearchResult.place_id == place_id,
                SearchResult.scraping_status == "completed"
            ).first()

            # Fetch details
            details = get_place_details(place_id)

            # Create new row for current user
            search_result = SearchResult(
                place_id=place_id,
                source="maps",
                user_id=user_id,
                search_id=search_session.search_id,
                raw_data=item,
                business_name=item.get("name"),
                address=item.get("formatted_address"),
                website=details["website"],
                phone_number=details["phone"],
                scraping_status="pending",
                relevance_status="pending",
                verification_status="pending",
                created_at=datetime.utcnow(),
            )

            # Copy scraped and verification data if available from another user
            if other_user_lead:
                search_result.scraping_status = other_user_lead.scraping_status
                search_result.scraped_text_content = other_user_lead.scraped_text_content
                search_result.verification_status = other_user_lead.verification_status
                search_result.verification_result = other_user_lead.verification_result
                search_result.verification_reason = other_user_lead.verification_reason
                search_result.verification_score = other_user_lead.verification_score
                search_result.verification_confidence = other_user_lead.verification_confidence
                search_result.risk_flags = other_user_lead.risk_flags
                search_result.manual_review = other_user_lead.manual_review
                search_result.verification_artifacts = other_user_lead.verification_artifacts
                search_result.company_name_confirmed = other_user_lead.company_name_confirmed
                search_result.domain_match_confidence = other_user_lead.domain_match_confidence
                search_result.country_confirmed = other_user_lead.country_confirmed
                search_result.contactability_score = other_user_lead.contactability_score
                search_result.email_type = other_user_lead.email_type
                search_result.all_emails_found = other_user_lead.all_emails_found
                search_result.all_phones_found = other_user_lead.all_phones_found
                search_result.whatsapp_number = other_user_lead.whatsapp_number
                search_result.linkedin_company_url = other_user_lead.linkedin_company_url
                search_result.social_links = other_user_lead.social_links
                search_result.contact_form_present = other_user_lead.contact_form_present
                search_result.wholesale_page_found = other_user_lead.wholesale_page_found
                search_result.wholesale_page_url = other_user_lead.wholesale_page_url
                search_result.has_about_page = other_user_lead.has_about_page
                search_result.has_contact_page = other_user_lead.has_contact_page
                search_result.has_policy_pages = other_user_lead.has_policy_pages
                search_result.legitimacy_score = other_user_lead.legitimacy_score
                search_result.domain_age_years = other_user_lead.domain_age_years
                search_result.employee_range = other_user_lead.employee_range
                search_result.revenue_band = other_user_lead.revenue_band
                search_result.email_context = other_user_lead.email_context
                search_result.relevancy_artifacts = other_user_lead.relevancy_artifacts
                # Never copy relevance fields - they are user+context specific

            stmt = (
                pg_insert(SearchResult)
                .values(**_search_result_insert_values(search_result))
                .on_conflict_do_nothing(
                    constraint="uq_search_results_search_id_website",
                )
                .returning(SearchResult.result_id)
            )
            row = db.execute(stmt).fetchone()
            if row:
                results_added += 1

        db.commit()
        search_session.result_count = db.query(SearchResult).filter(
            SearchResult.search_id == search_session.search_id
        ).count()
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Database error while saving search results: {e}")
        return {"error": f"Database transaction failed: {e}"}

    return {
        "status": "success",
        "results_added": results_added,
        "total_found": total_found,
        "search_id": search_session.search_id,
        "next_page_token": search_session.next_page_token
    }