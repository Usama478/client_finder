from __future__ import annotations

"""
accessibility.py — lightweight site liveness check + WHOIS domain age.

No LLM.  All I/O is wrapped in try/except; functions never raise.
"""

import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
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

_BLOCK_BODY_MARKERS = (
    "attention required",
    "cloudflare",
    "access denied",
    "blocked",
    "just a moment",
    "checking your browser",
    "verify you are human",
    "captcha",
    "challenge",
)
_BLOCK_STATUS_CODES = {401, 403, 405, 429, 503}
_AMBIGUOUS_STATUS_CODES = {408, 500, 502, 504, 520, 521, 522, 523, 524, 525, 526, 530}
_DEAD_STATUS_CODES = {404, 410}


# ---------------------------------------------------------------------------
# check_accessibility
# ---------------------------------------------------------------------------

def check_accessibility(url: str) -> dict:
    """
    Perform a lightweight HEAD (or GET fallback) to determine whether a site
    is reachable and to capture redirect / SSL / block signals.

    Never raises.  Returns an explicit ambiguous/system_error result on failures.

    Returns
    -------
    dict with keys:
        live              bool   — True if the site is reachable
        ssl_valid         bool   — True if the final URL is served over HTTPS
        redirect_detected bool   — True if the final URL differs from the input
        final_url         str    — resolved URL after all redirects
        status_code       int|None
        status            str    — "live"|"dead"|"blocked"|"redirect"|"ambiguous"|"system_error"
        error_type        str|None
    """
    _dead = {
        "live": False,
        "ssl_valid": False,
        "redirect_detected": False,
        "final_url": url,
        "status_code": None,
        "status": "dead",
        "error_type": None,
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

        # ---- Blocked / WAF-like: 401/403/405/429/503 ----
        # Many legitimate ecommerce sites return these on HEAD while GET works.
        # Prefer blocked/ambiguous over dead when uncertain.
        if status_code in _BLOCK_STATUS_CODES:
            try:
                get_resp = requests.get(
                    url,
                    headers=_DEFAULT_HEADERS,
                    allow_redirects=True,
                    timeout=8,
                    stream=True,
                )
                try:
                    get_status_code = get_resp.status_code
                    get_body = get_resp.raw.read(8192).decode("utf-8", errors="ignore").lower()
                finally:
                    get_resp.close()
                if any(marker in get_body for marker in _BLOCK_BODY_MARKERS):
                    return {
                        "live": False,
                        "ssl_valid": str(final_url).startswith("https://"),
                        "redirect_detected": str(final_url).rstrip("/") != str(url).rstrip("/"),
                        "final_url": get_resp.url or final_url,
                        "status_code": get_status_code,
                        "status": "blocked",
                        "error_type": None,
                    }
                if 200 <= get_status_code < 400:
                    get_final_url = get_resp.url or url
                    return {
                        "live": True,
                        "ssl_valid": str(get_final_url).startswith("https://"),
                        "redirect_detected": str(get_final_url).rstrip("/") != str(url).rstrip("/"),
                        "final_url": get_final_url,
                        "status_code": get_status_code,
                        "status": "live",
                        "error_type": None,
                    }
                if get_status_code in _DEAD_STATUS_CODES:
                    get_final_url = get_resp.url or url
                    return {
                        "live": False,
                        "ssl_valid": str(get_final_url).startswith("https://"),
                        "redirect_detected": str(get_final_url).rstrip("/") != str(url).rstrip("/"),
                        "final_url": get_final_url,
                        "status_code": get_status_code,
                        "status": "dead",
                        "error_type": None,
                    }
            except Exception:
                pass
            # Both HEAD and GET remained uncertain — mark blocked, not dead.
            return {
                "live": False,
                "ssl_valid": ssl_valid,
                "redirect_detected": redirect_detected,
                "final_url": final_url,
                "status_code": status_code,
                "status": "blocked",
                "error_type": None,
            }

        # ---- Dead: 404 / 410 ----
        if status_code in _DEAD_STATUS_CODES:
            return {
                "live": False,
                "ssl_valid": ssl_valid,
                "redirect_detected": redirect_detected,
                "final_url": final_url,
                "status_code": status_code,
                "status": "dead",
                "error_type": None,
            }

        # ---- Ambiguous upstream errors (treat safer than dead) ----
        if status_code in _AMBIGUOUS_STATUS_CODES:
            return {
                "live": False,
                "ssl_valid": ssl_valid,
                "redirect_detected": redirect_detected,
                "final_url": final_url,
                "status_code": status_code,
                "status": "ambiguous",
                "error_type": None,
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
                try:
                    # Read only the first 8 KB to detect block pages cheaply
                    body = get_response.raw.read(8192).decode("utf-8", errors="ignore").lower()
                finally:
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
                "error_type": None,
            }

        # ---- Live (2xx / 3xx) ----
        live = 200 <= status_code < 400
        derived_status = "live" if live else "ambiguous"
        if live and redirect_detected:
            derived_status = "redirect"

        return {
            "live": live,
            "ssl_valid": ssl_valid,
            "redirect_detected": redirect_detected,
            "final_url": final_url,
            "status_code": status_code,
            "status": derived_status,
            "error_type": None,
        }

    except (ReqConnectionError, Timeout, OSError) as net_exc:
        logger.debug("check_accessibility ambiguous url=%s error=%s", url, net_exc)
        return {**_dead, "status": "ambiguous", "error_type": type(net_exc).__name__}
    except Exception as exc:
        logger.error("check_accessibility UNEXPECTED url=%s error=%s", url, exc, exc_info=True)
        return {**_dead, "status": "system_error", "error_type": type(exc).__name__}


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

        _pool = ThreadPoolExecutor(max_workers=1)
        try:
            result = _pool.submit(whois.whois, domain).result(timeout=12)
        except FuturesTimeoutError:
            logger.debug("get_domain_age WHOIS_TIMEOUT domain=%s (12s exceeded)", domain)
            return None
        finally:
            _pool.shutdown(wait=False)
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
