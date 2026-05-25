from __future__ import annotations

"""
draft_generator.py — Two-call LLM email generation with output validation.

Call 1: build_email_strategy  — gpt-4o-mini, 600 tokens, returns normalised
        strategy dict that controls tone, angle, and CTA for the email.
Call 2: generate_email_draft  — gpt-4o-mini, 1200 tokens, returns subject +
        body using the strategy produced by call 1.

Never raises.  All public functions return safe dicts on any failure.
"""

import json
import logging
import re
import time as _time
from typing import Any, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_MODEL = "gpt-4o-mini"
_DEFAULT_TEMPERATURE = 0.4
_MAX_TOKENS_STRATEGY = 600
_MAX_TOKENS_EMAIL = 1200

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
to a fashion brand buyer. Follow ALL rules below.

If an EMAIL TEMPLATE TO FOLLOW section is provided, it takes highest
priority — match its structure, tone, and phrasing style exactly.
ADDITIONAL USER INSTRUCTIONS override default rules where they conflict.

DEFAULT RULES (overridable by EMAIL TEMPLATE or ADDITIONAL USER INSTRUCTIONS):
- Never write "we are a leading manufacturer" or any variation
- Never mention Pakistan as a selling point — factual mention only
- Never use the buyer's personal name — use recipient_title only
- Write an appropriately detailed email body
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

PRODUCT CATALOG INSTRUCTIONS (apply when product_categories are present in BUYER data):
- If the buyer's product_categories are provided, name at least one specific category in the opening line
- Match those categories to the sender's manufacturing capabilities explicitly
- If certifications are present and relevant to the product type, mention one by name
- Never use generic phrases like "your esteemed company", "I came across your website", or "I hope this email finds you well"
- Write as if you have personally researched this specific buyer's catalog

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


_PLACEHOLDER_RE = re.compile(r"\{\{(\w+)\}\}")


def _clamp_temperature(value: float) -> float:
    try:
        t = float(value)
    except (TypeError, ValueError):
        return _DEFAULT_TEMPERATURE
    return max(0.0, min(1.0, t))


def _json_preview(value: Any, max_len: int = 800) -> str:
    if value is None:
        return ""
    try:
        text = json.dumps(value, default=str)
    except (TypeError, ValueError):
        text = str(value)
    if len(text) > max_len:
        return text[:max_len] + "…"
    return text


def build_placeholder_map(lead, email_context: dict, profile, ai_context: str = "") -> dict:
    """Variables for {{placeholder}} substitution in user templates."""
    ctx = email_context or {}
    catalog = _get_attr(lead, "verified_product_catalog") or {}
    if not isinstance(catalog, dict):
        catalog = {}
    categories = (
        catalog.get("product_categories")
        or ctx.get("product_categories")
        or []
    )
    if isinstance(categories, str):
        categories = [categories]
    product_category = categories[0] if categories else ""
    certs = _get_attr(profile, "certifications") or []
    if isinstance(certs, list) and certs:
        certification = certs[0]
    else:
        certification = str(certs) if certs else ""
    return {
        "company_name": ctx.get("company_name") or _get_attr(lead, "business_name") or "",
        "product_category": product_category,
        "website": _get_attr(lead, "website") or "",
        "relevance_score": _get_attr(lead, "relevance_score"),
        "verification_score": _get_attr(lead, "verification_score"),
        "seller_company": _get_attr(profile, "company_name") or "",
        "seller_location": _get_attr(profile, "company_location") or "",
        "certification": certification,
        "ai_context": ai_context or "",
    }


def apply_template_placeholders(text: str, variables: dict) -> str:
    if not text:
        return text

    def _repl(match: re.Match) -> str:
        key = match.group(1)
        if key not in variables:
            return match.group(0)
        val = variables[key]
        if val is None:
            return ""
        return str(val)

    return _PLACEHOLDER_RE.sub(_repl, text)


def _extract_template_and_instructions(raw: str) -> tuple[str, str]:
    """Split user instructions into custom notes vs email template body."""
    if not raw:
        return "", ""
    for marker in ("--- EMAIL TEMPLATE ---", "--- TEMPLATE CONTEXT ---"):
        if marker in raw:
            before, _, after = raw.partition(marker)
            return before.strip(), after.strip()
    return raw.strip(), ""


def _build_instruction_prefix(
    user_instructions: str,
    placeholders: dict,
) -> str:
    """Build critical template/instruction block to prepend before lead data."""
    custom, template = _extract_template_and_instructions(user_instructions)
    resolved_custom = apply_template_placeholders(custom, placeholders)
    resolved_template = apply_template_placeholders(template, placeholders)
    parts: list[str] = []
    if resolved_template:
        parts.append(
            "CRITICAL INSTRUCTION — you MUST follow this template structure exactly.\n"
            "Do not deviate from the format, tone, or section order specified below.\n"
            "The template overrides your default email structure:\n\n"
            f"{resolved_template}"
        )
    if resolved_custom:
        parts.append(f"ADDITIONAL USER INSTRUCTIONS:\n{resolved_custom}")
    if not parts:
        return ""
    return "\n\n".join(parts) + "\n\n"


def _format_lead_data_block(lead, email_context: dict) -> str:
    ctx = email_context or {}
    serp = _get_attr(lead, "serp_enrichment") or {}
    hunter = _get_attr(lead, "hunter_emails") or []
    catalog = _get_attr(lead, "verified_product_catalog") or {}
    primary = _get_attr(lead, "primary_contact_email") or _get_attr(lead, "email_found")
    lines = [
        f"Business name: {_get_attr(lead, 'business_name')}",
        f"Website: {_get_attr(lead, 'website')}",
        f"Relevance decision: {_get_attr(lead, 'relevance_decision')}",
        f"Relevance score: {_get_attr(lead, 'relevance_score')}",
        f"Relevance reason: {_get_attr(lead, 'relevance_reason')}",
        f"Verification score: {_get_attr(lead, 'verification_score')}",
        f"Legitimacy score: {_get_attr(lead, 'legitimacy_score')}",
        f"Primary contact email: {primary}",
        f"Hunter emails: {hunter}",
        f"Verified product catalog: {_json_preview(catalog)}",
        f"SERP enrichment: {_json_preview(serp)}",
        f"Email context (curated): company={ctx.get('company_name')}, "
        f"products={ctx.get('product_categories')}, "
        f"description={(ctx.get('company_description') or '')[:200]}",
    ]
    return "\n".join(lines)


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


def _llm_call(
    system: str,
    user: str,
    max_tokens: int,
    temperature: float = _DEFAULT_TEMPERATURE,
) -> Optional[str]:
    """Single ChatOpenAI call; returns raw string content or None on failure."""
    from langchain_openai import ChatOpenAI

    llm = ChatOpenAI(
        model=_MODEL,
        temperature=_clamp_temperature(temperature),
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
    user_instructions: str = "",
    lead=None,
    ai_context: str = "",
    temperature: float = _DEFAULT_TEMPERATURE,
) -> dict:
    """
    Call gpt-4o-mini to build a structured email strategy.

    Returns a normalised strategy dict.  Never raises.
    """
    if not email_context or not getattr(profile, "company_name", None):
        return _normalize_strategy({}, sequence_position, profile)

    placeholders = build_placeholder_map(lead, email_context, profile, ai_context)

    instruction_prefix = _build_instruction_prefix(user_instructions, placeholders)

    user_message = instruction_prefix + (
        f"CAMPAIGN AI CONTEXT:\n{ai_context or '(none)'}\n\n"
        f"LEAD DATA:\n{_format_lead_data_block(lead, email_context) if lead is not None else '(no lead row)'}\n\n"
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
        content = _llm_call(
            _STRATEGY_SYSTEM_PROMPT,
            user_message,
            _MAX_TOKENS_STRATEGY,
            temperature=temperature,
        )
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
    user_instructions: str = "",
    lead=None,
    ai_context: str = "",
    temperature: float = _DEFAULT_TEMPERATURE,
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

    placeholders = build_placeholder_map(lead, email_context, profile, ai_context)

    instruction_prefix = _build_instruction_prefix(user_instructions, placeholders)

    user_message = instruction_prefix + (
        f"CAMPAIGN AI CONTEXT:\n{ai_context or '(none)'}\n\n"
        f"LEAD DATA:\n{_format_lead_data_block(lead, email_context) if lead is not None else '(no lead row)'}\n\n"
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
            content = _llm_call(
                _EMAIL_SYSTEM_PROMPT,
                user_message,
                _MAX_TOKENS_EMAIL,
                temperature=temperature,
            )
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

    if "leading manufacturer" in body.lower():
        logger.warning(
            "generate_email_draft PROHIBITED_PHRASE 'leading manufacturer' found "
            "company=%s — flagged for human review",
            email_context.get("company_name"),
        )

    return {"subject": subject, "body": body, "error": None}
