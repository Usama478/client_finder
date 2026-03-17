from __future__ import annotations

"""
identity.py — deterministic business identity resolver.

Pure logic only.  No HTTP, no Playwright, no LLM.
"""

import json
import re
from difflib import SequenceMatcher
from typing import Any, List, Optional
from urllib.parse import urlparse

# ---------------------------------------------------------------------------
# Country name → ISO-3166-1 alpha-2 normalization
# ---------------------------------------------------------------------------

_COUNTRY_TO_ISO2: dict[str, str] = {
    "germany":              "DE",
    "france":               "FR",
    "italy":                "IT",
    "spain":                "ES",
    "netherlands":          "NL",
    "canada":               "CA",
    "australia":            "AU",
    "united kingdom":       "GB",
    "ireland":              "IE",
    "new zealand":          "NZ",
    "south africa":         "ZA",
    "india":                "IN",
    "pakistan":             "PK",
    "united arab emirates": "AE",
    "singapore":            "SG",
    "malaysia":             "MY",
    "hong kong":            "HK",
    "japan":                "JP",
    "china":                "CN",
    "brazil":               "BR",
    "mexico":               "MX",
    "portugal":             "PT",
    "belgium":              "BE",
    "switzerland":          "CH",
    "austria":              "AT",
    "sweden":               "SE",
    "norway":               "NO",
    "denmark":              "DK",
    "finland":              "FI",
    "poland":               "PL",
    "czech republic":       "CZ",
    "czechia":              "CZ",
    "hungary":              "HU",
    "romania":              "RO",
    "turkey":               "TR",
    "united states":        "US",
    "usa":                  "US",
}


def _to_iso2(value: str) -> str:
    """
    Normalize a country string to ISO-3166-1 alpha-2.

    If *value* is already a 2-character string it is returned uppercased
    (assumed to be an ISO code already, e.g. from schema.org addressCountry).
    Otherwise the full-name lookup in ``_COUNTRY_TO_ISO2`` is attempted.
    If neither succeeds the original value is returned unchanged so callers
    never lose information.
    """
    stripped = value.strip()
    if len(stripped) == 2:
        return stripped.upper()
    return _COUNTRY_TO_ISO2.get(stripped.lower(), stripped)


# ---------------------------------------------------------------------------
# TLD → country mapping (ISO-3166-1 alpha-2)
# ---------------------------------------------------------------------------

_TLD_COUNTRY: dict[str, str] = {
    ".de":     "DE",
    ".fr":     "FR",
    ".it":     "IT",
    ".es":     "ES",
    ".nl":     "NL",
    ".ca":     "CA",
    ".com.au": "AU",
    ".co.uk":  "GB",
    ".uk":     "GB",
    ".ie":     "IE",
    ".nz":     "NZ",
    ".co.nz":  "NZ",
    ".za":     "ZA",
    ".co.za":  "ZA",
    ".in":     "IN",
    ".co.in":  "IN",
    ".pk":     "PK",
    ".ae":     "AE",
    ".sg":     "SG",
    ".com.sg": "SG",
    ".my":     "MY",
    ".com.my": "MY",
    ".hk":     "HK",
    ".com.hk": "HK",
    ".jp":     "JP",
    ".co.jp":  "JP",
    ".cn":     "CN",
    ".br":     "BR",
    ".com.br": "BR",
    ".mx":     "MX",
    ".com.mx": "MX",
    ".pt":     "PT",
    ".be":     "BE",
    ".ch":     "CH",
    ".at":     "AT",
    ".se":     "SE",
    ".no":     "NO",
    ".dk":     "DK",
    ".fi":     "FI",
    ".pl":     "PL",
    ".cz":     "CZ",
    ".hu":     "HU",
    ".ro":     "RO",
    ".tr":     "TR",
    ".com.tr": "TR",
}

# Country name patterns for text scanning — values are ISO-3166-1 alpha-2.
# Order matters: more specific multi-word names must come before shorter ones.
_COUNTRY_TEXT_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r'\bUnited Arab Emirates\b', re.IGNORECASE), "AE"),
    (re.compile(r'\bUnited Kingdom\b',       re.IGNORECASE), "GB"),
    (re.compile(r'\bNew Zealand\b',          re.IGNORECASE), "NZ"),
    (re.compile(r'\bSouth Africa\b',         re.IGNORECASE), "ZA"),
    (re.compile(r'\bAustralia\b',            re.IGNORECASE), "AU"),
    (re.compile(r'\bCanada\b',               re.IGNORECASE), "CA"),
    (re.compile(r'\bGermany\b',              re.IGNORECASE), "DE"),
    (re.compile(r'\bFrance\b',               re.IGNORECASE), "FR"),
    (re.compile(r'\bItaly\b',                re.IGNORECASE), "IT"),
    (re.compile(r'\bSpain\b',                re.IGNORECASE), "ES"),
    (re.compile(r'\bNetherlands\b',          re.IGNORECASE), "NL"),
    (re.compile(r'\bIreland\b',              re.IGNORECASE), "IE"),
    (re.compile(r'\bIndia\b',                re.IGNORECASE), "IN"),
    (re.compile(r'\bPakistan\b',             re.IGNORECASE), "PK"),
    (re.compile(r'\bSingapore\b',            re.IGNORECASE), "SG"),
    (re.compile(r'\bMalaysia\b',             re.IGNORECASE), "MY"),
    (re.compile(r'\bHong Kong\b',            re.IGNORECASE), "HK"),
    (re.compile(r'\bJapan\b',                re.IGNORECASE), "JP"),
    (re.compile(r'\bChina\b',                re.IGNORECASE), "CN"),
    (re.compile(r'\bBrazil\b',               re.IGNORECASE), "BR"),
    (re.compile(r'\bMexico\b',               re.IGNORECASE), "MX"),
    (re.compile(r'\bPortugal\b',             re.IGNORECASE), "PT"),
    (re.compile(r'\bBelgium\b',              re.IGNORECASE), "BE"),
    (re.compile(r'\bSwitzerland\b',          re.IGNORECASE), "CH"),
    (re.compile(r'\bAustria\b',              re.IGNORECASE), "AT"),
    (re.compile(r'\bSweden\b',               re.IGNORECASE), "SE"),
    (re.compile(r'\bNorway\b',               re.IGNORECASE), "NO"),
    (re.compile(r'\bDenmark\b',              re.IGNORECASE), "DK"),
    (re.compile(r'\bFinland\b',              re.IGNORECASE), "FI"),
    (re.compile(r'\bPoland\b',               re.IGNORECASE), "PL"),
    (re.compile(r'\bTurkey\b',               re.IGNORECASE), "TR"),
    (re.compile(r'\bUSA\b|\bUnited States\b', re.IGNORECASE), "US"),
]

# schema.org address country
_SCHEMA_COUNTRY_RE = re.compile(
    r'"addressCountry"\s*:\s*"([^"]{2,})"', re.IGNORECASE
)

# Extracts every <script type="application/ld+json"> block from raw HTML so
# we can parse it with json.loads instead of relying on a fragile regex.
# Real-world schema.org blocks nest sub-objects (address, contactPoint, etc.)
# before the "name" field, each containing "}" characters that a [^}] regex
# class cannot cross.
_JSONLD_SCRIPT_RE = re.compile(
    r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
    re.IGNORECASE | re.DOTALL,
)

_TITLE_RE = re.compile(r'<title[^>]*>([^<]+)</title>', re.IGNORECASE)
_H1_RE = re.compile(r'<h1[^>]*>([^<]+)</h1>', re.IGNORECASE)
_COPYRIGHT_RE = re.compile(
    r'©\s*\d{4}\s+([A-Za-z0-9 &,.\-]+?)(?:\.|,|<|\s{2,}|$)', re.IGNORECASE
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _find_org_name_in_jsonld(data: Any) -> Optional[str]:
    """
    Recursively walk a parsed JSON-LD structure and return the ``name`` of the
    first node whose ``@type`` is ``"Organization"`` (case-insensitive).

    Handles both plain dicts and lists (e.g. ``@graph`` arrays).
    """
    if isinstance(data, dict):
        type_val = data.get("@type", "")
        types = (
            [type_val] if isinstance(type_val, str) else type_val
            if isinstance(type_val, list) else []
        )
        if any(isinstance(t, str) and t.lower() == "organization" for t in types):
            name = data.get("name")
            if isinstance(name, str) and name.strip():
                return name.strip()
        for v in data.values():
            result = _find_org_name_in_jsonld(v)
            if result:
                return result
    elif isinstance(data, list):
        for item in data:
            result = _find_org_name_in_jsonld(item)
            if result:
                return result
    return None


def _extract_jsonld_org_name(html: str) -> Optional[str]:
    """
    Parse every ``<script type="application/ld+json">`` block in *html* and
    return the Organization name from the first block that contains one.

    Falls back to ``None`` if no valid block is found or none declares an
    Organization with a non-empty name.
    """
    for m in _JSONLD_SCRIPT_RE.finditer(html):
        raw = m.group(1).strip()
        try:
            data = json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            continue
        name = _find_org_name_in_jsonld(data)
        if name:
            return name
    return None


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
    1. schema.org Organization name (parsed from JSON-LD <script> blocks)
    2. <title> tag
    3. <h1> tag
    4. copyright footer
    """
    # 1. schema.org — parse JSON-LD properly so nested sub-objects (address,
    #    contactPoint, etc.) do not break extraction.
    name = _extract_jsonld_org_name(text)
    if name:
        return name

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
    # 1. schema.org — addressCountry may be an ISO code ("US") or a full name
    #    ("United States"). Normalise both paths to ISO-3166-1 alpha-2.
    m = _SCHEMA_COUNTRY_RE.search(text)
    if m:
        val = m.group(1).strip()
        if val:
            return _to_iso2(val)

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

    if ratio > 0.7:
        domain_matches_business = True
        domain_match_confidence = 0.9
    elif ratio >= 0.4:
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
