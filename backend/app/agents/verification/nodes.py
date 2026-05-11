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


def _site_root(url: str) -> str:
    """
    Return the scheme + netloc root of *url* with a trailing slash.

    Examples
    --------
    "https://example.com/shop/page"  → "https://example.com/"
    "http://example.com"             → "http://example.com/"
    "example.com/blog/post"          → "https://example.com/"  (adds https)
    ""                               → ""

    Always preserves https when present.  Safe on malformed input.
    """
    try:
        value = (url or "").strip()
        if not value:
            return ""
        # Ensure there is a scheme so urlparse can find the netloc
        if not value.startswith(("http://", "https://")):
            value = f"https://{value}"
        parsed = urlparse(value)
        netloc = parsed.netloc
        if not netloc:
            return ""
        scheme = parsed.scheme or "https"
        return f"{scheme}://{netloc}/"
    except Exception:
        return ""


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


def _system_failure_payload(stage: str, reason: str) -> dict:
    return {
        "system_failure": True,
        "system_failure_stage": stage,
        "system_failure_reason": (reason or "")[:500],
    }


# ---------------------------------------------------------------------------
# Email-domain helpers (used by final_contract_builder)
# ---------------------------------------------------------------------------

_FREE_EMAIL_DOMAINS: frozenset = frozenset({
    "gmail.com", "googlemail.com",
    "yahoo.com", "yahoo.co.uk", "yahoo.com.au", "yahoo.fr", "yahoo.de",
    "hotmail.com", "hotmail.co.uk", "hotmail.fr", "hotmail.de",
    "outlook.com", "outlook.co.uk",
    "live.com", "live.co.uk", "msn.com",
    "icloud.com", "me.com", "mac.com",
    "aol.com",
    "protonmail.com", "proton.me",
    "zoho.com",
})


def _is_free_email_provider(email: str) -> bool:
    """Return True when the email belongs to a well-known free/consumer provider."""
    try:
        domain = email.split("@")[1].strip().lower()
        return domain in _FREE_EMAIL_DOMAINS
    except Exception:
        return False


def _is_on_domain_email(email: str, website: str) -> bool:
    """
    Return True when the email is suitable for a 'verified' result.

    1. Must NOT be a free provider (gmail, etc.)
    2. If website/final_url domain is available, must be on-domain.
    3. If no domain is available (unit tests), any non-free email is acceptable.

    Never raises.
    """
    try:
        if not email or "@" not in email:
            return False

        # Always block common free/consumer providers for the 'verified' result
        if _is_free_email_provider(email):
            return False

        # Extract root domain (netloc) from website/final_url
        netloc = ""
        if website:
            try:
                # Use urlparse to get the host, split to remove any port
                netloc = urlparse(website).netloc.lower().split(":")[0]
                if netloc.startswith("www."):
                    netloc = netloc[4:]
            except Exception:
                netloc = ""

        if not netloc:
            # Fallback for unit tests: if we have no site domain to check against,
            # having passed the free-provider check is enough to allow verification.
            return True

        # Enforce strict on-domain match
        email_domain = email.split("@")[1].strip().lower()
        if email_domain.startswith("www."):
            email_domain = email_domain[4:]

        # Match if email domain is exactly equal to site domain, or if site
        # domain is a subdomain of the email domain (info@brand.com vs shop.brand.com).
        return email_domain == netloc or netloc.endswith("." + email_domain)
    except Exception:
        return False


def _site_domain(url: str) -> str:
    """Return normalized site host (without www) from URL string, or empty."""
    try:
        parsed = urlparse(url or "")
        host = (parsed.netloc or "").lower().split(":")[0].strip()
        if host.startswith("www."):
            host = host[4:]
        return host
    except Exception:
        return ""


def _email_domain(email: str) -> str:
    """Return normalized email domain (without www), or empty."""
    try:
        domain = (email.split("@", 1)[1] or "").strip().lower()
        if domain.startswith("www."):
            domain = domain[4:]
        return domain
    except Exception:
        return ""


def _compute_email_safety(
    primary_email: Optional[str],
    final_url: str,
    website: str,
) -> tuple[Optional[bool], Optional[bool], bool]:
    """
    Deterministically derive machine-readable email safety semantics.

    Returns:
      email_on_domain      bool|None
      free_provider_email  bool|None
      outreach_safe_email  bool
    """
    if not primary_email or "@" not in primary_email:
        return None, None, False

    free_provider_email = _is_free_email_provider(primary_email)
    site_host = _site_domain(final_url or website)
    mail_host = _email_domain(primary_email)

    if not site_host:
        email_on_domain = None
    else:
        email_on_domain = bool(
            mail_host
            and (
                mail_host == site_host
                or site_host.endswith("." + mail_host)
            )
        )

    outreach_safe_email = bool(
        free_provider_email is False
        and email_on_domain is True
    )
    return email_on_domain, free_provider_email, outreach_safe_email


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
        return _system_failure_payload("input_preparation", f"exception:{type(exc).__name__}")


# ---------------------------------------------------------------------------
# Node 2 — site_accessibility_check
# ---------------------------------------------------------------------------

def site_accessibility_check(state: VerificationAgentState) -> dict:
    """
    Lightweight HEAD check + WHOIS domain-age lookup.
    Sets: website_alive, accessibility_status, collection_blocked, ssl_valid, final_url,
    status_code, domain_age_years.

    collection_blocked is set to True when accessibility status is blocked or ambiguous.
    A blocked/ambiguous site is NOT the same as a dead site and must not be routed down
    the dead-site shortcut.
    """
    original_url = state.get("website") or ""
    normalized_url = _normalize_url(original_url)
    probe_url = _site_root(normalized_url) or normalized_url
    try:
        result = check_accessibility(probe_url)
        age = get_domain_age(result.get("final_url") or probe_url)
        status = result.get("status")
        accessibility_status = (
            "live" if status in {"live", "redirect"}
            else status if status in {"blocked", "ambiguous", "dead"}
            else "ambiguous"
        )

        # Deep-link leads (e.g. /store-locator) should not hard-fail routing
        # if the front-door probe still comes back dead/ambiguous.
        deep_link_fallback = (
            result.get("live") is False
            and result.get("status") == "dead"
            and probe_url != normalized_url
        )

        output = {
            "website_alive": result["live"],
            "accessibility_status": accessibility_status,
            "collection_blocked": status in {"blocked", "ambiguous"} or deep_link_fallback,
            "ssl_valid": result["ssl_valid"],
            "final_url": result["final_url"],
            "status_code": result.get("status_code"),
            "domain_age_years": age,
            "redirect_detected": result.get("redirect_detected", False),
        }
        if status == "system_error":
            output.update(
                _system_failure_payload(
                    "site_accessibility_check",
                    f"accessibility_{result.get('error_type') or 'unknown_error'}",
                )
            )
            output["collection_blocked"] = True
        return output
    except Exception as exc:
        logger.error("site_accessibility_check FAILED url=%s error=%s", probe_url, exc, exc_info=True)
        return {
            "website_alive": False,
            "accessibility_status": "ambiguous",
            "collection_blocked": True,
            "ssl_valid": False,
            **_system_failure_payload("site_accessibility_check", f"exception:{type(exc).__name__}"),
        }


# ---------------------------------------------------------------------------
# Node 3 — targeted_page_collector
# ---------------------------------------------------------------------------

def targeted_page_collector(state: VerificationAgentState) -> dict:
    """
    Fetch /contact, /about, /wholesale and other priority sub-pages.
    Skips URLs already collected by the Relevancy Agent.
    Sets: full_site_text, homepage_html, contact_page_url, wholesale_page_found,
          wholesale_page_url, collection_blocked.

    Collection always starts from the site root (scheme + netloc), not the
    original deep lead URL.  final_url is preferred because it reflects the
    post-redirect resolved host; website is used as fallback.  Starting from a
    deep path (e.g. /store-locator or /blog/post) would make the collector
    treat that path as the homepage and discover sub-pages relative to it,
    producing misleading homepage_html, wrong identity signals, and missing
    contact/about pages.
    """
    # Resolve to the site root: prefer final_url (post-redirect) over website.
    raw_url = state.get("final_url") or state.get("website") or ""
    url = _site_root(raw_url) or raw_url  # fallback to raw if root extraction fails
    try:
        # Correction 2: already_collected from relevancy artifact — usually empty
        already_collected = set(
            (state.get("relevancy_artifacts") or {})
            .get("collect_sources_output", {})
            .keys()
        )

        result = collect_pages(url, already_collected)

        merged = result.get("merged_text") or ""
        if not merged:
            return {
                "full_site_text": "",
                "collection_blocked": True,
                **_system_failure_payload("collection", "collector returned no text content"),
            }

        collection_blocked = (
            len(result.get("pages_collected") or {}) == 0
            and len(result.get("errors") or []) > 0
        )

        return {
            "full_site_text": merged,
            "homepage_html": result.get("homepage_html"),
            "contact_page_url": result.get("contact_page_url"),
            "wholesale_page_found": result.get("wholesale_page_found", False),
            "wholesale_page_url": result.get("wholesale_page_url"),
            "collection_blocked": collection_blocked,
            "contact_page_html": result.get("contact_page_html"),
            "about_page_html": result.get("about_page_html"),
            "homepage_emails": result.get("homepage_emails") or [],
            "collection_method": result.get("method"),
            "collection_errors": result.get("errors") or [],
        }
    except Exception as exc:
        logger.error("targeted_page_collector FAILED url=%s error=%s", url, exc, exc_info=True)
        return {
            "full_site_text": "",
            "collection_blocked": True,
            "contact_page_html": None,
            "homepage_emails": [],
            "collection_errors": [f"collector_exception:{type(exc).__name__}"],
            **_system_failure_payload("targeted_page_collector", f"exception:{type(exc).__name__}"),
        }


# ---------------------------------------------------------------------------
# Node 4 — contact_extractor
# ---------------------------------------------------------------------------

def contact_extractor(state: VerificationAgentState) -> dict:
    """
    Extract emails, phones, WhatsApp, LinkedIn, social links, contact form flag.

    Runs extract_contacts() on full visible text, then performs a second DOM-aware
    pass over contact_page_html to catch mailto:/tel: hrefs, social link hrefs,
    WhatsApp links, and <form> tags that are stripped from visible text.
    Merges homepage_emails gathered by the collector.
    Falls back to scraped_text_content when full_site_text is unavailable.
    """
    try:
        text = (state.get("full_site_text") or
                state.get("scraped_text_content") or "")

        result = extract_contacts(text, state.get("website") or "")

        contact_html = state.get("contact_page_html") or ""
        homepage_emails = state.get("homepage_emails") or []

        if contact_html:
            try:
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(contact_html, "html.parser")

                # mailto: links
                for a in soup.find_all("a", href=True):
                    href = a["href"]
                    if href.lower().startswith("mailto:"):
                        email = href[7:].split("?")[0].strip().lower()
                        if "@" in email and email not in result["all_emails"]:
                            result["all_emails"].append(email)

                # tel: links
                for a in soup.find_all("a", href=True):
                    href = a["href"]
                    if href.lower().startswith("tel:"):
                        phone = href[4:].strip()
                        if phone and phone not in result["all_phones"]:
                            result["all_phones"].append(phone)

                # LinkedIn company URL
                if not result.get("linkedin_company_url"):
                    for a in soup.find_all("a", href=True):
                        href = a["href"]
                        if "linkedin.com/company/" in href.lower():
                            result["linkedin_company_url"] = href
                            break

                # WhatsApp
                if not result.get("whatsapp_number"):
                    for a in soup.find_all("a", href=True):
                        href = a["href"]
                        if "wa.me/" in href.lower() or "whatsapp.com/" in href.lower():
                            result["whatsapp_number"] = href
                            break

                # Social links from hrefs (more reliable than regex on rendered text)
                _SOCIAL_DOMAINS = {
                    "instagram.com": "instagram",
                    "facebook.com": "facebook",
                    "twitter.com": "twitter",
                    "x.com": "twitter",
                    "tiktok.com": "tiktok",
                    "youtube.com": "youtube",
                    "pinterest.com": "pinterest",
                }
                current_socials = result.get("social_links") or {}
                for a in soup.find_all("a", href=True):
                    href_lower = a["href"].lower()
                    for domain, platform in _SOCIAL_DOMAINS.items():
                        if domain in href_lower and platform not in current_socials:
                            current_socials[platform] = a["href"]
                result["social_links"] = current_socials

                # Contact form detection
                if soup.find("form"):
                    result["contact_form_present"] = True

            except Exception as html_exc:
                logger.warning("contact_extractor html_parse failed: %s", html_exc)

        # Merge homepage_emails into all_emails
        for email in homepage_emails:
            if email and email not in result["all_emails"]:
                result["all_emails"].append(email)

        # Re-rank primary_email after merging all sources
        _EMAIL_RANKS = {
            "buying": ["buying", "wholesale", "trade", "procurement"],
            "sales":  ["sales", "export", "international"],
            "info":   ["info", "contact", "enquiries", "hello", "team", "hi"],
        }
        best_email = None
        best_type = "generic"
        best_score = -1
        for email in result["all_emails"]:
            local = email.split("@")[0].lower()
            for etype, keywords in _EMAIL_RANKS.items():
                if any(k in local for k in keywords):
                    score = {"buying": 3, "sales": 2, "info": 1}[etype]
                    if score > best_score:
                        best_score = score
                        best_email = email
                        best_type = etype
                    break
            else:
                if best_score < 0:
                    best_email = email
                    best_type = "generic"

        if best_email:
            result["primary_email"] = best_email
            result["email_type"] = best_type

        # No email found but a contact form exists — signal this to the Email Agent
        if not result.get("primary_email") and result.get("contact_form_present"):
            result["email_type"] = "form_only"

        # Re-calc confidence after any type re-mapping
        _CONF_MAP = {"buying": 90, "sales": 75, "info": 50, "generic": 30, "form_only": 10}
        result["email_confidence"] = _CONF_MAP.get(result.get("email_type"), 20) if result.get("primary_email") or result.get("email_type") == "form_only" else None

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
            "primary_email": None,
            "email_type": None,
            "email_confidence": 0,
            "all_phones": [],
            "whatsapp_number": None,
            "linkedin_company_url": None,
            "social_links": {},
            "contact_form_present": False,
            **_system_failure_payload("contact_extractor", f"exception:{type(exc).__name__}"),
        }


# ---------------------------------------------------------------------------
# Node 5 — identity_resolver
# ---------------------------------------------------------------------------

def identity_resolver(state: VerificationAgentState) -> dict:
    """
    Fuzzy-match the listed business name against website content.
    Detects country and verifies address presence.

    Raw HTML sources are forwarded to resolve_identity() so that structured
    signals (<title>, schema.org, <h1>, footer copyright) are available even
    though full_site_text is stripped visible text.
    """
    text = state.get("full_site_text") or state.get("scraped_text_content") or ""
    try:
        result = resolve_identity(
            business_name=state.get("business_name") or "",
            website=state.get("website") or "",
            text=text,
            address=state.get("address") or "",
            homepage_html=state.get("homepage_html") or None,
            about_page_html=state.get("about_page_html") or None,
            contact_page_html=state.get("contact_page_html") or None,
        )
        return {
            "company_name_confirmed": result.get("company_name_confirmed"),
            "domain_matches_business": result.get("domain_matches_business"),
            "domain_match_confidence": result.get("domain_match_confidence"),
            "country_confirmed": result.get("country_confirmed"),
            "address_verified": result.get("address_verified"),
        }
    except Exception as exc:
        logger.error("identity_resolver FAILED error=%s", exc, exc_info=True)
        return _system_failure_payload("identity_resolver", f"exception:{type(exc).__name__}")


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
            **_system_failure_payload("business_intelligence_extractor", f"exception:{type(exc).__name__}"),
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
        about_html = state.get("about_page_html") or ""

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
            contact_form_present=state.get("contact_form_present"),
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
        return {
            "legitimacy_score": 0,
            "risk_flags": [],
            **_system_failure_payload("legitimacy_analyzer", f"exception:{type(exc).__name__}"),
        }


# ---------------------------------------------------------------------------
# Node 7.5 — product_catalog_extractor
# ---------------------------------------------------------------------------

def product_catalog_extractor(state: VerificationAgentState) -> dict:
    """
    LLM call to extract product catalog details using both scraped content and SERP enrichment.
    """
    try:
        text = state.get("full_site_text") or state.get("scraped_text_content") or ""
        product_snippets = (state.get("serp_enrichment") or {}).get("product_snippets") or []
        
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        
        prompt = f"""You are analyzing a business website to identify what products this company sells.

Scraped content: {text}
Additional context from web search: {product_snippets}

Return ONLY a JSON object with this exact shape, no other text:
{{
  "product_categories": ["category 1", "category 2"],
  "sells_wholesale": true,
  "primary_customer_type": "B2B",
  "confidence": "high"
}}

Rules:
- product_categories: up to 8 specific plain English categories
- sells_wholesale: true/false
- primary_customer_type: exactly one of "B2B", "B2C", or "Both"
- confidence: exactly one of "high", "medium", or "low"
"""
        
        response = llm.invoke(prompt)
        content = response.content
        
        # Strip markdown fences if present
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        import json
        try:
            parsed_dict = json.loads(content)
            return {"verified_product_catalog": parsed_dict}
        except json.JSONDecodeError as json_exc:
            logger.error("product_catalog_extractor JSON_PARSE_FAILED error=%s", json_exc)
            return {"verified_product_catalog": None}
            
    except Exception as exc:
        logger.error("product_catalog_extractor FAILED error=%s", exc, exc_info=True)
        return _system_failure_payload("product_catalog_extractor", f"exception:{type(exc).__name__}")


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
        return {
            "employee_range": "unknown",
            "revenue_band": "unknown",
            **_system_failure_payload("size_estimator", f"exception:{type(exc).__name__}"),
        }


# ---------------------------------------------------------------------------
# Node 9 — email_context_compiler
# ---------------------------------------------------------------------------

def email_context_compiler(state: VerificationAgentState) -> dict:
    """
    Pure assembly: compile all verified signals into email_context dict for Email Agent.
    No LLM.  Works even when called on the dead-site shortcut path (all inputs may be None).

    Runs AFTER final_contract_builder so that verification_score, verification_result,
    contactability_score, and manual_review are all populated in state.
    """
    try:
        email_context: Dict[str, object] = {
            "company_name":          state.get("company_name_confirmed") or state.get("business_name") or "",
            "company_website":       state.get("final_url") or state.get("website") or "",
            "best_email":            state.get("primary_email"),
            "email_type":            state.get("email_type"),
            "all_emails":            state.get("all_emails") or [],
            "all_phones":            state.get("all_phones") or [],
            "whatsapp":              state.get("whatsapp_number"),
            "linkedin_url":          state.get("linkedin_company_url"),
            "social_links":          state.get("social_links") or {},
            "contact_form_present":  state.get("contact_form_present") or False,
            "wholesale_available":   state.get("wholesale_page_found") or False,
            "wholesale_page_url":    state.get("wholesale_page_url"),
            "business_type":         state.get("business_type"),
            "primary_niche":         state.get("primary_niche"),
            "product_categories":    state.get("product_categories") or [],
            "product_keywords":      state.get("product_keywords") or [],
            "price_positioning":     state.get("price_positioning"),
            "target_customer":       state.get("target_customer"),
            "ecommerce_enabled":     state.get("ecommerce_enabled"),
            "buys_externally":       state.get("buys_externally"),
            "b2b_language_detected": state.get("b2b_language_detected") or False,
            "company_description":   state.get("company_description"),
            "brand_tone":            state.get("brand_tone"),
            "markets_served":        state.get("markets_served") or [],
            "country":               state.get("country_confirmed"),
            "address":               state.get("address"),
            "employee_range":        state.get("employee_range"),
            "revenue_band":          state.get("revenue_band"),
            # These fields are populated by final_contract_builder which now
            # runs before this node, so they will always be non-None here.
            "verification_score":    state.get("verification_score") or 0,
            "verification_result":   state.get("verification_result"),
            "contactability_score":  state.get("contactability_score"),
            "risk_flags":            state.get("risk_flags") or [],
            "custom_prompt":         state.get("custom_prompt"),
            "email_confidence":          state.get("email_confidence"),
            "email_on_domain":           state.get("email_on_domain"),
            "free_provider_email":       state.get("free_provider_email"),
            "outreach_safe_email":       bool(state.get("outreach_safe_email", False)),
            "website_alive":             state.get("website_alive"),
            "domain_match_confidence":   state.get("domain_match_confidence"),
            "verification_reason":       state.get("verification_reason"),
            "domain_matches_business":   state.get("domain_matches_business"),
            "collection_blocked":        state.get("collection_blocked"),
        }
        return {"email_context": email_context}
    except Exception as exc:
        logger.error("email_context_compiler FAILED error=%s", exc, exc_info=True)
        return {
            "email_context": {},
            **_system_failure_payload("email_context_compiler", f"exception:{type(exc).__name__}"),
        }


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
    collection_blocked: bool = False,
    identity_weak: bool = False,
    system_failure: bool = False,
    system_failure_stage: Optional[str] = None,
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
        if system_failure:
            stage = system_failure_stage or "unknown_stage"
            return (
                "Manual review required: verification pipeline had an internal/tool failure "
                f"at {stage}; classify lead only after retry or human confirmation"
            )
        if collection_blocked:
            return (
                "Manual review required: site is bot-protected or blocked; "
                "HTTP access was denied but site may be a real brand"
            )
        if identity_weak:
            conf = (
                f"{domain_match_confidence:.2f}"
                if domain_match_confidence is not None
                else "not determined"
            )
            return (
                f"Manual review required: identity could not be confirmed "
                f"(domain match confidence {conf}; no company name detected in page content)"
            )
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
        # Read raw value first so we can distinguish None (never resolved) from 0.0
        domain_match_confidence_raw = state.get("domain_match_confidence")
        domain_match_confidence = _safe_float(domain_match_confidence_raw, 0.0)
        domain_matches_business = state.get("domain_matches_business")
        website_alive = state.get("website_alive")
        collection_blocked = state.get("collection_blocked") or False
        system_failure = bool(state.get("system_failure"))
        system_failure_stage = state.get("system_failure_stage")
        system_failure_reason = state.get("system_failure_reason")
        ssl_valid = state.get("ssl_valid")
        domain_age_years = state.get("domain_age_years")
        website = state.get("website") or ""
        final_url = state.get("final_url") or ""
        risk_flags = list(state.get("risk_flags") or [])
        email_on_domain, free_provider_email, outreach_safe_email = _compute_email_safety(
            primary_email=primary_email,
            final_url=final_url,
            website=website,
        )

        if system_failure:
            if "system_failure" not in risk_flags:
                risk_flags.append("system_failure")
            if system_failure_stage:
                stage_flag = f"system_failure:{system_failure_stage}"
                if stage_flag not in risk_flags:
                    risk_flags.append(stage_flag)

        # ---- Identity strength / weakness flags ----
        # Strong identity: resolver confirmed the domain matches the listed business
        # with high confidence.  When strong, a missing company_name_confirmed is not
        # enough on its own to force manual_review (the fuzzy match already confirmed
        # the business identity without needing a parsed company name string).
        _identity_strong = (
            domain_match_confidence >= 0.6
            and domain_matches_business is True
        )

        # Weak identity fires on live/unknown-reachability sites only (dead/blocked
        # sites have their own branches below).  Covers:
        #   1. Identity resolver never ran              → confidence is None
        #   2. Resolver ran but match is too weak       → confidence < 0.4
        #   3. Resolver explicitly denied a match       → domain_matches_business is False
        #   4. No company name found AND identity not already strong
        #      (strong identity overrides a missing parsed name string)
        _identity_weak = (
            website_alive is not False          # excludes dead sites (website_alive=False)
            and not collection_blocked          # blocked sites have their own branch
            and (
                domain_match_confidence_raw is None
                or domain_match_confidence < 0.4
                or domain_matches_business is False
                or (not state.get("company_name_confirmed") and not _identity_strong)
            )
        )

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
                "final_contract_builder: verification_score is None for business_id=%s — forcing manual_review",
                state.get("business_id"),
            )
            return {
                "verification_score": 0,
                "verification_result": "manual_review",
                "verification_confidence": 0.0,
                "verification_reason": "Internal error: score computation produced None",
                "manual_review": True,
                "contactability_score": contactability_score,
                "email_on_domain": email_on_domain,
                "free_provider_email": free_provider_email,
                "outreach_safe_email": outreach_safe_email,
                "risk_flags": ["system_failure", "system_failure:final_contract_builder"],
                "system_failure": True,
                "system_failure_stage": "final_contract_builder",
                "system_failure_reason": "score_none_guard",
                "is_finalized": False,
            }

        # ---- Score cap for unsendable leads ----
        # Prevent the numeric score from implying a lead is safely contactable when
        # there is no usable email, contact method is form-only, or identity is weak.
        # Cap at 45 — below any "high confidence" threshold used downstream.
        if primary_email is None or email_type == "form_only" or _identity_weak:
            verification_score = min(verification_score, 45)
        if system_failure:
            verification_score = min(verification_score, 25)

        # ---- Verification result ----
        # Order matters: safety gates (identity_weak, blocked) come before "verified"
        # so that a high legitimacy score alone cannot produce a false positive.
        if system_failure:
            verification_result = "manual_review"
        elif _identity_weak:
            # Site was reachable but we could not confirm which business it belongs to.
            # Never auto-promote to verified or partial; require human review.
            verification_result = "manual_review"
        elif (
            legitimacy_score >= 70
            and primary_email
            and outreach_safe_email
            and domain_match_confidence >= 0.6
        ):
            # Verified requires an on-domain email (excludes free providers implicitly)
            verification_result = "verified"
        elif (
            domain_matches_business is False
            and domain_match_confidence < 0.4
        ):
            # Explicit domain-mismatch from identity resolver (fallback for dead/blocked paths)
            verification_result = "manual_review"
        elif (
            website_alive is False
            and not collection_blocked          # truly dead, not bot-blocked
            and primary_email is None
            and legitimacy_score < 30
        ):
            verification_result = "failed"
        elif collection_blocked and primary_email is None:
            # Bot-protected / Cloudflare-walled: HTTP blocked but site may be a real brand.
            # Never mark as failed; flag for human review so the lead is not discarded.
            verification_result = "manual_review"
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
            collection_blocked=collection_blocked,
            identity_weak=_identity_weak,
            system_failure=system_failure,
            system_failure_stage=system_failure_stage,
        )

        return {
            "contactability_score": contactability_score,
            "verification_score": verification_score,
            "verification_result": verification_result,
            "verification_confidence": verification_confidence,
            "verification_reason": verification_reason,
            "manual_review": manual_review,
            "email_on_domain": email_on_domain,
            "free_provider_email": free_provider_email,
            "outreach_safe_email": outreach_safe_email,
            "risk_flags": risk_flags,
            "system_failure": system_failure,
            "system_failure_stage": system_failure_stage,
            "system_failure_reason": system_failure_reason,
            "is_finalized": True,
        }

    except Exception as exc:
        logger.error("final_contract_builder FAILED error=%s", exc, exc_info=True)
        return {
            "verification_result": "manual_review",
            "verification_score": 0,
            "verification_confidence": 0.0,
            "verification_reason": f"Internal error: {exc}",
            "manual_review": True,
            "contactability_score": 0,
            "email_on_domain": None,
            "free_provider_email": None,
            "outreach_safe_email": False,
            "risk_flags": ["system_failure", "system_failure:final_contract_builder"],
            "system_failure": True,
            "system_failure_stage": "final_contract_builder",
            "system_failure_reason": f"exception:{type(exc).__name__}",
            "is_finalized": True,
        }
