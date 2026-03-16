from __future__ import annotations

"""
collector.py — deterministic multi-page HTTP collector for the Verification Agent.

Fetches the homepage first, then discovers and scores internal links from the
live HTML, and fetches the top-scoring sub-pages.  Falls back to Playwright
when a requests response is too short to be real content.
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

try:
    from bs4 import BeautifulSoup as _BS
    _BS4_AVAILABLE = True
except ImportError:
    _BS = None  # type: ignore[assignment,misc]
    _BS4_AVAILABLE = False

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

MAX_PAGES = 5

# Minimum visible chars before triggering Playwright fallback
_MIN_VISIBLE_CHARS = 300

# Cap on merged text returned to callers
_MAX_MERGED_CHARS = 25_000

# Asset / non-content extensions to skip during link discovery
_ASSET_EXTS: frozenset[str] = frozenset({
    ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp",
    ".pdf", ".css", ".js", ".ico", ".woff", ".woff2",
    ".ttf", ".eot", ".mp4", ".mp3", ".zip", ".gz",
})

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

def _http_fetch(url: str, timeout: int = 10) -> tuple[Optional[str], int, Optional[str]]:
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
# New helpers for link-discovery strategy
# ---------------------------------------------------------------------------

def _norm_netloc(netloc: str) -> str:
    """Strip leading 'www.' for same-host comparison."""
    host = netloc.lower()
    return host[4:] if host.startswith("www.") else host


def _score_link(url: str, text: str = "") -> int:
    """
    Score a candidate link by how likely it is to contain useful contact
    or business information. Uses both URL and anchor text.
    """
    url_lower = url.lower()
    text_lower = text.lower()

    # Priorities:
    # 1. Direct Contact / Help / Support (Critical for outreach)
    if any(k in url_lower or k in text_lower for k in (
        "contact", "get-in-touch", "get in touch", "support", "help",
        "customer-care", "customer care", "customer-service", "customer service"
    )):
        return 100

    # 2. B2B / Wholesale (Revenue signals)
    if any(k in url_lower or k in text_lower for k in ("wholesale", "trade", "b2b", "stockist", "dealer")):
        return 95

    # 3. Identity / About (Company signals)
    if any(k in url_lower or k in text_lower for k in ("about", "our-story", "our_story", "our story", "who we are")):
        return 80

    # 4. Team / People (Personalization signals)
    if any(k in url_lower or k in text_lower for k in ("team", "people", "staff", "management")):
        return 75

    # 5. FAQ / Policies (Lower priority but better than generic)
    if any(k in url_lower or k in text_lower for k in ("faq", "privacy", "terms", "policy")):
        return 40

    return 0


def _extract_mailto_emails(html: str) -> List[str]:
    """Return unique email addresses found in mailto: hrefs."""
    emails: List[str] = []
    seen: set[str] = set()
    if _BS4_AVAILABLE and _BS is not None:
        try:
            soup = _BS(html, "html.parser")
            for tag in soup.find_all("a", href=True):
                href = str(tag.get("href", "") or "")
                if href.lower().startswith("mailto:"):
                    email = href[7:].split("?")[0].strip().lower()
                    if email and email not in seen:
                        seen.add(email)
                        emails.append(email)
            return emails
        except Exception:
            pass
    # Regex fallback when bs4 is unavailable
    for m in re.finditer(r'mailto:([^\s"\'?&<>]+)', html, re.IGNORECASE):
        email = m.group(1).strip().lower()
        if email and email not in seen:
            seen.add(email)
            emails.append(email)
    return emails


def _bs_visible_text(html: str) -> str:
    """
    Return visible text with script/style/noscript/svg/nav/header stripped.
    Uses BeautifulSoup when available, falls back to regex stripping.
    """
    if _BS4_AVAILABLE and _BS is not None:
        try:
            soup = _BS(html, "html.parser")
            for tag in soup(["script", "style", "noscript", "svg", "nav", "header"]):
                tag.decompose()
            text = soup.get_text(separator=" ")
            return _WS_RE.sub(" ", unescape(text)).strip()
        except Exception:
            pass
    return _strip_tags(html)


def _bs_footer_text(html: str) -> Optional[str]:
    """Extract text content of the first <footer> element."""
    if _BS4_AVAILABLE and _BS is not None:
        try:
            soup = _BS(html, "html.parser")
            footer = soup.find("footer")
            if footer:
                return _WS_RE.sub(" ", unescape(footer.get_text(separator=" "))).strip()
        except Exception:
            pass
    return _extract_footer(html)


def _discover_scored_links(
    homepage_html: str,
    homepage_url: str,
    base_netloc: str,
    already_collected: Set[str],
) -> List[str]:
    """
    Parse homepage HTML, score every internal <a href>, deduplicate, and
    return up to 4 URLs sorted by score descending.
    """
    seen: set[str] = {homepage_url, homepage_url.rstrip("/")}
    for u in already_collected:
        seen.add(u)
        seen.add(u.rstrip("/"))

    scored: List[tuple[int, str]] = []

    try:
        if _BS4_AVAILABLE and _BS is not None:
            soup = _BS(homepage_html, "html.parser")
            raw_links = [
                (str(a.get("href", "") or ""), a.get_text().strip())
                for a in soup.find_all("a", href=True)
            ]
        else:
            # Regex fallback: note this won't capture anchor text reliably,
            # so we just pass empty string for the score helper.
            matches = re.findall(
                r'<a\s[^>]*\bhref=["\']([^"\']+)["\'][^>]*>(.*?)</a>',
                homepage_html,
                re.IGNORECASE | re.DOTALL,
            )
            raw_links = [(m[0], _strip_tags(m[1])) for m in matches]

        for href, text in raw_links:
            href = href.strip()
            if not href or href.startswith(("mailto:", "tel:", "javascript:", "#")):
                continue

            abs_url = urljoin(homepage_url.rstrip("/") + "/", href).split("#")[0].strip()
            if not abs_url:
                continue

            parsed = urlparse(abs_url)
            if parsed.scheme not in ("http", "https"):
                continue

            # Skip external domains
            if _norm_netloc(parsed.netloc) != _norm_netloc(base_netloc):
                continue

            # Skip asset / non-HTML paths
            path_part = parsed.path.lower()
            last_segment = path_part.rsplit("/", 1)[-1]
            if "." in last_segment:
                ext = "." + last_segment.rsplit(".", 1)[-1]
                if ext in _ASSET_EXTS:
                    continue

            normalized = abs_url.rstrip("/")
            if not normalized or normalized in seen:
                continue

            score = _score_link(abs_url, text)
            if score == 0:
                continue

            seen.add(normalized)
            scored.append((score, abs_url))

    except Exception as exc:
        logger.debug("_discover_scored_links error: %s", exc)

    scored.sort(key=lambda x: -x[0])
    return [url for _, url in scored[:4]]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def collect_pages(
    base_url: str,
    already_collected: Optional[Set[str]] = None,
) -> dict:
    """
    Fetch the homepage of *base_url*, discover internal links, score them,
    and fetch the top-scoring sub-pages.

    Parameters
    ----------
    base_url          : Canonical URL of the site (scheme + netloc + optional path).
    already_collected : Set of URLs already fetched by an upstream agent
                        (e.g. the Relevancy Agent).  Matching URLs are skipped.

    Returns
    -------
    dict with keys:
        pages_collected       dict[str, str]   url → cleaned visible text
        homepage_html         str | None       raw HTML of the root homepage (pre-tag-strip)
        contact_page_html     str | None       raw HTML of highest-scored contact page
        contact_page_url      str | None       URL of that contact page
        about_page_html       str | None       raw HTML of highest-scored about page
        wholesale_page_found  bool
        wholesale_page_url    str | None
        footer_text           str | None       text extracted from <footer>
        merged_text           str              all page texts joined (capped 25 000 chars)
        method                str              "http" | "mixed" | "playwright" | "failed"
        errors                list[str]
        homepage_emails       list[str]        mailto: emails found on the homepage
    """
    if already_collected is None:
        already_collected = set()

    pages_collected: Dict[str, str] = {}
    contact_page_html: Optional[str] = None
    contact_page_url_found: Optional[str] = None
    about_page_html: Optional[str] = None
    wholesale_page_found = False
    wholesale_page_url: Optional[str] = None
    footer_text: Optional[str] = None
    homepage_emails: List[str] = []
    errors: List[str] = []
    methods_used: set[str] = set()

    homepage_url = base_url.rstrip("/") or _root_url(base_url).rstrip("/")
    base_netloc = urlparse(homepage_url).netloc

    _empty_result = {
        "pages_collected": pages_collected,
        "homepage_html": None,
        "contact_page_html": None,
        "contact_page_url": None,
        "about_page_html": None,
        "wholesale_page_found": False,
        "wholesale_page_url": None,
        "footer_text": None,
        "merged_text": "",
        "method": "failed",
        "errors": errors,
        "homepage_emails": homepage_emails,
    }

    # ------------------------------------------------------------------
    # STEP 1 — Fetch homepage
    # ------------------------------------------------------------------
    homepage_html: Optional[str] = None
    homepage_text = ""
    homepage_used_playwright = False

    try:
        html, status_code, err = _http_fetch(homepage_url, timeout=10)
        if err:
            errors.append(f"homepage: {err}")
        elif html:
            visible = _bs_visible_text(html)
            if len(visible) < _MIN_VISIBLE_CHARS:
                logger.debug("collect_pages homepage JS_SHELL len=%s → playwright", len(html))
                pw_html = _playwright_fetch(homepage_url)
                if pw_html and len(_bs_visible_text(pw_html)) >= _MIN_VISIBLE_CHARS:
                    html = pw_html
                    homepage_used_playwright = True
                    visible = _bs_visible_text(html)
            homepage_html = html
            homepage_text = visible
    except Exception as exc:
        errors.append(f"homepage: {type(exc).__name__}:{exc}")

    # If requests failed entirely, try Playwright directly
    if not homepage_html:
        try:
            pw_html = _playwright_fetch(homepage_url)
            if pw_html:
                homepage_html = pw_html
                homepage_used_playwright = True
                homepage_text = _bs_visible_text(pw_html)
        except Exception as exc:
            errors.append(f"homepage_playwright: {type(exc).__name__}:{exc}")

    if not homepage_html:
        return _empty_result

    pages_collected[homepage_url] = homepage_text
    methods_used.add("playwright" if homepage_used_playwright else "http")
    footer_text = _bs_footer_text(homepage_html)
    homepage_emails = _extract_mailto_emails(homepage_html)

    logger.debug(
        "collect_pages HOMEPAGE ok chars=%s playwright=%s emails=%s",
        len(homepage_text), homepage_used_playwright, len(homepage_emails),
    )

    # ------------------------------------------------------------------
    # STEP 2 — Discover and score internal links from homepage HTML
    # ------------------------------------------------------------------
    top_links = _discover_scored_links(
        homepage_html=homepage_html,
        homepage_url=homepage_url,
        base_netloc=base_netloc,
        already_collected=already_collected,
    )
    logger.debug("collect_pages discovered %s scored links: %s", len(top_links), top_links)

    # ------------------------------------------------------------------
    # STEP 3 — Fetch top 4 scored sub-pages
    # ------------------------------------------------------------------
    for url in top_links:
        if len(pages_collected) >= MAX_PAGES:
            break

        # Skip if upstream already collected this URL
        if url in already_collected or url.rstrip("/") in already_collected:
            logger.debug("collect_pages SKIP already_collected url=%s", url)
            continue

        try:
            html, status_code, err = _http_fetch(url, timeout=10)
            used_playwright = False

            if err:
                errors.append(f"{url}: {err}")
                continue

            if not html:
                errors.append(f"{url}: empty_response status={status_code}")
                continue

            visible = _bs_visible_text(html)
            
            # IMPROVEMENT: If this is a high-priority "contact-like" page, 
            # be more aggressive with Playwright escalation even if not a total "shell".
            is_high_priority = _score_link(url) >= 90
            threshold = _MIN_VISIBLE_CHARS * (1.5 if is_high_priority else 1.0)

            if len(visible) < threshold:
                logger.debug("collect_pages url=%s visibility under threshold → playwright", url)
                pw_html = _playwright_fetch(url)
                if pw_html:
                    pw_visible = _bs_visible_text(pw_html)
                    # Only upgrade if Playwright actually found more content
                    if len(pw_visible) > len(visible):
                        html = pw_html
                        used_playwright = True
                        visible = pw_visible

            if not visible:
                errors.append(f"{url}: no_visible_text")
                continue

            pages_collected[url] = visible
            methods_used.add("playwright" if used_playwright else "http")

            # Accumulate emails from every fetched page
            for email in _extract_mailto_emails(html):
                if email not in homepage_emails:
                    homepage_emails.append(email)

            # Footer — use first non-empty footer found across all pages
            if footer_text is None:
                ft = _bs_footer_text(html)
                if ft:
                    footer_text = ft

            url_lower = url.lower()
            if _score_link(url) == 100 and contact_page_html is None:
                contact_page_html = html
                contact_page_url_found = url

            if (
                any(k in url_lower for k in ("about", "our-story", "our_story"))
                and about_page_html is None
            ):
                about_page_html = html

            if (
                any(k in url_lower for k in ("wholesale", "trade", "b2b"))
                and not wholesale_page_found
            ):
                wholesale_page_found = True
                wholesale_page_url = url

            logger.debug(
                "collect_pages OK url=%s chars=%s method=%s",
                url, len(visible), "playwright" if used_playwright else "http",
            )

        except Exception as exc:
            logger.warning("collect_pages PAGE_ERROR url=%s error=%s", url, exc, exc_info=True)
            errors.append(f"{url}: page_error:{type(exc).__name__}:{exc}")
            continue

    # ------------------------------------------------------------------
    # STEP 4 — Build merged text (capped)
    # ------------------------------------------------------------------
    merged_text = "\n\n".join(pages_collected.values())
    if len(merged_text) > _MAX_MERGED_CHARS:
        merged_text = merged_text[:_MAX_MERGED_CHARS]

    # ------------------------------------------------------------------
    # STEP 5 — Determine overall fetch method
    # ------------------------------------------------------------------
    if "playwright" in methods_used and "http" in methods_used:
        method = "mixed"
    elif "playwright" in methods_used:
        method = "playwright"
    elif "http" in methods_used:
        method = "http"
    else:
        method = "failed"

    return {
        "pages_collected": pages_collected,
        "homepage_html": homepage_html,
        "contact_page_html": contact_page_html,
        "contact_page_url": contact_page_url_found,
        "about_page_html": about_page_html,
        "wholesale_page_found": wholesale_page_found,
        "wholesale_page_url": wholesale_page_url,
        "footer_text": footer_text,
        "merged_text": merged_text,
        "method": method,
        "errors": errors,
        "homepage_emails": homepage_emails,
    }
