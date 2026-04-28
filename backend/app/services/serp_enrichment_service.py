import logging
import os
import httpx
from app.models.search_result import SearchResult

logger = logging.getLogger(__name__)


async def enrich_lead_via_serp(search_result_id: int, db) -> dict:
    """
    Enrich a SearchResult record with additional SERP data from ValueSERP API.
    Runs 3 queries to gather LinkedIn URL, product snippets, and company snippets.
    Never raises — returns {} on any failure.
    """
    try:
        result = db.query(SearchResult).filter(SearchResult.result_id == search_result_id).first()
        if not result:
            logger.error(f"SearchResult with ID {search_result_id} not found")
            return {}

        api_key = os.getenv("VALUESERP_API_KEY")
        if not api_key:
            logger.error("VALUESERP_API_KEY not found in environment")
            return {}

        query1 = f'"{result.business_name}" site:linkedin.com/company'
        query2 = f'"{result.business_name}" products wholesale catalog'
        query3 = f'"{result.business_name}" about founded headquarters'

        linkedin_url = None
        product_snippets = []
        company_snippets = []

        async with httpx.AsyncClient(timeout=15.0) as client:
            # Query 1: LinkedIn URL
            try:
                params = {
                    "api_key": api_key,
                    "q": query1,
                    "num": 10,
                    "output": "json"
                }
                response = await client.get("https://api.valueserp.com/search", params=params)
                response.raise_for_status()
                data = response.json()

                organic_results = data.get("organic_results", [])
                for item in organic_results:
                    link = item.get("link", "")
                    if "linkedin.com/company/" in link:
                        linkedin_url = link
                        break

            except Exception as e:
                logger.error(f"Failed to fetch SERP results for query '{query1}': {e}")

            # Query 2: Product snippets
            try:
                params = {
                    "api_key": api_key,
                    "q": query2,
                    "num": 10,
                    "output": "json"
                }
                response = await client.get("https://api.valueserp.com/search", params=params)
                response.raise_for_status()
                data = response.json()

                organic_results = data.get("organic_results", [])
                for item in organic_results:
                    snippet = item.get("snippet", "")
                    if snippet:
                        product_snippets.append(snippet)

            except Exception as e:
                logger.error(f"Failed to fetch SERP results for query '{query2}': {e}")

            # Query 3: Company snippets
            try:
                params = {
                    "api_key": api_key,
                    "q": query3,
                    "num": 10,
                    "output": "json"
                }
                response = await client.get("https://api.valueserp.com/search", params=params)
                response.raise_for_status()
                data = response.json()

                organic_results = data.get("organic_results", [])
                for item in organic_results:
                    snippet = item.get("snippet", "")
                    if snippet:
                        company_snippets.append(snippet)

            except Exception as e:
                logger.error(f"Failed to fetch SERP results for query '{query3}': {e}")

        enrichment = {
            "linkedin_url": linkedin_url,
            "product_snippets": product_snippets,
            "company_snippets": company_snippets,
            "raw_queries": [query1, query2, query3]
        }

        result.serp_enrichment = enrichment
        result.linkedin_url = linkedin_url

        db.commit()

        return enrichment

    except Exception as e:
        logger.error(f"Failed to enrich lead {search_result_id}: {e}")
        return {}
