from __future__ import annotations

"""
accessibility.py — lightweight site liveness check + WHOIS domain age.

No LLM.  All I/O is wrapped in try/except; functions never raise.
"""

import logging
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

import requests
from requests.exceptions import ConnectionError as ReqConnectionError
from requests.exceptions import Timeout

logger = logging.getLogger(__name__)

_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)
_DEFAULT_HEADERS = {
    "User-Agent": _USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

_BLOCK_BODY_MARKERS = ("attention required", "cloudflare", "access denied", "blocked")


# ---------------------------------------------------------------------------
# check_accessibility
# ---------------------------------------------------------------------------

def check_accessibility(url: str) -> dict:
    """
    Perform a lightweight HEAD (or GET fallback) to determine whether a site
    is reachable and to capture redirect / SSL / block signals.

    Never raises.  Returns a dead result on any unhandled exception.

    Returns
    -------
    dict with keys:
        live              bool   — True if the site is reachable
        ssl_valid         bool   — True if the final URL is served over HTTPS
        redirect_detected bool   — True if the final URL differs from the input
        final_url         str    — resolved URL after all redirects
        status_code       int|None
        status            str    — "live"|"dead"|"blocked"|"redirect"
    """
    _dead = {
        "live": False,
        "ssl_valid": False,
        "redirect_detected": False,
        "final_url": url,
        "status_code": None,
        "status": "dead",
    }

    if not url:
        return _dead

    try:
        response = requests.head(
            url,
            allow_redirects=True,
            timeout=8,
            headers=_DEFAULT_HEADERS,
        )

        final_url = response.url or url
        status_code = response.status_code
        ssl_valid = str(final_url).startswith("https://")
        redirect_detected = str(final_url).rstrip("/") != str(url).rstrip("/")

        # ---- Blocked: 403 / 429 ----
        if status_code in (403, 429):
            return {
                "live": False,
                "ssl_valid": ssl_valid,
                "redirect_detected": redirect_detected,
                "final_url": final_url,
                "status_code": status_code,
                "status": "blocked",
            }

        # ---- Dead: 404 / 410 ----
        if status_code in (404, 410):
            return {
                "live": False,
                "ssl_valid": ssl_valid,
                "redirect_detected": redirect_detected,
                "final_url": final_url,
                "status_code": status_code,
                "status": "dead",
            }

        # ---- Check body for block markers (HEAD may return empty body;
        #      fall back to a lightweight GET only when body is empty) ----
        body = (response.text or "").lower()
        if not body and status_code == 200:
            try:
                get_response = requests.get(
                    final_url,
                    allow_redirects=True,
                    timeout=8,
                    headers=_DEFAULT_HEADERS,
                    stream=True,
                )
                # Read only the first 8 KB to detect block pages cheaply
                body = get_response.raw.read(8192).decode("utf-8", errors="ignore").lower()
                get_response.close()
            except Exception:
                body = ""

        if any(marker in body for marker in _BLOCK_BODY_MARKERS):
            return {
                "live": False,
                "ssl_valid": ssl_valid,
                "redirect_detected": redirect_detected,
                "final_url": final_url,
                "status_code": status_code,
                "status": "blocked",
            }

        # ---- Live (2xx / 3xx) ----
        live = 200 <= status_code < 400
        derived_status = "live" if live else "dead"
        if live and redirect_detected:
            derived_status = "redirect"

        return {
            "live": live,
            "ssl_valid": ssl_valid,
            "redirect_detected": redirect_detected,
            "final_url": final_url,
            "status_code": status_code,
            "status": derived_status,
        }

    except (ReqConnectionError, Timeout, OSError) as net_exc:
        logger.debug("check_accessibility dead url=%s error=%s", url, net_exc)
        return {**_dead, "status": "dead"}
    except Exception as exc:
        logger.error("check_accessibility UNEXPECTED url=%s error=%s", url, exc, exc_info=True)
        return {**_dead, "status": "dead"}


# ---------------------------------------------------------------------------
# get_domain_age
# ---------------------------------------------------------------------------

def _extract_root_domain(url: str) -> str:
    """Return 'example.com' from any URL string."""
    try:
        netloc = urlparse(url).netloc or url
        # Strip port
        netloc = netloc.split(":")[0]
        # Strip leading www.
        if netloc.startswith("www."):
            netloc = netloc[4:]
        return netloc.lower().strip()
    except Exception:
        return url


def get_domain_age(url: str) -> Optional[int]:
    """
    Query WHOIS for the domain derived from *url* and return its age in years.

    Returns None on ANY failure — WHOIS is unreliable and must never crash
    the pipeline.

    Parameters
    ----------
    url : Full URL or bare domain string.

    Returns
    -------
    int   — years since domain creation (rounded down), or None.
    """
    try:
        import whois  # python-whois

        domain = _extract_root_domain(url)
        if not domain:
            return None

        result = whois.whois(domain)
        if result is None:
            return None

        creation_date = result.creation_date
        if creation_date is None:
            return None

        # creation_date can be a list (some TLDs return multiple dates)
        if isinstance(creation_date, list):
            creation_date = creation_date[0]

        # Normalise to aware datetime for safe arithmetic
        if isinstance(creation_date, datetime):
            if creation_date.tzinfo is None:
                creation_date = creation_date.replace(tzinfo=timezone.utc)
            now = datetime.now(tz=timezone.utc)
            delta = now - creation_date
            return max(0, int(delta.days // 365))

        return None

    except Exception as exc:
        logger.debug("get_domain_age FAILED url=%s error=%s", url, exc)
        return None
