from __future__ import annotations

"""
contact_extract.py — deterministic contact extraction.

Pure logic only.  No HTTP, no Playwright, no LLM.
Accepts raw text / HTML, returns a structured dict.
"""

import re
from typing import Dict, List, Optional
from urllib.parse import urljoin, urlparse

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
_MAILTO_RE = re.compile(r'mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})', re.IGNORECASE)

# Noise extensions that sometimes appear in malformed scraped text
_EMAIL_NOISE_EXT_RE = re.compile(r'\.(png|jpg|jpeg|gif|css|js|svg|webp)$', re.IGNORECASE)
# Noise prefixes / hostnames to discard
_EMAIL_NOISE_PREFIXES = ("noreply@", "no-reply@", "donotreply@")
_EMAIL_NOISE_DOMAINS = ("example.com", "example.org", "test.com", "sentry.io",
                         "email.com", "email.net")

# Phone — broad international pattern; we accept +xx prefixes and local formats
# Covers +44, +1, +92, +971, etc.
_PHONE_RE = re.compile(
    r'(?:\+[1-9]\d{0,3}[\s\-.]?)?\(?\d{2,4}\)?[\s\-.]?\d{3,5}[\s\-.]?\d{3,5}'
)
# Must contain at least 7 digits overall to be a real phone number
_PHONE_DIGIT_MIN = 7

_WHATSAPP_RE = re.compile(r'(?:wa\.me|whatsapp\.com/send[?]phone=|whatsapp\.com/)[\s/"\']*(\+?[0-9]{7,15})', re.IGNORECASE)
_LINKEDIN_CO_RE = re.compile(r'linkedin\.com/company/([a-zA-Z0-9\-]+)', re.IGNORECASE)

_SOCIAL_PATTERNS: List[tuple[str, re.Pattern]] = [
    ("instagram", re.compile(r'(?:https?://)?(?:www\.)?instagram\.com/[a-zA-Z0-9_.]+/?', re.IGNORECASE)),
    ("facebook",  re.compile(r'(?:https?://)?(?:www\.)?facebook\.com/[a-zA-Z0-9_.]+/?', re.IGNORECASE)),
    ("twitter",   re.compile(r'(?:https?://)?(?:www\.)?twitter\.com/[a-zA-Z0-9_]+/?', re.IGNORECASE)),
    ("x",         re.compile(r'(?:https?://)?(?:www\.)?x\.com/[a-zA-Z0-9_]+/?', re.IGNORECASE)),
    ("tiktok",    re.compile(r'(?:https?://)?(?:www\.)?tiktok\.com/@[a-zA-Z0-9_.]+/?', re.IGNORECASE)),
    ("youtube",   re.compile(r'(?:https?://)?(?:www\.)?youtube\.com/(?:c/|user/|@)?[a-zA-Z0-9_\-]+/?', re.IGNORECASE)),
]

_CONTACT_FORM_PHRASES = ("send us a message", "fill in the form", "get in touch",
                          "contact form", "submit your enquiry", "send a message")

# Email ranking: (list_of_keywords_in_local_part, type_label, confidence)
_EMAIL_RANK: List[tuple[tuple[str, ...], str, int]] = [
    (("buying", "wholesale", "trade", "procurement"), "buying", 90),
    (("sales", "export", "international"),            "sales",  75),
    (("hello", "team", "hi"),                         "hello",  60),
    (("info", "contact", "enquiries", "enquiry",
      "support", "help"),                             "info",   50),
]
_EMAIL_TYPE_GENERIC = "generic"
_EMAIL_CONF_GENERIC = 30


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _digits_only(s: str) -> str:
    return re.sub(r'\D', '', s)


def _is_noise_email(email: str) -> bool:
    low = email.lower()
    if any(low.startswith(p) for p in _EMAIL_NOISE_PREFIXES):
        return True
    domain = low.split("@", 1)[-1]
    if domain in _EMAIL_NOISE_DOMAINS:
        return True
    if _EMAIL_NOISE_EXT_RE.search(low):
        return True
    return False


def _rank_email(email: str) -> tuple[int, str, int]:
    """Return (rank_priority, type_label, confidence) — lower priority = better."""
    local = email.split("@", 1)[0].lower()
    for idx, (keywords, label, conf) in enumerate(_EMAIL_RANK):
        if any(kw in local for kw in keywords):
            return (idx, label, conf)
    return (len(_EMAIL_RANK), _EMAIL_TYPE_GENERIC, _EMAIL_CONF_GENERIC)


def _normalise_url(href: str, base_url: str) -> str:
    href = href.strip().rstrip("/")
    if href.startswith("http"):
        return href
    return urljoin(base_url, href).rstrip("/")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_contacts(text: str, base_url: str = "") -> dict:
    """
    Extract all contact signals from raw text / HTML.

    Parameters
    ----------
    text     : Raw text or HTML content (homepage + contact page combined).
    base_url : The canonical URL of the site, used to resolve relative hrefs.

    Returns
    -------
    dict with keys:
        all_emails, primary_email, email_type, email_confidence,
        all_phones, whatsapp_number, linkedin_company_url,
        social_links, contact_form_present
    """
    # ------------------------------------------------------------------ #
    # Emails                                                              #
    # ------------------------------------------------------------------ #
    raw_emails: List[str] = []

    # From mailto: href attributes (highest fidelity)
    raw_emails.extend(_MAILTO_RE.findall(text))
    # From plain text / rendered content
    raw_emails.extend(_EMAIL_RE.findall(text))

    seen_emails: set[str] = set()
    clean_emails: List[str] = []
    for e in raw_emails:
        low = e.lower()
        if low in seen_emails:
            continue
        seen_emails.add(low)
        if not _is_noise_email(low):
            clean_emails.append(low)

    # Sort by rank (ascending priority index = best first)
    clean_emails.sort(key=lambda e: _rank_email(e)[0])

    primary_email: Optional[str] = clean_emails[0] if clean_emails else None
    if primary_email:
        _, email_type, email_confidence = _rank_email(primary_email)
    else:
        email_type = None
        email_confidence = None

    # ------------------------------------------------------------------ #
    # Phones                                                              #
    # ------------------------------------------------------------------ #
    raw_phones = _PHONE_RE.findall(text)
    seen_phones: set[str] = set()
    clean_phones: List[str] = []
    for p in raw_phones:
        digits = _digits_only(p)
        if len(digits) < _PHONE_DIGIT_MIN:
            continue
        normed = p.strip()
        if normed not in seen_phones:
            seen_phones.add(normed)
            clean_phones.append(normed)

    # ------------------------------------------------------------------ #
    # WhatsApp                                                            #
    # ------------------------------------------------------------------ #
    wa_match = _WHATSAPP_RE.search(text)
    whatsapp_number: Optional[str] = None
    if wa_match:
        num = wa_match.group(1)
        if not num.startswith("+"):
            num = "+" + num
        whatsapp_number = num

    # ------------------------------------------------------------------ #
    # LinkedIn company page                                               #
    # ------------------------------------------------------------------ #
    li_match = _LINKEDIN_CO_RE.search(text)
    linkedin_company_url: Optional[str] = None
    if li_match:
        slug = li_match.group(1)
        linkedin_company_url = f"https://www.linkedin.com/company/{slug}"

    # ------------------------------------------------------------------ #
    # Social links                                                        #
    # ------------------------------------------------------------------ #
    social_links: Dict[str, str] = {}
    for platform, pattern in _SOCIAL_PATTERNS:
        match = pattern.search(text)
        if match:
            url = match.group(0).strip()
            if not url.startswith("http"):
                url = "https://" + url.lstrip("/")
            social_links[platform] = url.rstrip("/")

    # ------------------------------------------------------------------ #
    # Contact form                                                        #
    # ------------------------------------------------------------------ #
    lower_text = text.lower()
    has_form_tag = bool(re.search(r'<form[\s>]', text, re.IGNORECASE))
    has_phrase = any(phrase in lower_text for phrase in _CONTACT_FORM_PHRASES)
    contact_form_present = has_form_tag or has_phrase

    return {
        "all_emails": clean_emails,
        "primary_email": primary_email,
        "email_type": email_type,
        "email_confidence": email_confidence,
        "all_phones": clean_phones,
        "whatsapp_number": whatsapp_number,
        "linkedin_company_url": linkedin_company_url,
        "social_links": social_links,
        "contact_form_present": contact_form_present,
    }
