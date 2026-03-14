from __future__ import annotations

from typing import Any, List, Optional
from urllib.parse import urlparse


def normalize_url(url: Optional[str]) -> Optional[str]:
    """
    Ensures the URL has an http/https scheme and strips surrounding whitespace.
    Returns None if the input is None or empty after stripping.

    Examples:
        "example.com"          → "https://example.com"
        "http://example.com"   → "http://example.com"
        None                   → None
        "   "                  → None
    """
    if not url:
        return None
    value = url.strip()
    if not value:
        return None
    if not value.startswith(("http://", "https://")):
        return f"https://{value}"
    return value


def extract_domain(url: str) -> str:
    """
    Extracts the canonical root domain from a URL, stripping scheme,
    'www.' prefix, and any path/query/fragment.

    Examples:
        "https://www.example.com/about" → "example.com"
        "http://shop.acme.co.uk/en/"    → "shop.acme.co.uk"
        "example.com"                   → "example.com"
    """
    value = url.strip()
    if not value.startswith(("http://", "https://")):
        value = f"https://{value}"
    parsed = urlparse(value)
    netloc = parsed.netloc or value
    # Strip port if present (e.g. "example.com:443" → "example.com")
    netloc = netloc.split(":")[0]
    # Strip leading "www." only — preserve meaningful subdomains (e.g. "shop.")
    if netloc.startswith("www."):
        netloc = netloc[4:]
    return netloc.lower()


def dedupe_list(items: List[Any]) -> List[Any]:
    """
    Removes duplicates from a list while preserving the original insertion order.
    Works correctly for any hashable element type (str, int, tuple, …).

    Examples:
        ["a", "b", "a", "c"] → ["a", "b", "c"]
        []                   → []
    """
    seen: set = set()
    result: List[Any] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result


def clamp_confidence(value: Any) -> float:
    """
    Coerces a value to a float in the closed interval [0.0, 1.0].
    Returns 0.0 for None, non-numeric types, or conversion failures.

    Examples:
        0.85  → 0.85
        1.5   → 1.0
        -0.1  → 0.0
        None  → 0.0
        "bad" → 0.0
    """
    if value is None:
        return 0.0
    try:
        clamped = float(value)
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, min(1.0, clamped))


def truncate_text(text: Optional[str], max_length: int = 30000) -> str:
    """
    Safely slices text to at most `max_length` characters.
    Returns an empty string if the input is None or empty.
    Never raises — safe to call on any state field without a guard.

    Examples:
        "hello world" with max_length=5 → "hello"
        None                            → ""
    """
    if not text:
        return ""
    return text[:max_length]
