from __future__ import annotations

"""
draft_generator.py — Two-call LLM email generation with output validation.

Call 1: build_email_strategy  — gpt-4o-mini, 600 tokens, returns normalised
        strategy dict that controls tone, angle, and CTA for the email.
Call 2: generate_email_draft  — gpt-4o-mini, 800 tokens, returns subject +
        body using the strategy produced by call 1.

Never raises.  All public functions return safe dicts on any failure.
"""

import json
import logging
import time as _time
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_MODEL = "gpt-4o-mini"
_TEMPERATURE = 0.4
_MAX_TOKENS_STRATEGY = 600
_MAX_TOKENS_EMAIL = 800

_VALID_TONES = {"casual_professional", "formal", "warm_direct"}
_VALID_RECIPIENT_TITLES = {
    "Buying Team",
    "Procurement Team",
    "Wholesale Team",
    "Sourcing Team",
}
_CTA_BY_POSITION = {
    1: "soft_offer",
    2: "sample_offer",
    3: "final_check_in",
}
_CAPABILITY_FALLBACKS = [
    "flexible production",
    "fast sampling",
    "certified manufacturing",
]

_STRATEGY_SYSTEM_PROMPT = """\
You are a B2B sales strategist for textile manufacturing outreach.
Analyze the buyer and seller data and build an email strategy.
Return ONLY valid JSON. No preamble. No markdown.

Schema:
{
  "angle": "",
  "personalization_hook": "",
  "hook_source": "",
  "tone": "",
  "capability_highlights": [],
  "recipient_title": "",
  "cta_type": "",
  "pitch_angle_reason": ""
}

Rules:
- angle: the specific product category overlap between buyer
  and seller. Must come from seller product_categories that
  match buyer product_categories.
- personalization_hook: one factual observation from buyer data.
  Must come from company_description, product_keywords, or
  brand_tone. Never invent.
- hook_source: where hook came from ("company_description",
  "product_keywords", "brand_tone", or "fallback")
- capability_highlights: exactly 3 items. Use seller's real
  specializations, certifications, MOQ, or lead time.
- recipient_title: infer from email_type
- cta_type: position 1=soft_offer, 2=sample_offer,
  3=final_check_in
- Never invent facts not present in the input data.\
"""

_EMAIL_SYSTEM_PROMPT = """\
You are writing a cold outreach email from a textile manufacturer
to a fashion brand buyer. Follow ALL rules. No exceptions.

STRICT RULES:
- Never write "we are a leading manufacturer" or any variation
- Never mention Pakistan as a selling point — factual mention only
- Never use the buyer's personal name — use recipient_title only
- Body must be 120-160 words. Count carefully before outputting.
- Open with personalization_hook — must be specific to this buyer
- Include exactly 3 bullet points using capability_highlights
- Each bullet point must be one line only
- End with CTA matching cta_type:
  soft_offer: end with "If it makes sense, I'd be happy to..."
  sample_offer: end with "I'd love to send over sample references..."
  final_check_in: end with "I'll keep this brief — if the timing
  works for your team, I'd welcome a quick conversation."
- Subject line: max 10 words, specific to buyer product category
- Plain text only — no markdown, no bold, no asterisks in body
- Sign off: "Best regards," then new line with contact_person_name,
  then company_name

OUTPUT (JSON only, no markdown):
{"subject": "...", "body": "..."}\
"""


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_attr(obj, name, default=None):
    """Safely get an attribute whether obj is a model instance or dict."""
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


def _truncate_at_sentence(text: str, max_words: int) -> str:
    """Truncate *text* at the last sentence boundary before *max_words*."""
    words = text.split()
    if len(words) <= max_words:
        return text
    truncated = " ".join(words[:max_words])
    for punct in (".", "!", "?"):
        idx = truncated.rfind(punct)
        if idx != -1:
            return truncated[: idx + 1].strip()
    return truncated.strip()


def _llm_call(system: str, user: str, max_tokens: int) -> Optional[str]:
    """Single ChatOpenAI call; returns raw string content or None on failure."""
    from langchain_openai import ChatOpenAI

    llm = ChatOpenAI(
        model=_MODEL,
        temperature=_TEMPERATURE,
        max_tokens=max_tokens,
        model_kwargs={"response_format": {"type": "json_object"}},
        request_timeout=30,
    )
    response = llm.invoke([("system", system), ("user", user)])
    content = response.content
    return content if isinstance(content, str) else str(content)


# ---------------------------------------------------------------------------
# _normalize_strategy
# ---------------------------------------------------------------------------

def _normalize_strategy(raw: dict, sequence_position: int, profile) -> dict:
    """
    Validate and repair a strategy dict produced by the LLM (or an empty dict
    on failure).  Guarantees that every key is present and sane.
    """
    result = dict(raw)  # shallow copy; we mutate in place

    # 1. capability_highlights — must be exactly 3 items
    highlights = result.get("capability_highlights")
    if not isinstance(highlights, list):
        highlights = []

    if len(highlights) > 3:
        highlights = highlights[:3]
    elif len(highlights) < 3:
        specializations = list(_get_attr(profile, "specializations") or [])
        for item in specializations:
            if len(highlights) >= 3:
                break
            if item not in highlights:
                highlights.append(item)
        fallback_idx = 0
        while len(highlights) < 3:
            highlights.append(_CAPABILITY_FALLBACKS[fallback_idx % len(_CAPABILITY_FALLBACKS)])
            fallback_idx += 1

    result["capability_highlights"] = highlights

    # 2. tone
    tone = result.get("tone") or ""
    if tone not in _VALID_TONES:
        result["tone"] = "casual_professional"

    # 3. cta_type — enforce by sequence_position regardless of LLM output
    result["cta_type"] = _CTA_BY_POSITION.get(sequence_position, "soft_offer")

    # 4. recipient_title
    rt = result.get("recipient_title") or ""
    if rt not in _VALID_RECIPIENT_TITLES:
        result["recipient_title"] = "Buying Team"

    # 5. angle
    angle = result.get("angle") or ""
    if not angle:
        preferred = list(_get_attr(profile, "preferred_categories_for_outreach") or [])
        product_cats = list(_get_attr(profile, "product_categories") or [])
        if preferred:
            angle = preferred[0]
        elif product_cats:
            angle = product_cats[0]
        else:
            angle = "apparel manufacturing"
        result["angle"] = angle

    # 6. personalization_hook
    hook = result.get("personalization_hook") or ""
    hook_source_override: Optional[str] = None
    if not hook:
        # Try to derive from email_context if present in the result metadata;
        # this field is not in the LLM schema so we look at raw for a
        # "_email_context" key injected by the caller.
        company_desc = result.pop("_company_description", None) or ""
        if company_desc:
            hook = company_desc[:100]
            hook_source_override = "company_description"
        else:
            hook = "your recent collections"
            hook_source_override = "fallback"
        result["personalization_hook"] = hook

    # 7. hook_source
    if hook_source_override is not None:
        result["hook_source"] = hook_source_override
    else:
        existing = result.get("hook_source") or ""
        if not existing:
            result["hook_source"] = "llm"

    # Ensure pitch_angle_reason key exists
    if "pitch_angle_reason" not in result:
        result["pitch_angle_reason"] = ""

    return result


# ---------------------------------------------------------------------------
# build_email_strategy
# ---------------------------------------------------------------------------

def build_email_strategy(
    email_context: dict,
    profile,
    sequence_position: int,
) -> dict:
    """
    Call gpt-4o-mini to build a structured email strategy.

    Returns a normalised strategy dict.  Never raises.
    """
    if not email_context or not getattr(profile, "company_name", None):
        return _normalize_strategy({}, sequence_position, profile)

    user_message = (
        f"BUYER:\n"
        f"Company: {email_context.get('company_name')}\n"
        f"Products: {email_context.get('product_categories')}\n"
        f"Keywords: {(email_context.get('product_keywords') or [])[:8]}\n"
        f"Brand tone: {email_context.get('brand_tone')}\n"
        f"Price positioning: {email_context.get('price_positioning')}\n"
        f"Markets: {email_context.get('markets_served')}\n"
        f"Buys externally: {email_context.get('buys_externally')}\n"
        f"Has wholesale page: {email_context.get('wholesale_available')}\n"
        f"Email type: {email_context.get('email_type')}\n"
        f"Description: {(email_context.get('company_description') or '')[:200]}\n"
        f"\n"
        f"SELLER:\n"
        f"Company: {_get_attr(profile, 'company_name')}\n"
        f"Location: {_get_attr(profile, 'company_location')}\n"
        f"Categories: {_get_attr(profile, 'product_categories')}\n"
        f"Preferred outreach categories: {_get_attr(profile, 'preferred_categories_for_outreach')}\n"
        f"Specializations: {_get_attr(profile, 'specializations')}\n"
        f"Production strengths: {_get_attr(profile, 'production_strengths')}\n"
        f"MOQ: {_get_attr(profile, 'moq')} pcs\n"
        f"Sampling turnaround: {_get_attr(profile, 'sampling_turnaround_days')} days\n"
        f"Bulk lead time: {_get_attr(profile, 'bulk_lead_time_days')} days\n"
        f"Certifications: {_get_attr(profile, 'certifications')}\n"
        f"Export markets: {_get_attr(profile, 'export_markets')}\n"
        f"Target buyer types: {_get_attr(profile, 'target_buyer_types')}\n"
        f"Value proposition: {_get_attr(profile, 'value_proposition')}\n"
        f"Sample policy: {_get_attr(profile, 'sample_policy')}\n"
        f"MOQ flexibility: {_get_attr(profile, 'minimum_order_flexibility_note')}\n"
        f"\n"
        f"SEQUENCE POSITION: {sequence_position} of 3"
    )

    content = None
    try:
        content = _llm_call(_STRATEGY_SYSTEM_PROMPT, user_message, _MAX_TOKENS_STRATEGY)
    except Exception as exc:
        logger.error(
            "build_email_strategy LLM_CALL_FAILED company=%s error=%s",
            email_context.get("company_name"),
            exc,
            exc_info=True,
        )
        return _normalize_strategy({}, sequence_position, profile)

    try:
        raw = json.loads(content)
        if not isinstance(raw, dict):
            raise ValueError(f"Expected JSON object, got {type(raw).__name__}")
    except (json.JSONDecodeError, ValueError) as parse_exc:
        logger.error(
            "build_email_strategy JSON_PARSE_FAILED company=%s error=%s raw=%.300s",
            email_context.get("company_name"),
            parse_exc,
            content,
        )
        return _normalize_strategy({}, sequence_position, profile)

    # Inject company_description so _normalize_strategy can use it for hook
    # fallback without needing email_context passed in.
    raw["_company_description"] = email_context.get("company_description") or ""

    return _normalize_strategy(raw, sequence_position, profile)


# ---------------------------------------------------------------------------
# generate_email_draft
# ---------------------------------------------------------------------------

def generate_email_draft(
    strategy: dict,
    email_context: dict,
    profile,
    sequence_position: int,
) -> dict:
    """
    Call gpt-4o-mini to produce the final email subject and body.

    Returns {"subject": str, "body": str, "error": str | None}.
    Never raises.
    """
    _error_result: dict = {"subject": None, "body": None, "error": "generation_failed"}

    highlights = strategy.get("capability_highlights") or ["", "", ""]
    while len(highlights) < 3:
        highlights.append("")

    user_message = (
        f"STRATEGY:\n"
        f"Angle: {strategy.get('angle')}\n"
        f"Personalization hook: {strategy.get('personalization_hook')}\n"
        f"Tone: {strategy.get('tone')}\n"
        f"Capability highlights:\n"
        f"  1. {highlights[0]}\n"
        f"  2. {highlights[1]}\n"
        f"  3. {highlights[2]}\n"
        f"Recipient title: {strategy.get('recipient_title')}\n"
        f"CTA type: {strategy.get('cta_type')}\n"
        f"\n"
        f"SELLER:\n"
        f"Contact name: {_get_attr(profile, 'contact_person_name')}\n"
        f"Company: {_get_attr(profile, 'company_name')}\n"
        f"Certifications: {_get_attr(profile, 'certifications')}\n"
        f"\n"
        f"BUYER:\n"
        f"Company: {email_context.get('company_name')}\n"
        f"Country: {email_context.get('country')}\n"
        f"\n"
        f"SEQUENCE: Position {sequence_position} of 3"
    )

    content: Optional[str] = None
    for attempt in range(1, 3):
        try:
            content = _llm_call(_EMAIL_SYSTEM_PROMPT, user_message, _MAX_TOKENS_EMAIL)
            # Attempt JSON parse to confirm success; break only on valid JSON
            parsed_check = json.loads(content)
            if isinstance(parsed_check, dict):
                break
            raise ValueError(f"Expected JSON object, got {type(parsed_check).__name__}")
        except (json.JSONDecodeError, ValueError):
            logger.error(
                "generate_email_draft JSON_PARSE_FAILED attempt=%s/%s company=%s raw=%.300s",
                attempt,
                2,
                email_context.get("company_name"),
                content,
            )
            content = None
            if attempt < 2:
                _time.sleep(2)
        except Exception as exc:
            logger.error(
                "generate_email_draft LLM_CALL_FAILED attempt=%s/%s company=%s error=%s",
                attempt,
                2,
                email_context.get("company_name"),
                exc,
                exc_info=True,
            )
            content = None
            if attempt < 2:
                _time.sleep(2)

    if content is None:
        return _error_result

    try:
        result = json.loads(content)
    except (json.JSONDecodeError, ValueError):
        return _error_result

    subject: str = result.get("subject") or ""
    body: str = result.get("body") or ""

    # Post-generation validation: word count check
    words = body.split()
    if len(words) > 250:
        logging.warning(
            "email body too long (%s words) — truncating", len(words))
        sentences = body.split(". ")
        truncated = ""
        for sentence in sentences:
            if len((truncated + sentence).split()) <= 200:
                truncated += sentence + ". "
            else:
                break
        body = truncated.strip()

    if "leading manufacturer" in body.lower():
        logger.warning(
            "generate_email_draft PROHIBITED_PHRASE 'leading manufacturer' found "
            "company=%s — flagged for human review",
            email_context.get("company_name"),
        )

    return {"subject": subject, "body": body, "error": None}
