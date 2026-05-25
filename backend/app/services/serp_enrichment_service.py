import logging
import os
import httpx
from openai import OpenAI
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

        # Extract bare domain from website for query anchoring
        raw_website = (result.website or "").strip().rstrip("/")
        raw_website = raw_website.replace("https://", "").replace("http://", "").replace("www.", "")
        domain = raw_website.split("/")[0]  # e.g. "v4newyork.com"

        query1 = f'"{result.business_name}" site:linkedin.com/company'
        if domain:
            query2 = f'"{result.business_name}" {domain} brands collection shop'
            query3 = f'"{result.business_name}" {domain} about founded'
        else:
            query2 = f'"{result.business_name}" brands carried collection shop'
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
                JUNK_DOMAINS = {
                    "archive.org", "scribd.com", "loc.gov", "wikipedia.org",
                    "wikimedia.org", "geocaching.com", "newspapers.com",
                    "ancestry.com", "jstor.org", "researchgate.net",
                    "academia.edu", "reddit.com", "quora.com", "yelp.com",
                    "yellowpages.com", "manta.com", "dnb.com", "bbb.org",
                }
                import re as _re
                DATE_PREFIX = _re.compile(r'^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}\s+—')

                for item in organic_results:
                    item_domain = item.get("domain", "") or ""
                    if any(jd in item_domain for jd in JUNK_DOMAINS):
                        continue
                    snippet = item.get("snippet", "").strip()
                    snippet = snippet.replace("...Read more", "").replace("… Read more", "").replace("... Read more", "").rstrip("…").rstrip("...").strip()
                    if len(snippet) < 40:
                        continue
                    if snippet.count('·') >= 2:
                        continue
                    if DATE_PREFIX.match(snippet):
                        continue
                    if any(snippet[:60] == s[:60] for s in product_snippets):
                        continue
                    product_snippets.append(snippet)

            except Exception as e:
                logger.error(f"Failed to fetch SERP results for query '{query2}': {e}")

        product_summary = None

        try:
            openai_key = os.getenv("OPENAI_API_KEY")
            if openai_key:
                oai = OpenAI(api_key=openai_key)

                product_text = "\n".join(f"- {s}" for s in product_snippets) if product_snippets else ""

                if product_text:
                    prompt_parts = []
                    if product_text:
                        prompt_parts.append(f"PRODUCT SNIPPETS:\n{product_text}")

                    prompt = "\n\n".join(prompt_parts)
                    prompt += (
                        f"\n\nThe business you are summarizing is called '{result.business_name}'."
                        "\nIgnore any snippets that are clearly about a different company, "
                        "a historical document, an archive, or an unrelated topic.\n\n"
                        "Based only on the relevant snippets, write a detailed summary.\n\n"
                        "PRODUCT_SUMMARY: Write 6-8 sentences covering: what specific brands or product lines "
                        "they carry, what type of retailer or buyer they are (wholesale, multi-brand, DTC, etc.), "
                        "any pricing or positioning signals (luxury, mid-market, budget), "
                        "their key product categories, any seasonal or new collections mentioned, "
                        "and any wholesale or B2B signals. "
                        "If the snippets do not support this, write null.\n\n"
                        "Respond in this exact format and nothing else:\n"
                        "PRODUCT_SUMMARY: <your summary or null>"
                    )

                    response = oai.chat.completions.create(
                        model="gpt-4o-mini",
                        max_tokens=1200,   # was 600 — doubled to allow longer output
                        messages=[
                            {
                                "role": "system",
                                "content": (
                                    "You are a business intelligence analyst. You write detailed, factual, "
                                    "professional summaries from raw web snippets. Be thorough — extract every "
                                    "useful detail from the snippets. No fluff or filler, but do not truncate "
                                    "useful information. Only state what the snippets actually support. "
                                    "Never invent facts."
                                )
                            },
                            {"role": "user", "content": prompt}
                        ]
                    )

                    raw = response.choices[0].message.content.strip()
                    for line in raw.splitlines():
                        if line.startswith("PRODUCT_SUMMARY:"):
                            val = line[len("PRODUCT_SUMMARY:"):].strip()
                            product_summary = None if val.lower() == "null" else val
            else:
                logger.warning("OPENAI_API_KEY not set — skipping summarization")

        except Exception as e:
            logger.error(f"Summarization failed for lead {search_result_id}: {e}")

        enrichment = {
            "linkedin_url": linkedin_url,
            "company_snippets": [],
            "product_snippets": product_snippets,
            "company_summary": None,
            "product_summary": product_summary,
            "raw_queries": [query1, query2, query3]
        }

        result.serp_enrichment = enrichment
        result.linkedin_url = linkedin_url

        db.commit()

        return enrichment

    except Exception as e:
        logger.error(f"Failed to enrich lead {search_result_id}: {e}")
        return {}
