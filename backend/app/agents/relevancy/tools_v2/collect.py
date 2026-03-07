from __future__ import annotations

import re
from html import unescape
from typing import Dict, List, Literal, Optional, Tuple
from urllib.parse import urljoin, urlparse

import httpx

from app.agents.relevancy.schemas import ShopifyProbeOutput
from app.agents.relevancy.state import RelevancyAgentState

try:
    from curl_cffi import requests as curl_requests
except Exception:
    curl_requests = None

try:
    from playwright.sync_api import sync_playwright
except Exception:
    sync_playwright = None

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)

FetchMethod = Literal["curl_cffi", "httpx", "playwright"]
MIN_HTML_BYTES = 800
BLOCK_MARKERS: Tuple[Tuple[str, str], ...] = (
    ("turnstile", "turnstile"),
    ("cf-challenge", "cloudflare_challenge"),
    ("challenge-platform", "cloudflare_challenge"),
    ("cloudflare ray id", "cloudflare_challenge"),
    ("checking your browser", "checking_your_browser"),
    ("access denied", "access_denied"),
    ("captcha", "captcha"),
)
JS_REQUIRED_MARKERS = (
    "enable javascript",
    "javascript is required",
    "please turn javascript on",
    "you need to enable javascript",
    "requires javascript",
)
SCRIPT_STYLE_RE = re.compile(r"(?is)<(script|style).*?>.*?</\1>")
TAG_RE = re.compile(r"(?s)<[^>]+>")
WS_RE = re.compile(r"\s+")


def _normalize_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    value = url.strip()
    if not value:
        return None
    if not value.startswith(("http://", "https://")):
        return f"https://{value}"
    return value


def _new_result(fetch_method: FetchMethod) -> Dict[str, object]:
    return {
        "final_url": None,
        "status_code": None,
        "html": None,
        "text_snippet": None,
        "blocked": False,
        "block_reason": None,
        "fetch_method": fetch_method,
        "needs_browser": False,
        "errors": [],
    }


def _extract_text_snippet(html: Optional[str]) -> Optional[str]:
    if not html:
        return None
    without_scripts = SCRIPT_STYLE_RE.sub(" ", html)
    no_tags = TAG_RE.sub(" ", without_scripts)
    text = WS_RE.sub(" ", unescape(no_tags)).strip()
    if not text:
        return None
    return text[:350]


def _is_html_too_short(html: Optional[str]) -> bool:
    if not html:
        return True
    return len(html.encode("utf-8", errors="ignore")) < MIN_HTML_BYTES


def _contains_js_gate(html: Optional[str]) -> bool:
    if not html:
        return False
    lowered = html.lower()
    return any(marker in lowered for marker in JS_REQUIRED_MARKERS)


def _detect_block(status_code: Optional[int], html: Optional[str]) -> Tuple[bool, Optional[str]]:
    if status_code in (403, 429):
        return True, f"http_{status_code}"
    lowered = (html or "").lower()
    for keyword, reason in BLOCK_MARKERS:
        if keyword in lowered:
            return True, reason
    return False, None


def _fallback_reason(status_code: Optional[int], html: Optional[str], blocked: bool, block_reason: Optional[str]) -> str:
    if blocked and block_reason:
        return block_reason
    if _contains_js_gate(html):
        return "javascript_required"
    if status_code in (403, 429):
        return f"http_{status_code}"
    if _is_html_too_short(html):
        return "html_too_short"
    return "browser_fallback"


def _fetch_with_httpx(url: str, timeout_s: int) -> Tuple[Optional[str], Optional[int], Optional[str]]:
    with httpx.Client(
        timeout=float(timeout_s),
        headers={"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"},
        follow_redirects=True,
    ) as client:
        response = client.get(url)
    html = response.text or None
    return str(response.url), response.status_code, html


def _fetch_with_curl_cffi(url: str, timeout_s: int) -> Tuple[Optional[str], Optional[int], Optional[str]]:
    if curl_requests is None:
        raise RuntimeError("curl_cffi is not installed")
    response = curl_requests.get(
        url,
        impersonate="chrome",
        timeout=float(timeout_s),
        allow_redirects=True,
        headers={"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"},
    )
    html = response.text or None
    final_url = str(getattr(response, "url", url) or url)
    status_code = getattr(response, "status_code", None)
    if isinstance(status_code, bool):
        status_code = None
    return final_url, int(status_code) if isinstance(status_code, int) else None, html


def _fetch_with_playwright(url: str, timeout_s: int) -> Tuple[Optional[str], Optional[int], Optional[str]]:
    if sync_playwright is None:
        raise RuntimeError("playwright is not installed")
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(user_agent=USER_AGENT, locale="en-US")
        page = context.new_page()
        try:
            response = page.goto(url, wait_until="domcontentloaded", timeout=max(timeout_s, 1) * 1000)
            page.wait_for_timeout(250)
            html = page.content() or None
            status_code = response.status if response else None
            return page.url or url, status_code, html
        finally:
            context.close()
            browser.close()


def _build_result(
    fetch_method: FetchMethod,
    final_url: Optional[str],
    status_code: Optional[int],
    html: Optional[str],
    errors: List[str],
) -> Dict[str, object]:
    blocked, block_reason = _detect_block(status_code, html)
    result = _new_result(fetch_method)
    result["final_url"] = final_url
    result["status_code"] = status_code
    result["html"] = html
    result["text_snippet"] = _extract_text_snippet(html)
    result["blocked"] = blocked
    result["block_reason"] = block_reason
    result["needs_browser"] = getattr(result, "needs_browser", False) if type(result) is dict and "needs_browser" in result else False
    result["errors"] = errors
    return result


def collect_page_sources(url: str, timeout_s: int = 15) -> Dict[str, object]:
    normalized = _normalize_url(url)
    errors: List[str] = []

    if not normalized:
        result = _new_result("httpx")
        result["blocked"] = True
        result["block_reason"] = "invalid_url"
        result["errors"] = ["invalid_url"]
        return result

    primary_result: Optional[Dict[str, object]] = None

    if curl_requests is not None:
        try:
            final_url, status_code, html = _fetch_with_curl_cffi(normalized, timeout_s)
            primary_result = _build_result("curl_cffi", final_url, status_code, html, list(errors))
        except Exception as exc:
            errors.append(f"curl_cffi:{type(exc).__name__}:{exc}")
    else:
        errors.append("curl_cffi:unavailable")

    if primary_result is None:
        try:
            final_url, status_code, html = _fetch_with_httpx(normalized, timeout_s)
            primary_result = _build_result("httpx", final_url, status_code, html, list(errors))
        except Exception as exc:
            errors.append(f"httpx:{type(exc).__name__}:{exc}")
            failed = _new_result("httpx")
            failed["blocked"] = True
            failed["block_reason"] = "fetch_failed"
            failed["errors"] = errors
            return failed

    status_code = primary_result.get("status_code")
    html = primary_result.get("html")
    blocked = bool(primary_result.get("blocked"))
    block_reason = primary_result.get("block_reason")
    html_short = _is_html_too_short(html if isinstance(html, str) else None)
    js_gate = _contains_js_gate(html if isinstance(html, str) else None)
    needs_browser = html_short or js_gate

    primary_result["needs_browser"] = needs_browser
    fallback_required = blocked or needs_browser

    if not fallback_required:
        primary_result["errors"] = errors
        return primary_result

    reason = _fallback_reason(
        status_code if isinstance(status_code, int) else None,
        html if isinstance(html, str) else None,
        blocked,
        block_reason if isinstance(block_reason, str) else None,
    )
    active_method = str(primary_result.get("fetch_method") or "httpx")
    errors.append(f"{active_method}:fallback:{reason}")

    try:
        final_url, pw_status, pw_html = _fetch_with_playwright(normalized, timeout_s)
        pw_result = _build_result("playwright", final_url, pw_status, pw_html, list(errors))
        pw_result["needs_browser"] = True  # Inherit that it needed the browser
        return pw_result
    except Exception as exc:
        errors.append(f"playwright:{type(exc).__name__}:{exc}")
        primary_result["errors"] = errors
        if not primary_result.get("blocked") and not needs_browser:
            primary_result["blocked"] = True
            primary_result["block_reason"] = reason
        return primary_result


def shopify_probe(
    state: RelevancyAgentState,
    fetcher: Optional[object] = None,
) -> Dict[str, object]:
    _ = fetcher
    if state.get("collect_blocked") is True:
        output = ShopifyProbeOutput(
            performed=False,
            detected=False,
            confidence=0.0,
            signals=["blocked_status"],
        )
        return {"shopify_probe_output": output.model_dump()}

    platform_output = state.get("platform_detection_output") or {}
    shopify_detected = platform_output.get("shopify_detected") is True or state.get("should_run_shopify_probe") is True
    if not shopify_detected:
        output = ShopifyProbeOutput(
            performed=False,
            detected=False,
            confidence=0.0,
            signals=["shopify_not_detected"],
        )
        return {"shopify_probe_output": output.model_dump()}

    website = _normalize_url(state.get("website"))
    if not website:
        output = ShopifyProbeOutput(performed=False, detected=False, confidence=0.0, signals=["no-website"])
        return {"shopify_probe_output": output.model_dump()}

    parsed = urlparse(website)
    base = f"{parsed.scheme}://{parsed.netloc}"
    probe_paths = ["/cdn/shop/t/", "/products.json", "/collections/all?view=ajax"]
    signals: List[str] = []
    confidence = 0.0

    for path in probe_paths:
        probe_url = urljoin(base.rstrip("/") + "/", path.lstrip("/"))
        result = collect_page_sources(probe_url, timeout_s=12)
        status_raw = result.get("status_code")
        status = status_raw if isinstance(status_raw, int) else 0
        if path == "/products.json" and status in (200, 401, 403):
            signals.append("products-json-endpoint")
            confidence = max(confidence, 0.82)
        if path.startswith("/cdn/shop") and status in (200, 301, 302):
            signals.append("cdn-shop-assets")
            confidence = max(confidence, 0.9)
        if path.startswith("/collections") and status == 200:
            signals.append("collections-all-view")
            confidence = max(confidence, 0.7)

    output = ShopifyProbeOutput(
        performed=True,
        detected=confidence >= 0.75,
        confidence=confidence,
        signals=signals,
    )
    return {"shopify_probe_output": output.model_dump()}
