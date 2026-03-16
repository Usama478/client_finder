from __future__ import annotations

"""
size_estimate.py — deterministic business size estimator.

Pure logic only.  No HTTP, no Playwright, no LLM.
Matches text signals and platform hints to produce coarse employee range
and revenue band values.  Never assigns specific numbers.
"""

import re
from typing import Optional

# ---------------------------------------------------------------------------
# Signal tables
# ---------------------------------------------------------------------------

# (compiled_regex, employee_range)  — evaluated in order; first match wins.
# Text signals take priority over platform signals.
_TEXT_SIGNALS: list[tuple[re.Pattern, str]] = [
    # Large / enterprise
    (re.compile(r'\b50\+\s*stores\b|\bglobal\s+company\b|\benterprise\b|\bworldwide\b', re.IGNORECASE), "200+"),
    # Medium-large
    (re.compile(r'\b200\s+employees\b|\b10\+\s*stores\b|\bmultiple\s+locations\b', re.IGNORECASE), "51-200"),
    # Small-medium
    (re.compile(r'\b50\+\s*employees\b|\bgrowing\s+team\b|\b1[-–]\s*5\s+job\s+listings?\b', re.IGNORECASE), "11-50"),
    # Micro / family
    (re.compile(r'\bfamily\s+business\b|\bsmall\s+team\b|\bboutique\b', re.IGNORECASE), "1-10"),
]

# Platform weak signals: (list_of_platform_substrings, employee_range)
# Only applied when no text signal matched.
_PLATFORM_SIGNALS: list[tuple[list[str], str]] = [
    (["shopify plus", "magento"], "51-200"),
    (["shopify", "shopify basic", "woocommerce"], "1-50"),
]

# Revenue band by employee range
_REVENUE_BAND: dict[str, str] = {
    "1-10":   "small",
    "11-50":  "small",
    "51-200": "medium",
    "200+":   "large",
    "unknown": "unknown",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _match_text_signals(text: str) -> Optional[str]:
    for pattern, band in _TEXT_SIGNALS:
        if pattern.search(text):
            return band
    return None


def _match_platform_signals(platform: str) -> Optional[str]:
    plat_lower = (platform or "").lower().strip()
    for keywords, band in _PLATFORM_SIGNALS:
        if any(kw in plat_lower for kw in keywords):
            return band
    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def estimate_size(text: str, platform: str = "") -> dict:
    """
    Estimate business size from text signals and (optionally) platform hint.

    Parameters
    ----------
    text     : Combined site text / scraped content.
    platform : Platform string from collection phase (e.g. "shopify", "magento").
               Treated as a weak signal — only used when no text signal matched.

    Returns
    -------
    dict with keys:
        employee_range  — one of "1-10", "11-50", "51-200", "200+", "unknown"
        revenue_band    — one of "small", "medium", "large", "unknown"

    Critical: No specific numbers are ever assigned; only the defined bands above.
    """
    employee_range = _match_text_signals(text)

    # Fall back to platform weak signal only when text gave no result
    if employee_range is None:
        employee_range = _match_platform_signals(platform)

    if employee_range is None:
        employee_range = "unknown"

    revenue_band = _REVENUE_BAND.get(employee_range, "unknown")

    return {
        "employee_range": employee_range,
        "revenue_band": revenue_band,
    }
