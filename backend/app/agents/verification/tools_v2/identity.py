from __future__ import annotations

"""
identity.py — deterministic business identity resolver.

Pure logic only.  No HTTP, no Playwright, no LLM.
"""

import re
from difflib import SequenceMatcher
from typing import List, Optional
from urllib.parse import urlparse

# ---------------------------------------------------------------------------
# TLD → country mapping
# ---------------------------------------------------------------------------

_TLD_COUNTRY: dict[str, str] = {
    ".de":     "Germany",
    ".fr":     "France",
    ".it":     "Italy",
    ".es":     "Spain",
    ".nl":     "Netherlands",
    ".ca":     "Canada",
    ".com.au": "Australia",
    ".co.uk":  "United Kingdom",
    ".uk":     "United Kingdom",
    ".ie":     "Ireland",
    ".nz":     "New Zealand",
    ".co.nz":  "New Zealand",
    ".za":     "South Africa",
    ".co.za":  "South Africa",
    ".in":     "India",
    ".co.in":  "India",
    ".pk":     "Pakistan",
    ".ae":     "United Arab Emirates",
    ".sg":     "Singapore",
    ".com.sg": "Singapore",
    ".my":     "Malaysia",
    ".com.my": "Malaysia",
    ".hk":     "Hong Kong",
    ".com.hk": "Hong Kong",
    ".jp":     "Japan",
    ".co.jp":  "Japan",
    ".cn":     "China",
    ".br":     "Brazil",
    ".com.br": "Brazil",
    ".mx":     "Mexico",
    ".com.mx": "Mexico",
    ".pt":     "Portugal",
    ".be":     "Belgium",
    ".ch":     "Switzerland",
    ".at":     "Austria",
    ".se":     "Sweden",
    ".no":     "Norway",
    ".dk":     "Denmark",
    ".fi":     "Finland",
    ".pl":     "Poland",
    ".cz":     "Czech Republic",
    ".hu":     "Hungary",
    ".ro":     "Romania",
    ".tr":     "Turkey",
    ".com.tr": "Turkey",
}

# Full country name patterns for text scanning (order matters — more specific first)
_COUNTRY_TEXT_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r'\bUnited Arab Emirates\b', re.IGNORECASE), "United Arab Emirates"),
    (re.compile(r'\bUnited Kingdom\b',       re.IGNORECASE), "United Kingdom"),
    (re.compile(r'\bNew Zealand\b',          re.IGNORECASE), "New Zealand"),
    (re.compile(r'\bSouth Africa\b',         re.IGNORECASE), "South Africa"),
    (re.compile(r'\bAustralia\b',            re.IGNORECASE), "Australia"),
    (re.compile(r'\bCanada\b',               re.IGNORECASE), "Canada"),
    (re.compile(r'\bGermany\b',              re.IGNORECASE), "Germany"),
    (re.compile(r'\bFrance\b',               re.IGNORECASE), "France"),
    (re.compile(r'\bItaly\b',                re.IGNORECASE), "Italy"),
    (re.compile(r'\bSpain\b',                re.IGNORECASE), "Spain"),
    (re.compile(r'\bNetherlands\b',          re.IGNORECASE), "Netherlands"),
    (re.compile(r'\bIreland\b',              re.IGNORECASE), "Ireland"),
    (re.compile(r'\bIndia\b',                re.IGNORECASE), "India"),
    (re.compile(r'\bPakistan\b',             re.IGNORECASE), "Pakistan"),
    (re.compile(r'\bSingapore\b',            re.IGNORECASE), "Singapore"),
    (re.compile(r'\bMalaysia\b',             re.IGNORECASE), "Malaysia"),
    (re.compile(r'\bHong Kong\b',            re.IGNORECASE), "Hong Kong"),
    (re.compile(r'\bJapan\b',               re.IGNORECASE), "Japan"),
    (re.compile(r'\bChina\b',               re.IGNORECASE), "China"),
    (re.compile(r'\bBrazil\b',              re.IGNORECASE), "Brazil"),
    (re.compile(r'\bMexico\b',              re.IGNORECASE), "Mexico"),
    (re.compile(r'\bPortugal\b',            re.IGNORECASE), "Portugal"),
    (re.compile(r'\bBelgium\b',             re.IGNORECASE), "Belgium"),
    (re.compile(r'\bSwitzerland\b',         re.IGNORECASE), "Switzerland"),
    (re.compile(r'\bAustria\b',             re.IGNORECASE), "Austria"),
    (re.compile(r'\bSweden\b',              re.IGNORECASE), "Sweden"),
    (re.compile(r'\bNorway\b',              re.IGNORECASE), "Norway"),
    (re.compile(r'\bDenmark\b',             re.IGNORECASE), "Denmark"),
    (re.compile(r'\bFinland\b',             re.IGNORECASE), "Finland"),
    (re.compile(r'\bPoland\b',              re.IGNORECASE), "Poland"),
    (re.compile(r'\bTurkey\b',              re.IGNORECASE), "Turkey"),
    (re.compile(r'\bUSA\b|\bUnited States\b', re.IGNORECASE), "United States"),
]

# schema.org address country
_SCHEMA_COUNTRY_RE = re.compile(
    r'"addressCountry"\s*:\s*"([^"]{2,})"', re.IGNORECASE
)
_SCHEMA_ORG_NAME_RE = re.compile(
    r'"@type"\s*:\s*"Organization"[^}]*?"name"\s*:\s*"([^"]+)"', re.IGNORECASE | re.DOTALL
)
_TITLE_RE = re.compile(r'<title[^>]*>([^<]+)</title>', re.IGNORECASE)
_H1_RE = re.compile(r'<h1[^>]*>([^<]+)</h1>', re.IGNORECASE)
_COPYRIGHT_RE = re.compile(
    r'©\s*\d{4}\s+([A-Za-z0-9 &,.\-]+?)(?:\.|,|<|\s{2,}|$)', re.IGNORECASE
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _strip_tags(html: str) -> str:
    """Remove HTML tags and decode common entities."""
    clean = re.sub(r'<[^>]+>', ' ', html)
    clean = clean.replace('&amp;', '&').replace('&nbsp;', ' ')
    return clean.strip()


def _fuzzy_ratio(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


def _extract_company_name(text: str) -> Optional[str]:
    """
    Try to extract the company name from the page content in priority order:
    1. schema.org Organization name
    2. <title> tag
    3. <h1> tag
    4. copyright footer
    """
    # 1. schema.org
    m = _SCHEMA_ORG_NAME_RE.search(text)
    if m:
        return m.group(1).strip()

    # 2. <title>
    m = _TITLE_RE.search(text)
    if m:
        raw = _strip_tags(m.group(1))
        # Titles often have "Brand Name | Tagline" — take the first segment
        for sep in ("|", "–", "-", "·", "•"):
            if sep in raw:
                raw = raw.split(sep)[0].strip()
                break
        if raw:
            return raw

    # 3. <h1>
    m = _H1_RE.search(text)
    if m:
        raw = _strip_tags(m.group(1)).strip()
        if raw:
            return raw

    # 4. Copyright
    m = _COPYRIGHT_RE.search(text)
    if m:
        raw = m.group(1).strip()
        if raw:
            return raw

    return None


def _detect_country(text: str, website: str) -> Optional[str]:
    """
    Detect country in priority order:
    1. schema.org addressCountry
    2. Country name in text
    3. Domain TLD
    """
    # 1. schema.org
    m = _SCHEMA_COUNTRY_RE.search(text)
    if m:
        val = m.group(1).strip()
        # ISO-3166-1 alpha-2 or full name — return as-is
        if val:
            return val

    # 2. Country names in text
    for pattern, country in _COUNTRY_TEXT_PATTERNS:
        if pattern.search(text):
            return country

    # 3. TLD
    try:
        netloc = urlparse(website).netloc.lower()
        # Strip www prefix
        if netloc.startswith("www."):
            netloc = netloc[4:]
        # Check multi-level TLDs first (.com.au, .co.uk, etc.)
        for tld, country in _TLD_COUNTRY.items():
            if netloc.endswith(tld):
                return country
    except Exception:
        pass

    return None


def _address_in_text(address: Optional[str], text: str) -> bool:
    """Return True if any significant token from address appears in text."""
    if not address:
        return False
    lower_text = text.lower()
    # Split on commas and whitespace, take tokens longer than 3 chars
    tokens = [t.strip() for t in re.split(r'[,\s]+', address) if len(t.strip()) > 3]
    if not tokens:
        return False
    matches = sum(1 for t in tokens if t.lower() in lower_text)
    # At least 2 tokens, or 50% of tokens, must match
    return matches >= 2 or (len(tokens) > 0 and matches / len(tokens) >= 0.5)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def resolve_identity(
    business_name: str,
    website: str,
    text: str,
    address: Optional[str] = None,
    homepage_html: Optional[str] = None,
    about_page_html: Optional[str] = None,
    contact_page_html: Optional[str] = None,
) -> dict:
    """
    Resolve identity signals from page content.

    Raw HTML sources (homepage_html, about_page_html, contact_page_html) are
    tried first for structured extraction (<title>, <h1>, schema.org, footer
    copyright) because they carry tags that are stripped from visible text.
    Plain text is used as a fallback and for address/country pattern matching.

    Parameters
    ----------
    business_name    : The name from the lead record (DB input).
    website          : The canonical URL.
    text             : Cleaned visible text (stripped of HTML tags).
    address          : Optional address from the lead record.
    homepage_html    : Raw HTML of the root homepage.
    about_page_html  : Raw HTML of the about page (if collected).
    contact_page_html: Raw HTML of the contact page (if collected).

    Returns
    -------
    dict with keys:
        company_name_confirmed, domain_matches_business,
        domain_match_confidence, country_confirmed,
        address_verified, notes
    """
    notes: List[str] = []

    # Build an ordered list of HTML sources richest in identity signals.
    # homepage_html is the highest priority; about page is next.
    # contact_page_html is included last as a fallback name source.
    _html_sources: List[str] = [
        s for s in (homepage_html, about_page_html, contact_page_html) if s
    ]

    # ---- Company name ----
    # Try each raw HTML source in priority order before falling back to
    # plain text.  HTML retains <title>, schema.org JSON-LD, <h1>, and
    # footer copyright markers that are erased during tag-stripping.
    company_name_confirmed: Optional[str] = None
    for _html in _html_sources:
        company_name_confirmed = _extract_company_name(_html)
        if company_name_confirmed:
            break
    if not company_name_confirmed:
        company_name_confirmed = _extract_company_name(text)

    # ---- Fuzzy match ----
    compare_name = company_name_confirmed or ""
    ratio = _fuzzy_ratio(business_name, compare_name) if compare_name else 0.0

    if ratio > 0.8:
        domain_matches_business = True
        domain_match_confidence = 0.9
    elif ratio >= 0.5:
        domain_matches_business = True
        domain_match_confidence = 0.6
    else:
        domain_matches_business = False
        domain_match_confidence = 0.2

    if domain_match_confidence < 0.4:
        notes.append(
            f"Low domain match confidence ({domain_match_confidence:.2f}): "
            f"listed name '{business_name}' vs. detected name '{compare_name or 'not found'}'"
        )

    # ---- Country ----
    # schema.org addressCountry lives inside JSON-LD in the raw HTML; try HTML
    # sources first, then fall back to plain text + TLD heuristic.
    country_confirmed: Optional[str] = None
    for _html in _html_sources:
        country_confirmed = _detect_country(_html, website)
        if country_confirmed:
            break
    if not country_confirmed:
        country_confirmed = _detect_country(text, website)

    # ---- Address verification ----
    # Plain visible text is sufficient here (addresses appear as rendered text).
    address_verified = _address_in_text(address, text)

    return {
        "company_name_confirmed": company_name_confirmed,
        "domain_matches_business": domain_matches_business,
        "domain_match_confidence": domain_match_confidence,
        "country_confirmed": country_confirmed,
        "address_verified": address_verified,
        "notes": notes,
    }
