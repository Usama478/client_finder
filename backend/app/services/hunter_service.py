import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)

HUNTER_BASE_URL = "https://api.hunter.io/v2/domain-search"
MIN_CONFIDENCE = 50


async def find_emails_for_domain(domain: str) -> list[dict[str, Any]]:
    api_key = os.getenv("HUNTER_API_KEY", "")
    if not api_key:
        raise ValueError("HUNTER_API_KEY is not configured")

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            HUNTER_BASE_URL,
            params={"domain": domain, "api_key": api_key, "limit": 5},
        )

    if response.status_code != 200:
        raise RuntimeError(
            f"Hunter.io API returned status {response.status_code}: {response.text[:200]}"
        )

    data = response.json().get("data") or {}
    emails_raw = data.get("emails") or []

    results = []
    for item in emails_raw:
        if (item.get("confidence") or 0) < MIN_CONFIDENCE:
            continue
        results.append(
            {
                "email": item.get("value") or "",
                "confidence": item.get("confidence") or 0,
                "first_name": item.get("first_name") or "",
                "last_name": item.get("last_name") or "",
                "position": item.get("position") or "",
                "verified": (item.get("verification") or {}).get("status") == "verified",
            }
        )

    logger.info(
        "hunter find_emails domain=%s raw=%s passing=%s",
        domain,
        len(emails_raw),
        len(results),
    )
    return results
