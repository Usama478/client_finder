from __future__ import annotations

"""
collector.py — deterministic multi-page HTTP collector for the Verification Agent.

Fetches a fixed priority list of sub-pages via requests.  Falls back to
Playwright if the response body is too short or looks like a JS shell.
No LLM.  All errors are captured per-page; the function never raises.
"""

import logging
import re
from html import unescape
from typing import Dict, List, Optional, Set
from urllib.parse import urljoin, urlparse

import requests
from requests.exceptions import ConnectionError as ReqConnectionError
from requests.exceptions import Timeout

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)
_DEFAULT_HEADERS = {
    "User-Agent": _USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Connection": "keep-alive",
}

# Pages to probe in priority order (path → label)
_TARGET_PATHS: List[tuple[str, str]] = [
    ("/contact",            "contact"),
    ("/contact-us",         "contact"),
    ("/about",              "about"),
    ("/about-us",           "about"),
    ("/wholesale",          "wholesale"),
    ("/trade",              "wholesale"),
    ("/b2b",                "wholesale"),
    ("/our-story",          "about"),
    ("/team",               "about"),
    ("/wholesale-enquiry",  "wholesale"),
]

MAX_PAGES = 5

# A response body shorter than this (visible chars after tag stripping)
# is considered a JS shell and triggers Playwright fallback.
_MIN_VISIBLE_CHARS = 200

_SCRIPT_STYLE_RE = re.compile(r"(?is)<(script|style).*?>.*?</\1>")
_TAG_RE           = re.compile(r"(?s)<[^>]+>")
_WS_RE            = re.compile(r"\s+")
_FOOTER_RE        = re.compile(r"<footer[^>]*>(.*?)</footer>", re.IGNORECASE | re.DOTALL)

# Playwright is optional — import lazily to avoid hard dependency.
_PW_AVAILABLE: Optional[bool] = None

# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------

def _strip_tags(html: str) -> str:
    without_scripts = _SCRIPT_STYLE_RE.sub(" ", html or "")
    no_tags = _TAG_RE.sub(" ", without_scripts)
    return _WS_RE.sub(" ", unescape(no_tags)).strip()


def _extract_footer(html: str) -> Optional[str]:
    m = _FOOTER_RE.search(html or "")
    if m:
        return _strip_tags(m.group(1))
    return None


def _is_js_shell(html: str) -> bool:
    """Return True if visible text after tag stripping is under the threshold."""
    visible = _strip_tags(html)
    return len(visible) < _MIN_VISIBLE_CHARS


def _root_url(url: str) -> str:
    p = urlparse(url)
    return f"{p.scheme}://{p.netloc}"


# ---------------------------------------------------------------------------
# Playwright fallback
# ---------------------------------------------------------------------------

def _playwright_fetch(url: str) -> Optional[str]:
    """
    Fetch a single URL with Playwright, returning raw HTML or None.

    Reuses the stealth browser launch helper from the Relevancy Agent's
    browser_collect module (same args, same anti-bot config).
    """
    global _PW_AVAILABLE
    try:
        from app.agents.relevancy.tools_v2.browser_collect import (
            BROWSER_SEMAPHORE,
            _run_playwright_session,
        )
        from playwright.sync_api import sync_playwright  # noqa: F401 — presence check
        _PW_AVAILABLE = True
    except Exception:
        _PW_AVAILABLE = False
        logger.debug("_playwright_fetch: playwright not available, skipping")
        return None

    try:
        with BROWSER_SEMAPHORE:
            result = _run_playwright_session(
                url=url,
                timeout_s=12,
                user_agent=_USER_AGENT,
                include_internal_pages=False,
                max_internal_pages=0,
                diagnostics=[],
            )
            homepage = result.get("homepage") or {}
            return homepage.get("html") or None
    except Exception as exc:
        logger.debug("_playwright_fetch FAILED url=%s error=%s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Single-page HTTP fetch
# ---------------------------------------------------------------------------

def _http_fetch(url: str, timeout: int = 12) -> tuple[Optional[str], int, Optional[str]]:
    """
    Perform a GET request.

    Returns (html, status_code, error_msg).
    error_msg is None on success.
    """
    try:
        resp = requests.get(
            url,
            allow_redirects=True,
            timeout=timeout,
            headers=_DEFAULT_HEADERS,
        )
        if resp.status_code in (404, 410):
            return None, resp.status_code, f"http_{resp.status_code}"
        return resp.text, resp.status_code, None
    except (ReqConnectionError, Timeout) as net_exc:
        return None, 0, f"network:{type(net_exc).__name__}"
    except Exception as exc:
        return None, 0, f"unexpected:{type(exc).__name__}:{exc}"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def collect_pages(
    base_url: str,
    already_collected: Optional[Set[str]] = None,
) -> dict:
    """
    Fetch the priority sub-pages of *base_url* and return aggregated content.

    Parameters
    ----------
    base_url          : Canonical URL of the site (scheme + netloc + optional path).
    already_collected : Set of URLs already fetched by an upstream agent
                        (e.g. the Relevancy Agent).  Matching URLs are skipped.

    Returns
    -------
    dict with keys:
        pages_collected       dict[str, str]   path → cleaned text
        contact_page_html     str | None       raw HTML of /contact (first found)
        about_page_html       str | None       raw HTML of /about (first found)
        wholesale_page_found  bool
        wholesale_page_url    str | None
        footer_text           str | None       text extracted from <footer>
        merged_text           str              all page texts joined with \\n\\n
        method                str              "http" | "mixed" | "playwright"
        errors                list[str]
    """
    if already_collected is None:
        already_collected = set()

    root = _root_url(base_url)
    pages_collected: Dict[str, str] = {}
    contact_page_html: Optional[str] = None
    contact_page_url_found: Optional[str] = None
    about_page_html: Optional[str] = None
    wholesale_page_found = False
    wholesale_page_url: Optional[str] = None
    footer_text: Optional[str] = None
    errors: List[str] = []
    methods_used: set[str] = set()

    # Deduplicate paths so we never fetch the same final path twice
    # (e.g. /contact and /contact-us both resolve to the "contact" label;
    #  stop after the first successful one per label).
    satisfied_labels: set[str] = set()

    for path, label in _TARGET_PATHS:
        if len(pages_collected) >= MAX_PAGES:
            break

        full_url = urljoin(root + "/", path.lstrip("/"))

        # Skip if already fetched upstream
        if full_url in already_collected or full_url.rstrip("/") in already_collected:
            logger.debug("collect_pages SKIP already_collected url=%s", full_url)
            continue

        # Only collect the first successful URL per label
        if label in satisfied_labels:
            continue

        # ---- HTTP fetch ----
        html, status_code, err = _http_fetch(full_url)

        if err:
            errors.append(f"{path}: {err}")
            continue

        # ---- Playwright fallback if body is a JS shell ----
        used_playwright = False
        if html and _is_js_shell(html):
            logger.debug("collect_pages JS_SHELL path=%s len=%s → playwright", path, len(html))
            pw_html = _playwright_fetch(full_url)
            if pw_html and not _is_js_shell(pw_html):
                html = pw_html
                used_playwright = True
            else:
                # Even Playwright couldn't extract meaningful text — skip
                errors.append(f"{path}: js_shell_unresolvable")
                continue

        if not html:
            errors.append(f"{path}: empty_response status={status_code}")
            continue

        # ---- Extract visible text ----
        visible_text = _strip_tags(html)
        if not visible_text:
            errors.append(f"{path}: no_visible_text")
            continue

        # ---- Store results ----
        pages_collected[path] = visible_text
        methods_used.add("playwright" if used_playwright else "http")
        satisfied_labels.add(label)

        # Footer: extract once from the richest page (contact > about > others)
        if footer_text is None:
            ft = _extract_footer(html)
            if ft:
                footer_text = ft

        # Label-specific storage
        if label == "contact" and contact_page_html is None:
            contact_page_html = html
            contact_page_url_found = full_url

        if label == "about" and about_page_html is None:
            about_page_html = html

        if label == "wholesale" and not wholesale_page_found:
            wholesale_page_found = True
            wholesale_page_url = full_url

        logger.debug(
            "collect_pages OK path=%s label=%s chars=%s method=%s",
            path, label, len(visible_text), "playwright" if used_playwright else "http",
        )

    # ---- Merged text ----
    merged_text = "\n\n".join(pages_collected.values())

    # ---- Derive overall fetch method label ----
    if "playwright" in methods_used and "http" in methods_used:
        method = "mixed"
    elif "playwright" in methods_used:
        method = "playwright"
    else:
        method = "http"

    return {
        "pages_collected": pages_collected,
        "contact_page_html": contact_page_html,
        "contact_page_url": contact_page_url_found,
        "about_page_html": about_page_html,
        "wholesale_page_found": wholesale_page_found,
        "wholesale_page_url": wholesale_page_url,
        "footer_text": footer_text,
        "merged_text": merged_text,
        "method": method,
        "errors": errors,
    }
