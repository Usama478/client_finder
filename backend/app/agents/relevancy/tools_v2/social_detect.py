from __future__ import annotations

from typing import Dict
from urllib.parse import urlparse

from app.agents.relevancy.state import RelevancyAgentState

SOCIAL_DOMAINS = {
    "facebook.",
    "instagram.",
    "linkedin.",
    "twitter.",
    "x.",
    "tiktok.",
    "youtube.",
    "pinterest.",
    "reddit.",
    "snapchat.",
    "threads.",
}

def social_profile_filter(state: RelevancyAgentState) -> Dict[str, object]:
    """Deterministically checks if the URL is a social media profile."""
    raw_url = (state.get("website") or "").lower()
    if not raw_url:
        return {"is_social_profile": False}

    # Add scheme if missing so urlparse works correctly
    if not raw_url.startswith("http"):
        raw_url = f"https://{raw_url}"
        
    domain = urlparse(raw_url).netloc.lower()
    
    # Check if the domain matches any known social domains
    is_social_profile = any(token in domain for token in SOCIAL_DOMAINS)
    
    return {"is_social_profile": is_social_profile}
