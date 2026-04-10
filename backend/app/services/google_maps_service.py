import os
import requests
import time
import logging
from sqlalchemy.orm import Session
from app.models.search_session import SearchSession
from app.models.search_result import SearchResult
from datetime import datetime

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

def search_google_maps(db: Session, user_id: int, query: str, page_token: str = None, context_id: int = None, session_id: int = None):
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
        ).first()
        if not search_session:
            return {"error": f"Session {session_id} not found"}
    else:
        search_session = SearchSession(
            user_id=user_id,
            search_query=query,
            created_at=datetime.utcnow(),
            next_page_token=page_token,
            context_id=context_id
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

    try:
        response = requests.get(PLACES_TEXT_SEARCH_URL, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        api_status = data.get("status")
        if api_status and api_status not in ["OK", "ZERO_RESULTS"]:
            error_msg = data.get("error_message", "No details")
            logger.error(f"Google Maps API failed: {api_status} - {error_msg}")
            return {"error": f"Google Maps API failed: {api_status} - {error_msg}"}
            
    except Exception as e:
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

            # 🛑 Deduplication
            exists = db.query(SearchResult).filter(SearchResult.place_id == place_id).first()
            if exists:
                # Associate existing lead with current search session so it appears
                exists.search_id = search_session.search_id
                results_added += 1
                continue

            # 🚀 THE NEW PART: Fetch Details Immediately
            # We explicitly call the details API now.
            details = get_place_details(place_id)
            
            # ✅ Insert new SearchResult with Website & Phone
            search_result = SearchResult(
                place_id=place_id,
                user_id=user_id,
                search_id=search_session.search_id,
                raw_data=item, 
                business_name=item.get("name"),
                address=item.get("formatted_address"),
                
                # Now we have them!
                website=details["website"],
                phone_number=details["phone"],
                
                scraping_status="pending",
                relevance_status="pending",
                verification_status="pending",
                created_at=datetime.utcnow()
            )
            db.add(search_result)
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