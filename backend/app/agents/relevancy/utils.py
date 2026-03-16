"""
Shared utility helpers for the relevancy agent.

Rules for adding to this module:
- Only functions that appear verbatim (or near-verbatim) in 2+ files belong here.
- Do NOT put domain-specific logic here; keep that in the owning module.
- Prefer tiny, pure functions over stateful helpers.
"""

from __future__ import annotations

import re
from typing import Iterable, List, Optional, Set, Tuple


# ---------------------------------------------------------------------------
# URL helpers
# ---------------------------------------------------------------------------

def normalize_url(url: Optional[str]) -> Optional[str]:
    """
    Ensure *url* has an http/https scheme.  Returns None for empty/None input.

    Three copies of this logic existed: nodes.py, service_v2.py, collect.py.
    The service_v2 variant returns "" instead of None for the empty case; that
    variant is kept inline in service_v2 to avoid a silent behaviour change.
    """
    if not url:
        return None
    value = url.strip()
    if not value:
        return None
    if not value.startswith(("http://", "https://")):
        return f"https://{value}"
    return value


# ---------------------------------------------------------------------------
# List helpers
# ---------------------------------------------------------------------------

def safe_list(value: object, limit: int = 12) -> List[str]:
    """
    Coerce *value* to a capped list of non-empty strings.

    Duplicate of the same helper in service_v2.py and judge.py.
    Both copies are replaced to call this function.
    """
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()][:limit]


def dedupe_limited(items: Iterable[str], limit: int = 12) -> List[str]:
    """Return unique non-empty strings from *items*, capped at *limit*."""
    seen: Set[str] = set()
    output: List[str] = []
    for item in items:
        text = str(item).strip()
        if not text or text in seen:
            continue
        seen.add(text)
        output.append(text)
        if len(output) >= limit:
            break
    return output


# ---------------------------------------------------------------------------
# Numeric helpers
# ---------------------------------------------------------------------------

def clamp_float(value: object, lower: float = 0.0, upper: float = 1.0) -> float:
    """Clamp *value* to [lower, upper], defaulting to *lower* on type error."""
    try:
        numeric = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        numeric = lower
    return max(lower, min(upper, numeric))


# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------

def normalize_ws(text: str) -> str:
    """Collapse all runs of whitespace to a single space and strip."""
    return re.sub(r"\s+", " ", str(text or "")).strip()


# ---------------------------------------------------------------------------
# Block-marker constants (shared between collect.py and judge.py)
# ---------------------------------------------------------------------------

BLOCK_MARKERS: Tuple[Tuple[str, str], ...] = (
    ("turnstile", "turnstile"),
    ("cf-challenge", "cloudflare_challenge"),
    ("challenge-platform", "cloudflare_challenge"),
    ("cloudflare ray id", "cloudflare_challenge"),
    ("checking your browser", "checking_your_browser"),
    ("verify you are human", "bot_challenge"),
    ("are you human", "bot_challenge"),
    ("access denied", "access_denied"),
    ("captcha", "captcha"),
)
