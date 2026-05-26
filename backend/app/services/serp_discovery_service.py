import asyncio
import logging
import os
from datetime import datetime
from urllib.parse import urlparse
import httpx
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.models.search_result import SearchResult

logger = logging.getLogger(__name__)

BLOCKED_DOMAINS = {
    # Social media
    "facebook.com", "instagram.com", "twitter.com", "x.com", "linkedin.com",
    "youtube.com", "tiktok.com", "pinterest.com", "snapchat.com",
    # Reference/community
    "wikipedia.org", "reddit.com", "quora.com", "medium.com",
    # Marketplaces
    "amazon.com", "amazon.com.au", "amazon.co.uk", "ebay.com", "etsy.com",
    "alibaba.com", "aliexpress.com", "asos.com", "shein.com", "wish.com",
    "depop.com", "poshmark.com", "thredup.com", "vinted.com",
    # Directories & review sites
    "yelp.com", "trustpilot.com", "glassdoor.com", "tripadvisor.com",
    "yellowpages.com", "bbb.org", "manta.com", "chamberofcommerce.com",
    # News & media
    "bloomberg.com", "reuters.com", "forbes.com", "bbc.com",
    "vogue.com", "elle.com", "harpersbazaar.com", "gq.com",
    "businessinsider.com", "techcrunch.com", "wwd.com", "fashionista.com",
    "whowhatwear.com", "refinery29.com", "byrdie.com", "popsugar.com",
    # Search & tech
    "google.com", "google.com.au", "maps.google.com", "bing.com",
    "yahoo.com", "apple.com", "shopify.com", "wordpress.com", "wix.com",
    # Fashion aggregators & directories
    "stylight.com", "lyst.com", "farfetch.com", "net-a-porter.com",
    "matchesfashion.com", "ssense.com", "revolve.com", "nordstrom.com",
    "macys.com", "bloomingdales.com", "zappos.com",
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
                    "num": 30,
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
            website = f"https://{domain}"
            stmt = (
                pg_insert(SearchResult)
                .values(
                    place_id=None,
                    source="serp",
                    user_id=user_id,
                    search_id=session_id,
                    raw_data={"domain": domain, "query": query, "source": "valueserp"},
                    business_name=domain,
                    website=website,
                    scraping_status="pending",
                    relevance_status="pending",
                    verification_status="pending",
                )
                .on_conflict_do_nothing(
                    constraint="uq_search_results_search_id_website",
                )
                .returning(SearchResult.result_id)
            )
            result = db.execute(stmt)
            row = result.fetchone()
            if row:
                inserted = (
                    db.query(SearchResult)
                    .filter(SearchResult.result_id == row[0])
                    .first()
                )
                if inserted:
                    created_records.append(inserted)

        db.commit()
        logger.info(f"Created {len(created_records)} new SERP-based SearchResult records")

    except Exception as e:
        db.rollback()
        logger.error(f"Database error while saving SERP results: {e}")
        return []

    return created_records
