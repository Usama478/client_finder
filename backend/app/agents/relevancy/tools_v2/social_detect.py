from __future__ import annotations

from typing import Dict
from urllib.parse import urlparse

from app.agents.relevancy.state import RelevancyAgentState

SOCIAL_DOMAINS = {
    "facebook.com",
    "instagram.com",
    "linkedin.com",
    "twitter.com",
    "x.com",
    "tiktok.com",
    "youtube.com",
    "pinterest.com",
    "reddit.com",
    "snapchat.com",
    "threads.net",
    "yelp.com",
    "yellowpages.com",
    "tripadvisor.com",
    "etsy.com",
    "amazon.com",
    "linktr.ee",
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
    
    # Clean 'www.' to make matching easier
    if domain.startswith("www."):
        domain = domain[4:]
    
    # Check if domain matches exactly OR is a subdomain (like m.facebook.com)
    is_social_profile = any(
        domain == social_domain or domain.endswith(f".{social_domain}")
        for social_domain in SOCIAL_DOMAINS
    )
    
    return {"is_social_profile": is_social_profile}