from __future__ import annotations

"""
intelligence.py — single LLM call for business intelligence extraction.

Extracts factual signals from scraped website text.  Does NOT judge relevance
or market fit — that was already done by the Relevancy Agent.

Uses the same ChatOpenAI client setup as
app/agents/relevancy/tools_v2/judge.py (langchain_openai, json_object mode).
Never raises; returns safe defaults on any failure.
"""

import json
import logging
import time as _time
from typing import List, Optional

from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_MODEL = "gpt-4o-mini"
_TEMPERATURE = 0.0
_MAX_TOKENS = 800
_MAX_TEXT_CHARS = 6000

_VALID_PRICE_POSITIONS = {"luxury", "mid-market", "budget", "unknown"}
_VALID_TARGET_CUSTOMERS = {"B2C", "B2B", "both", "unknown"}
_VALID_BRAND_TONES = {"formal", "casual", "luxury", "commercial"}

_SYSTEM_PROMPT = """\
You are a business intelligence analyst. Extract factual information from
the website text provided. Do NOT judge relevance or market fit — that was
already done. Extract only what you can observe in the text.

Return ONLY valid JSON matching this schema exactly:
{
  "product_categories": [],        // list of strings, max 8
  "product_keywords": [],          // specific product terms, max 12
  "price_positioning": "",         // "luxury"|"mid-market"|"budget"|"unknown"
  "target_customer": "",           // "B2C"|"B2B"|"both"|"unknown"
  "buys_externally": null,         // true if text mentions importing/sourcing/suppliers, false if makes own, null if unclear
  "b2b_language_detected": false,  // true if wholesale/trade/bulk language present
  "company_description": "",       // 2-3 sentences usable in an outreach email
  "brand_tone": "",                // "formal"|"casual"|"luxury"|"commercial"
  "markets_served": [],            // countries/regions mentioned, max 6
  "ecommerce_enabled": null        // true if online store present, false if not, null if unclear
}

Rules:
- buys_externally=true if text contains: "imports", "sourced from", "our suppliers", "wholesale ordering"
- Never invent facts. Use "unknown" or null if unsure.
- company_description must be factual and usable verbatim in an outreach email.
- Return only the JSON object. No preamble, no markdown.\
"""


# ---------------------------------------------------------------------------
# Output schema
# ---------------------------------------------------------------------------

class BusinessIntelligenceOutput(BaseModel):
    product_categories: List[str] = []
    product_keywords: List[str] = []
    price_positioning: str = "unknown"
    target_customer: str = "unknown"
    buys_externally: Optional[bool] = None
    b2b_language_detected: bool = False
    company_description: str = ""
    brand_tone: str = "commercial"
    markets_served: List[str] = []
    ecommerce_enabled: Optional[bool] = None


def _safe_defaults() -> dict:
    return BusinessIntelligenceOutput().model_dump()


# ---------------------------------------------------------------------------
# Coercion helpers — tolerate minor LLM enum drift
# ---------------------------------------------------------------------------

def _coerce_output(raw: dict) -> dict:
    """Clamp enum fields to allowed values without raising."""
    pp = str(raw.get("price_positioning") or "unknown").strip().lower()
    raw["price_positioning"] = pp if pp in _VALID_PRICE_POSITIONS else "unknown"

    tc = str(raw.get("target_customer") or "unknown").strip()
    raw["target_customer"] = tc if tc in _VALID_TARGET_CUSTOMERS else "unknown"

    bt = str(raw.get("brand_tone") or "commercial").strip().lower()
    raw["brand_tone"] = bt if bt in _VALID_BRAND_TONES else "commercial"

    # Cap list lengths as specified in the prompt
    if isinstance(raw.get("product_categories"), list):
        raw["product_categories"] = raw["product_categories"][:8]
    if isinstance(raw.get("product_keywords"), list):
        raw["product_keywords"] = raw["product_keywords"][:12]
    if isinstance(raw.get("markets_served"), list):
        raw["markets_served"] = raw["markets_served"][:6]

    return raw


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def run_business_intelligence(
    text: str,
    business_name: str = "",
    business_type: str = "unknown",
    primary_niche: str = "unknown",
) -> dict:
    """
    Call gpt-4o-mini to extract business intelligence from website text.

    Parameters
    ----------
    text          : Combined scraped text from the site (truncated to 6000 chars).
    business_name : Name of the business from the lead record.
    business_type : Relevancy Agent's business type classification.
    primary_niche : Relevancy Agent's primary niche classification.

    Returns
    -------
    dict matching BusinessIntelligenceOutput — safe defaults on any failure.
    """
    # ---- Input guard ----
    if not text or not text.strip():
        logger.warning(
            "run_business_intelligence: empty text for business_name=%s — returning defaults",
            business_name,
        )
        return _safe_defaults()

    truncated_text = text[:_MAX_TEXT_CHARS]
    user_message = (
        f"Business: {business_name}\n"
        f"Type: {business_type}\n"
        f"Niche: {primary_niche}\n\n"
        f"Website text:\n{truncated_text}"
    )

    content = None
    for _attempt in range(1, 3):
        try:
            # Same client pattern as app/agents/relevancy/tools_v2/judge.py
            from langchain_openai import ChatOpenAI

            llm = ChatOpenAI(
                model=_MODEL,
                temperature=_TEMPERATURE,
                max_tokens=_MAX_TOKENS,
                model_kwargs={"response_format": {"type": "json_object"}},
                request_timeout=30,
            )

            response = llm.invoke(
                [
                    ("system", _SYSTEM_PROMPT),
                    ("user", user_message),
                ]
            )

            content = response.content if isinstance(response.content, str) else str(response.content)
            break

        except Exception as llm_exc:
            logger.error(
                "run_business_intelligence LLM_CALL_FAILED attempt=%s/%s business_name=%s error=%s",
                _attempt, 2, business_name, llm_exc, exc_info=True,
            )
            if _attempt < 2:
                _time.sleep(2)

    if content is None:
        return _safe_defaults()

    # ---- Parse JSON ----
    try:
        raw = json.loads(content)
        if not isinstance(raw, dict):
            raise ValueError(f"Expected JSON object, got {type(raw).__name__}")
    except (json.JSONDecodeError, ValueError) as parse_exc:
        logger.error(
            "run_business_intelligence JSON_PARSE_FAILED business_name=%s error=%s raw=%.300s",
            business_name,
            parse_exc,
            content,
        )
        return _safe_defaults()

    # ---- Coerce enum fields before Pydantic validation ----
    raw = _coerce_output(raw)

    # ---- Validate with Pydantic ----
    try:
        parsed = BusinessIntelligenceOutput.model_validate(raw)
        return parsed.model_dump()
    except ValidationError as val_exc:
        logger.error(
            "run_business_intelligence VALIDATION_FAILED business_name=%s error=%s",
            business_name,
            val_exc,
        )
        return _safe_defaults()
