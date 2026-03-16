from __future__ import annotations

"""
nodes.py — LangGraph node implementations for the Verification Agent.

Each node receives the full VerificationAgentState and returns a partial dict
containing ONLY the fields it owns.  No node writes fields owned by another node.
All nodes are wrapped in try/except so a single tool failure cannot crash the graph.
"""

import logging
from typing import Dict, Optional
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

from app.agents.verification.state import VerificationAgentState
from app.agents.verification.tools_v2.accessibility import check_accessibility, get_domain_age
from app.agents.verification.tools_v2.collector import collect_pages
from app.agents.verification.tools_v2.contact_extract import extract_contacts
from app.agents.verification.tools_v2.identity import resolve_identity
from app.agents.verification.tools_v2.legitimacy import compute_legitimacy
from app.agents.verification.tools_v2.size_estimate import estimate_size
from app.agents.verification.tools_v2.intelligence import run_business_intelligence


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _normalize_url(url: str) -> str:
    value = (url or "").strip()
    if not value:
        return ""
    if value.startswith(("http://", "https://")):
        return value
    return f"https://{value}"


def _safe_int(v, default: int = 0) -> int:
    try:
        return int(v) if v is not None else default
    except (TypeError, ValueError):
        return default


def _safe_float(v, default: float = 0.0) -> float:
    try:
        return float(v) if v is not None else default
    except (TypeError, ValueError):
        return default


# ---------------------------------------------------------------------------
# Node 1 — input_preparation
# ---------------------------------------------------------------------------

def input_preparation(state: VerificationAgentState) -> dict:
    """
    Normalise the website URL.  Everything else is already hydrated from DB.
    """
    try:
        normalized = _normalize_url(state.get("website") or "")
        return {"website": normalized}
    except Exception as exc:
        logger.error("input_preparation FAILED error=%s", exc, exc_info=True)
        return {}


# ---------------------------------------------------------------------------
# Node 2 — site_accessibility_check
# ---------------------------------------------------------------------------

def site_accessibility_check(state: VerificationAgentState) -> dict:
    """
    Lightweight HEAD check + WHOIS domain-age lookup.
    Sets: website_alive, ssl_valid, final_url, status_code, domain_age_years.
    """
    url = state.get("website") or ""
    try:
        result = check_accessibility(url)
        age = get_domain_age(url)
        return {
            "website_alive": result["live"],
            "ssl_valid": result["ssl_valid"],
            "final_url": result["final_url"],
            "status_code": result.get("status_code"),
            "domain_age_years": age,
        }
    except Exception as exc:
        logger.error("site_accessibility_check FAILED url=%s error=%s", url, exc, exc_info=True)
        return {"website_alive": False, "ssl_valid": False}


# ---------------------------------------------------------------------------
# Node 3 — targeted_page_collector
# ---------------------------------------------------------------------------

def targeted_page_collector(state: VerificationAgentState) -> dict:
    """
    Fetch /contact, /about, /wholesale and other priority sub-pages.
    Skips URLs already collected by the Relevancy Agent.
    Sets: full_site_text, contact_page_url, wholesale_page_found,
          wholesale_page_url, collection_blocked.
    """
    url = state.get("website") or ""
    try:
        # Correction 2: already_collected from relevancy artifact — usually empty
        already_collected = set(
            (state.get("relevancy_artifacts") or {})
            .get("collect_sources_output", {})
            .keys()
        )

        result = collect_pages(url, already_collected)

        merged = result.get("merged_text") or ""
        # Append homepage scrape from Relevancy Agent if collector got nothing
        if not merged:
            merged = state.get("scraped_text_content") or ""

        collection_blocked = (
            len(result.get("pages_collected") or {}) == 0
            and len(result.get("errors") or []) > 0
        )

        return {
            "full_site_text": merged,
            "contact_page_url": result.get("contact_page_url"),
            "wholesale_page_found": result.get("wholesale_page_found", False),
            "wholesale_page_url": result.get("wholesale_page_url"),
            "collection_blocked": collection_blocked,
        }
    except Exception as exc:
        logger.error("targeted_page_collector FAILED url=%s error=%s", url, exc, exc_info=True)
        return {"full_site_text": "", "collection_blocked": False}


# ---------------------------------------------------------------------------
# Node 4 — contact_extractor
# ---------------------------------------------------------------------------

def contact_extractor(state: VerificationAgentState) -> dict:
    """
    Extract emails, phones, WhatsApp, LinkedIn, social links, contact form flag.
    Falls back to scraped_text_content when full_site_text is unavailable.
    """
    text = state.get("full_site_text") or state.get("scraped_text_content") or ""
    url = state.get("website") or ""
    try:
        result = extract_contacts(text, url)

        # Correction 3: "hello" is not an allowed email_type in state — remap to "generic"
        if result.get("email_type") == "hello":
            result["email_type"] = "generic"

        return {
            "all_emails": result.get("all_emails") or [],
            "primary_email": result.get("primary_email"),
            "email_type": result.get("email_type"),
            "email_confidence": result.get("email_confidence"),
            "all_phones": result.get("all_phones") or [],
            "whatsapp_number": result.get("whatsapp_number"),
            "linkedin_company_url": result.get("linkedin_company_url"),
            "social_links": result.get("social_links") or {},
            "contact_form_present": result.get("contact_form_present", False),
        }
    except Exception as exc:
        logger.error("contact_extractor FAILED error=%s", exc, exc_info=True)
        return {
            "all_emails": [],
            "all_phones": [],
            "social_links": {},
        }


# ---------------------------------------------------------------------------
# Node 5 — identity_resolver
# ---------------------------------------------------------------------------

def identity_resolver(state: VerificationAgentState) -> dict:
    """
    Fuzzy-match the listed business name against website content.
    Detects country and verifies address presence.
    """
    text = state.get("full_site_text") or state.get("scraped_text_content") or ""
    try:
        result = resolve_identity(
            business_name=state.get("business_name") or "",
            website=state.get("website") or "",
            text=text,
            address=state.get("address") or "",
        )
        return {
            "company_name_confirmed": result.get("company_name_confirmed"),
            "domain_matches_business": result.get("domain_matches_business"),
            "domain_match_confidence": result.get("domain_match_confidence"),
            "country_confirmed": result.get("country_confirmed"),
        }
    except Exception as exc:
        logger.error("identity_resolver FAILED error=%s", exc, exc_info=True)
        return {}


# ---------------------------------------------------------------------------
# Node 6 — business_intelligence_extractor
# ---------------------------------------------------------------------------

def business_intelligence_extractor(state: VerificationAgentState) -> dict:
    """
    LLM call to extract product categories, pricing, B2B language, company description, etc.
    business_type and primary_niche are read directly from state (DB columns via _build_initial_state),
    NOT from relevancy_artifacts.
    """
    text = state.get("full_site_text") or state.get("scraped_text_content") or ""
    # Correction 1: read as direct state fields, not from relevancy_artifacts blob
    business_type = state.get("business_type") or ""
    primary_niche = state.get("primary_niche") or ""
    try:
        result = run_business_intelligence(
            text=text,
            business_name=state.get("business_name") or "",
            business_type=business_type,
            primary_niche=primary_niche,
        )
        return {
            "product_categories": result.get("product_categories") or [],
            "product_keywords": result.get("product_keywords") or [],
            "price_positioning": result.get("price_positioning"),
            "target_customer": result.get("target_customer"),
            "buys_externally": result.get("buys_externally"),
            "b2b_language_detected": result.get("b2b_language_detected", False),
            "company_description": result.get("company_description"),
            "brand_tone": result.get("brand_tone"),
            "markets_served": result.get("markets_served") or [],
            "ecommerce_enabled": result.get("ecommerce_enabled"),
        }
    except Exception as exc:
        logger.error("business_intelligence_extractor FAILED error=%s", exc, exc_info=True)
        return {
            "product_categories": [],
            "product_keywords": [],
            "markets_served": [],
        }


# ---------------------------------------------------------------------------
# Node 7 — legitimacy_analyzer
# ---------------------------------------------------------------------------

def legitimacy_analyzer(state: VerificationAgentState) -> dict:
    """
    Score 11 legitimacy signals and build risk_flags list.
    """
    text = state.get("full_site_text") or state.get("scraped_text_content") or ""
    try:
        # Infer contact/about HTML presence from state fields rather than raw HTML
        # (raw HTML is not stored in state — we use URL presence as a proxy)
        contact_html = "contact" if state.get("contact_page_url") else ""
        # About page presence inferred from text keywords in compute_legitimacy
        about_html = ""

        phone_found = (state.get("all_phones") or [None])[0] if state.get("all_phones") else None

        result = compute_legitimacy(
            text=text,
            about_html=about_html,
            contact_html=contact_html,
            email_found=state.get("primary_email"),
            phone_found=phone_found,
            social_count=len(state.get("social_links") or {}),
            ssl_valid=state.get("ssl_valid") or False,
            website_live=state.get("website_alive") or False,
            domain_age_years=state.get("domain_age_years"),
        )
        return {
            "legitimacy_score": result.get("legitimacy_score", 0),
            "has_about_page": result.get("has_about_page", False),
            "has_contact_page": result.get("has_contact_page", False),
            "has_policy_pages": result.get("has_policy_pages", False),
            "has_physical_address": result.get("has_physical_address", False),
            "risk_flags": result.get("risk_flags") or [],
        }
    except Exception as exc:
        logger.error("legitimacy_analyzer FAILED error=%s", exc, exc_info=True)
        return {"legitimacy_score": 0, "risk_flags": []}


# ---------------------------------------------------------------------------
# Node 8 — size_estimator
# ---------------------------------------------------------------------------

def size_estimator(state: VerificationAgentState) -> dict:
    """
    Estimate company size from text signals and platform hint from relevancy artifacts.
    """
    text = state.get("full_site_text") or state.get("scraped_text_content") or ""
    platform = (state.get("relevancy_artifacts") or {}).get("platform", "")
    try:
        result = estimate_size(text, platform or "")
        return {
            "employee_range": result.get("employee_range", "unknown"),
            "revenue_band": result.get("revenue_band", "unknown"),
        }
    except Exception as exc:
        logger.error("size_estimator FAILED error=%s", exc, exc_info=True)
        return {"employee_range": "unknown", "revenue_band": "unknown"}


# ---------------------------------------------------------------------------
# Node 9 — email_context_compiler
# ---------------------------------------------------------------------------

def email_context_compiler(state: VerificationAgentState) -> dict:
    """
    Pure assembly: compile all verified signals into email_context dict for Email Agent.
    No LLM.  Works even when called on the dead-site shortcut path (all inputs may be None).
    """
    try:
        # business_type/primary_niche are direct state fields (Correction 1 applied consistently)
        artifacts = state.get("relevancy_artifacts") or {}
        email_context: Dict[str, object] = {
            "company_name":          state.get("company_name_confirmed") or state.get("business_name") or "",
            "company_website":       state.get("final_url") or state.get("website") or "",
            "best_email":            state.get("primary_email"),
            "email_type":            state.get("email_type"),
            "all_phones":            state.get("all_phones") or [],
            "whatsapp":              state.get("whatsapp_number"),
            "linkedin_url":          state.get("linkedin_company_url"),
            "social_links":          state.get("social_links") or {},
            "wholesale_available":   state.get("wholesale_page_found") or False,
            "wholesale_page_url":    state.get("wholesale_page_url"),
            "business_type":         state.get("business_type"),
            "primary_niche":         state.get("primary_niche"),
            "product_categories":    state.get("product_categories") or [],
            "product_keywords":      state.get("product_keywords") or [],
            "price_positioning":     state.get("price_positioning"),
            "buys_externally":       state.get("buys_externally"),
            "b2b_language_detected": state.get("b2b_language_detected") or False,
            "company_description":   state.get("company_description"),
            "brand_tone":            state.get("brand_tone"),
            "markets_served":        state.get("markets_served") or [],
            "country":               state.get("country_confirmed"),
            "employee_range":        state.get("employee_range"),
            "revenue_band":          state.get("revenue_band"),
            "verification_score":    state.get("verification_score"),
            "risk_flags":            state.get("risk_flags") or [],
        }
        return {"email_context": email_context}
    except Exception as exc:
        logger.error("email_context_compiler FAILED error=%s", exc, exc_info=True)
        return {"email_context": {}}


# ---------------------------------------------------------------------------
# Node 10 — final_contract_builder
# ---------------------------------------------------------------------------

def _build_verification_reason(
    verification_result: str,
    ssl_valid: Optional[bool],
    domain_age_years: Optional[int],
    primary_email: Optional[str],
    email_type: Optional[str],
    legitimacy_score: int,
    domain_match_confidence: Optional[float],
    contactability_score: int,
) -> str:
    if verification_result == "verified":
        parts = ["Verified"]
        if ssl_valid:
            parts.append("SSL valid")
        if domain_age_years:
            parts.append(f"{domain_age_years}-year domain")
        if primary_email:
            parts.append(f"direct {email_type or 'email'} email found")
        parts.append(f"legitimacy {legitimacy_score}/100")
        return ", ".join(parts)

    if verification_result == "failed":
        parts = ["Failed"]
        if not ssl_valid:
            parts.append("SSL invalid or site unreachable")
        if not primary_email:
            parts.append("no email found")
        parts.append(f"legitimacy {legitimacy_score}/100")
        return ", ".join(parts)

    if verification_result == "manual_review":
        conf = f"{domain_match_confidence:.2f}" if domain_match_confidence is not None else "unknown"
        return f"Manual review required: low domain match confidence ({conf})"

    # partial
    parts = [f"Partial: legitimacy {legitimacy_score}/100"]
    parts.append(f"contactability {contactability_score}/100")
    if primary_email:
        parts.append(f"{email_type or 'email'} found")
    else:
        parts.append("no email found")
    return ", ".join(parts)


def final_contract_builder(state: VerificationAgentState) -> dict:
    """
    Deterministic composite scorer: computes contactability_score, verification_score,
    verification_result, verification_confidence, verification_reason, manual_review.
    Sets is_finalized = True.
    """
    try:
        primary_email = state.get("primary_email")
        email_type = (state.get("email_type") or "").lower()
        all_phones = state.get("all_phones") or []
        whatsapp_number = state.get("whatsapp_number")
        linkedin_company_url = state.get("linkedin_company_url")
        has_contact_page = state.get("has_contact_page") or False
        contact_form_present = state.get("contact_form_present") or False
        legitimacy_score = _safe_int(state.get("legitimacy_score"), 0)
        domain_match_confidence = _safe_float(state.get("domain_match_confidence"), 0.0)
        domain_matches_business = state.get("domain_matches_business")
        website_alive = state.get("website_alive")
        ssl_valid = state.get("ssl_valid")
        domain_age_years = state.get("domain_age_years")

        # ---- Contactability score ----
        base = 40 if primary_email else 0
        if email_type in ("buying", "wholesale", "trade", "procurement"):
            email_bonus = 25
        elif email_type in ("sales", "export", "international"):
            email_bonus = 15
        elif email_type in ("info", "contact", "enquiries", "enquiry"):
            email_bonus = 5
        else:
            email_bonus = 0
        phone_pts     = 10 if all_phones else 0
        whatsapp_pts  = 8  if whatsapp_number else 0
        linkedin_pts  = 10 if linkedin_company_url else 0
        contact_pts   = 5  if has_contact_page else 0
        form_pts      = 2  if contact_form_present else 0
        contactability_score = min(
            100,
            base + email_bonus + phone_pts + whatsapp_pts + linkedin_pts + contact_pts + form_pts,
        )

        # ---- Verification score ----
        raw_score = (
            (legitimacy_score * 0.40)
            + (contactability_score * 0.40)
            + (domain_match_confidence * 100 * 0.20)
        )
        verification_score = max(0, min(100, int(round(raw_score))))

        # Belt-and-suspenders None-guard: if future refactors break null arithmetic
        # and produce None/NaN, never let it reach the DB.
        if verification_score is None:
            logger.warning(
                "final_contract_builder: verification_score is None for business_id=%s — falling back to failed",
                state.get("business_id"),
            )
            return {
                "verification_score": 0,
                "verification_result": "failed",
                "verification_confidence": 0.0,
                "verification_reason": "Internal error: score computation produced None",
                "manual_review": True,
                "contactability_score": contactability_score,
                "is_finalized": False,
            }

        # ---- Verification result ----
        if (
            legitimacy_score >= 70
            and primary_email
            and domain_match_confidence >= 0.6
        ):
            verification_result = "verified"
        elif (
            domain_matches_business is False
            and domain_match_confidence < 0.4
        ):
            verification_result = "manual_review"
        elif (
            website_alive is False
            and primary_email is None
            and (_safe_int(state.get("legitimacy_score"), 0)) < 30
        ):
            verification_result = "failed"
        else:
            verification_result = "partial"

        verification_confidence = verification_score / 100.0
        manual_review = verification_result == "manual_review"

        verification_reason = _build_verification_reason(
            verification_result=verification_result,
            ssl_valid=ssl_valid,
            domain_age_years=domain_age_years,
            primary_email=primary_email,
            email_type=email_type or None,
            legitimacy_score=legitimacy_score,
            domain_match_confidence=domain_match_confidence,
            contactability_score=contactability_score,
        )

        return {
            "contactability_score": contactability_score,
            "verification_score": verification_score,
            "verification_result": verification_result,
            "verification_confidence": verification_confidence,
            "verification_reason": verification_reason,
            "manual_review": manual_review,
            "is_finalized": True,
        }

    except Exception as exc:
        logger.error("final_contract_builder FAILED error=%s", exc, exc_info=True)
        return {
            "verification_result": "failed",
            "verification_score": 0,
            "verification_confidence": 0.0,
            "verification_reason": f"Internal error: {exc}",
            "manual_review": True,
            "contactability_score": 0,
            "is_finalized": True,
        }
