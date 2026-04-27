import asyncio
import logging
import os
from datetime import datetime
from urllib.parse import urlparse
import httpx
from app.models.search_result import SearchResult

logger = logging.getLogger(__name__)

BLOCKED_DOMAINS = {
    "facebook.com", "instagram.com", "twitter.com", "linkedin.com",
    "youtube.com", "tiktok.com", "pinterest.com",
    "wikipedia.org", "reddit.com",
    "amazon.com", "amazon.com.au", "ebay.com", "etsy.com",
    "alibaba.com", "aliexpress.com",
    "yelp.com", "trustpilot.com", "glassdoor.com",
    "bloomberg.com", "reuters.com", "forbes.com", "bbc.com",
}


def extract_domain(url: str) -> str:
    """Extract domain from URL and strip www. prefix if present."""
    try:
        domain = urlparse(url).netloc
        if domain.startswith("www."):
            domain = domain[4:]
        return domain
    except Exception:
        return ""


def is_blocked(domain: str) -> bool:
    """Check if domain matches blocklist (exact match or suffix match)."""
    if domain in BLOCKED_DOMAINS:
        return True
    for blocked in BLOCKED_DOMAINS:
        if domain.endswith(f".{blocked}"):
            return True
    return False


async def discover_via_serp(web_queries: list[str], session_id: int, user_id: int, db) -> list:
    """
    Call ValueSERP API for each query, extract domains, deduplicate,
    and create SearchResult records in the database.
    """
    api_key = os.getenv("VALUESERP_API_KEY")
    if not api_key:
        logger.warning("VALUESERP_API_KEY not found in environment, skipping SERP discovery")
        return []

    domain_to_query = {}

    async with httpx.AsyncClient(timeout=15.0) as client:
        for query in web_queries:
            try:
                params = {
                    "api_key": api_key,
                    "q": query,
                    "num": 10,
                    "output": "json"
                }
                response = await client.get("https://api.valueserp.com/search", params=params)
                response.raise_for_status()
                data = response.json()

                organic_results = data.get("organic_results", [])
                for result in organic_results:
                    link = result.get("link", "")
                    if not link:
                        continue

                    domain = extract_domain(link)
                    if not domain or is_blocked(domain):
                        continue

                    if domain not in domain_to_query:
                        domain_to_query[domain] = query

            except Exception as e:
                logger.error(f"Failed to fetch SERP results for query '{query}': {e}")
                continue

    if not domain_to_query:
        logger.info("No valid domains found from SERP queries")
        return []

    created_records = []

    try:
        for domain, query in domain_to_query.items():
            existing = db.query(SearchResult).filter(
                SearchResult.search_id == session_id,
                SearchResult.website.ilike(f"%{domain}%")
            ).first()

            if existing:
                continue

            search_result = SearchResult(
                place_id=None,
                source="serp",
                user_id=user_id,
                search_id=session_id,
                raw_data={"domain": domain, "query": query, "source": "valueserp"},
                business_name=domain,
                website=f"https://{domain}",
                scraping_status="pending",
                relevance_status="pending",
                verification_status="pending",
            )
            db.add(search_result)
            created_records.append(search_result)

        db.commit()
        logger.info(f"Created {len(created_records)} new SERP-based SearchResult records")

    except Exception as e:
        db.rollback()
        logger.error(f"Database error while saving SERP results: {e}")
        return []

    return created_records
