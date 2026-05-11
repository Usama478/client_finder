from __future__ import annotations

"""
legitimacy.py — deterministic legitimacy scorer.

Pure logic only.  No HTTP, no Playwright, no LLM.
Scores 11 signals up to a maximum of 100 points.
"""

import re
from typing import List, Optional

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Free / consumer email domains that indicate no domain email
_FREE_EMAIL_DOMAINS = frozenset({
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
    "yahoo.co.uk", "hotmail.co.uk", "live.com", "icloud.com",
    "me.com", "aol.com", "mail.com", "protonmail.com",
    "zohomail.com", "yandex.com", "yandex.ru",
})

# About-page signals
_ABOUT_KEYWORDS = ("about us", "our story", "who we are", "founded in",
                   "our mission", "our history")
_POLICY_PRIVACY_RE = re.compile(r'privacy\s+policy', re.IGNORECASE)
_POLICY_TERMS_RE   = re.compile(
    r'terms\s+(?:of\s+service|&\s*conditions|and\s+conditions)', re.IGNORECASE
)

# Physical address heuristic: a street number followed by a word, or schema.org
_STREET_RE = re.compile(
    r'\b\d{1,5}\s+[A-Za-z][A-Za-z\s]{2,30}(?:Street|St|Avenue|Ave|Road|Rd|'
    r'Lane|Ln|Drive|Dr|Boulevard|Blvd|Way|Close|Crescent|Place|Pl)\b',
    re.IGNORECASE,
)
_SCHEMA_STREET_RE = re.compile(r'"streetAddress"\s*:\s*"[^"]{3,}"', re.IGNORECASE)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_domain_email(email_found: Optional[str]) -> bool:
    """Return True if email_found exists and is NOT a free/consumer domain."""
    if not email_found:
        return False
    domain = email_found.lower().split("@", 1)[-1]
    return domain not in _FREE_EMAIL_DOMAINS


_CITY_STATE_RE = re.compile(
    r'\b([A-Z][a-zA-Z\s]{2,25}),\s*([A-Z]{2})\b'
)

def _has_physical_address(text: str) -> bool:
    if _STREET_RE.search(text) or _SCHEMA_STREET_RE.search(text):
        return True
    # Fallback: city + US state abbreviation (e.g. "Houston, TX")
    return bool(_CITY_STATE_RE.search(text))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def compute_legitimacy(
    text: str,
    about_html: str = "",
    contact_html: str = "",
    email_found: Optional[str] = None,
    phone_found: Optional[str] = None,
    social_count: int = 0,
    ssl_valid: bool = False,
    website_live: bool = False,
    domain_age_years: Optional[int] = None,
    contact_form_present: Optional[bool] = None,
) -> dict:
    """
    Score 11 legitimacy signals deterministically.

    Parameters
    ----------
    text            : Combined site text (homepage + subpages).
    about_html      : Raw HTML of the About page (empty string if not fetched).
    contact_html    : Raw HTML of the Contact page (empty string if not fetched).
    email_found     : Primary email address (None if not found).
    phone_found     : Any phone number found (None if not found).
    social_count    : Number of distinct social media profiles found.
    ssl_valid       : True if the site was served over valid HTTPS.
    website_live    : True if the site responded with a 2xx/3xx status.
    domain_age_years: Integer age of the domain in years (None = unknown).

    Returns
    -------
    dict with keys:
        legitimacy_score, has_about_page, has_contact_page,
        has_policy_pages, has_physical_address, risk_flags
    """
    score = 0
    risk_flags: List[str] = []
    lower_text = text.lower()

    # ---- Signal 1: SSL valid (+10) ----
    if ssl_valid:
        score += 10

    # ---- Signal 2: Website live (+10) ----
    if website_live:
        score += 10
    else:
        risk_flags.append("website unreachable during verification")

    # ---- Signal 3: About page (+10) ----
    has_about_page = bool(about_html) or any(kw in lower_text for kw in _ABOUT_KEYWORDS)
    if has_about_page:
        score += 10

    # ---- Signal 4: Contact page (+8) ----
    has_contact_page = bool(contact_html)
    if has_contact_page:
        score += 8

    # ---- Signal 5: Domain email (+10) ----
    has_domain_email = _is_domain_email(email_found)
    if has_domain_email:
        score += 10
    else:
        risk_flags.append("no domain email found")

    # ---- Signal 5b: Contact form present (+5, only if no domain email) ----
    if not has_domain_email and contact_form_present:
        score += 5

    # ---- Signal 6: Phone present (+8) ----
    if phone_found:
        score += 8

    # ---- Signal 7: Physical address (+8) ----
    physical_present = _has_physical_address(text)
    if physical_present:
        score += 8
    else:
        risk_flags.append("no physical address confirmed")

    # ---- Signal 8: Privacy policy (+8) ----
    has_privacy = bool(_POLICY_PRIVACY_RE.search(text))
    if has_privacy:
        score += 8
    else:
        risk_flags.append("no privacy policy detected")

    # ---- Signal 9: Terms page (+5) ----
    has_terms = bool(_POLICY_TERMS_RE.search(text))
    if has_terms:
        score += 5

    has_policy_pages = has_privacy or has_terms

    # ---- Signal 10: Social media presence (+8) ----
    if social_count >= 1:
        score += 8

    # ---- Signal 11: Domain age >= 2 years (+6) ----
    if domain_age_years is not None and domain_age_years >= 2:
        score += 6
    elif domain_age_years is not None and domain_age_years < 1:
        risk_flags.append("domain is less than 1 year old")

    return {
        "legitimacy_score": min(score, 100),
        "has_about_page": has_about_page,
        "has_contact_page": has_contact_page,
        "has_policy_pages": has_policy_pages,
        "has_physical_address": physical_present,
        "risk_flags": risk_flags,
    }
