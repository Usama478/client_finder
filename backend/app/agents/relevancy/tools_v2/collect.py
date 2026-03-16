from __future__ import annotations

import logging
import re
from html import unescape
from typing import Dict, List, Literal, Optional, Tuple
from urllib.parse import urljoin, urlparse

import httpx

from app.agents.relevancy.schemas import ShopifyProbeOutput
from app.agents.relevancy.state import RelevancyAgentState
from app.agents.relevancy.utils import BLOCK_MARKERS, normalize_url as _normalize_url
from app.agents.relevancy.tools_v2.browser_collect import collect_with_playwright

try:
    from curl_cffi import requests as curl_requests
except Exception:
    curl_requests = None

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)

logger = logging.getLogger(__name__)
FetchMethod = Literal["curl_cffi", "httpx", "playwright"]
MIN_HTML_BYTES = 800
MIN_HOMEPAGE_TEXT = 140
MIN_ROUTE_TEXT = 110
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


def _new_result(fetch_method: FetchMethod) -> Dict[str, object]:
    return {
        "final_url": None,
        "status_code": None,
        "title": None,
        "rendered_title": None,
        "html": None,
        "text_snippet": None,
        "rendered_text_excerpt": None,
        "blocked": False,
        "block_reason": None,
        "fetch_method": fetch_method,
        "needs_browser": False,
        "fallback_reason": None,
        "browser_improved": False,
        "page_diagnostics": [],
        "internal_links": [],
        "browser_pages": [],
        "diagnostics": [],
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
    return text[:900]


def _is_html_too_short(html: Optional[str]) -> bool:
    if not html:
        return True
    return len(html.encode("utf-8", errors="ignore")) < MIN_HTML_BYTES


def _path_kind(url: str) -> str:
    path = (urlparse(url).path or "/").strip().lower()
    if path in {"", "/"}:
        return "homepage"
    for token in ("/shop", "/store", "/products", "/product", "/collections", "/collection", "/category", "/catalog"):
        if token in path:
            return "commerce"
    for token in ("/about", "/contact", "/support"):
        if token in path:
            return "info"
    return "other"


def _is_text_weak(text_snippet: Optional[str], path_kind: str) -> bool:
    if not text_snippet:
        return True
    snippet_len = len(text_snippet.strip())
    if path_kind == "homepage":
        return snippet_len < MIN_HOMEPAGE_TEXT
    if path_kind in {"commerce", "info"}:
        return snippet_len < MIN_ROUTE_TEXT
    return snippet_len < 85


def _is_js_heavy_low_text(html: Optional[str], text_snippet: Optional[str]) -> bool:
    if not html:
        return False
    script_count = html.lower().count("<script")
    snippet_len = len((text_snippet or "").strip())
    return script_count >= 15 and snippet_len < 3000


def _contains_js_gate(html: Optional[str]) -> bool:
    if not html:
        return False
    lowered = html.lower()
    return any(marker in lowered for marker in JS_REQUIRED_MARKERS)


def _detect_block(status_code: Optional[int], html: Optional[str], text_snippet: Optional[str]) -> Tuple[bool, Optional[str]]:
    if status_code in (403, 429):
        return True, f"http_{status_code}"
    lowered = (html or "").lower()
    
    is_rich = bool(status_code == 200 and len((text_snippet or "").strip()) > 350)
    
    for keyword, reason in BLOCK_MARKERS:
        if keyword in lowered:
            if is_rich and reason in {"captcha", "bot_challenge", "cloudflare_challenge"}:
                continue
            return True, reason
    return False, None


def _weak_content_reason(
    url: str,
    status_code: Optional[int],
    html: Optional[str],
    text_snippet: Optional[str],
) -> Optional[str]:
    if status_code in (403, 429):
        return f"http_{status_code}"
    if status_code in (204, 205):
        return "empty_status_body"
    if _contains_js_gate(html):
        return "javascript_required"
    if _is_html_too_short(html):
        return "html_too_short"
    if _is_js_heavy_low_text(html, text_snippet):
        return "js_heavy_low_text"
    if _is_text_weak(text_snippet, _path_kind(url)):
        return "text_too_short"
    return None


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


def _build_result(
    fetch_method: FetchMethod,
    final_url: Optional[str],
    status_code: Optional[int],
    html: Optional[str],
    title: Optional[str],
    text_snippet: Optional[str],
    rendered_title: Optional[str],
    rendered_text_excerpt: Optional[str],
    page_diagnostics: Optional[List[str]],
    errors: List[str],
) -> Dict[str, object]:
    computed_text = text_snippet if text_snippet is not None else _extract_text_snippet(html)
    blocked, block_reason = _detect_block(status_code, html, computed_text)
    result = _new_result(fetch_method)
    result["final_url"] = final_url
    result["status_code"] = status_code
    result["title"] = title
    result["rendered_title"] = rendered_title
    result["html"] = html
    result["text_snippet"] = computed_text
    result["rendered_text_excerpt"] = rendered_text_excerpt
    result["blocked"] = blocked
    result["block_reason"] = block_reason
    result["page_diagnostics"] = [str(item).strip() for item in (page_diagnostics or []) if str(item).strip()][:6]
    result["errors"] = errors
    return result


def collect_page_sources(
    url: str,
    timeout_s: int = 15,
    force_browser: bool = False,
    collect_internal_links: bool = False,
    max_internal_pages: int = 4,
) -> Dict[str, object]:
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
            primary_result = _build_result(
                "curl_cffi",
                final_url,
                status_code,
                html,
                None,
                None,
                None,
                None,
                None,
                list(errors),
            )
        except Exception as exc:
            errors.append(f"curl_cffi:{type(exc).__name__}:{exc}")
    else:
        errors.append("curl_cffi:unavailable")

    if primary_result is None:
        try:
            final_url, status_code, html = _fetch_with_httpx(normalized, timeout_s)
            primary_result = _build_result(
                "httpx",
                final_url,
                status_code,
                html,
                None,
                None,
                None,
                None,
                None,
                list(errors),
            )
        except Exception as exc:
            errors.append(f"httpx:{type(exc).__name__}:{exc}")
            failed = _new_result("httpx")
            failed["blocked"] = True
            failed["block_reason"] = "fetch_failed"
            failed["diagnostics"] = ["path=http", "fetch=failed"]
            failed["errors"] = errors
            return failed

    status_code = primary_result.get("status_code")
    html = primary_result.get("html")
    text_snippet = primary_result.get("text_snippet")
    method_used = str(primary_result.get("fetch_method") or "httpx")

    blocked = bool(primary_result.get("blocked"))
    block_reason = primary_result.get("block_reason")
    weak_reason = _weak_content_reason(
        normalized,
        status_code if isinstance(status_code, int) else None,
        html if isinstance(html, str) else None,
        text_snippet if isinstance(text_snippet, str) else None,
    )
    needs_browser = force_browser or blocked or bool(weak_reason)

    primary_result["needs_browser"] = needs_browser
    primary_result["diagnostics"] = [
        "path=http",
        f"method={method_used}",
        f"blocked={blocked}",
    ]
    if weak_reason:
        primary_result["diagnostics"].append(f"weak={weak_reason}")
    if force_browser:
        primary_result["diagnostics"].append("browser=forced")

    if not needs_browser:
        primary_result["errors"] = errors
        logger.info(
            "collect_v2 path=http url=%s method=%s status=%s blocked=%s",
            normalized,
            method_used,
            status_code,
            blocked,
        )
        return primary_result

    reason = "forced_browser"
    if blocked and isinstance(block_reason, str) and block_reason:
        reason = block_reason
    elif weak_reason:
        reason = weak_reason
    errors.append(f"{method_used}:fallback:{reason}")
    logger.info("collect_v2 fallback url=%s from=%s reason=%s", normalized, method_used, reason)

    try:
        browser_payload = collect_with_playwright(
            normalized,
            timeout_s=timeout_s,
            user_agent=USER_AGENT,
            include_internal_pages=collect_internal_links,
            max_internal_pages=max_internal_pages,
        )
        homepage = browser_payload.get("homepage") if isinstance(browser_payload.get("homepage"), dict) else {}
        final_url = homepage.get("final_url")
        pw_status = homepage.get("status_code")
        pw_html = homepage.get("html")
        pw_title = homepage.get("title")
        pw_rendered_title = homepage.get("rendered_title")
        pw_text = homepage.get("text_snippet")
        pw_rendered_text = homepage.get("rendered_text_excerpt")
        page_diagnostics = homepage.get("page_diagnostics") if isinstance(homepage.get("page_diagnostics"), list) else []

        pw_result = _build_result(
            "playwright",
            str(final_url) if isinstance(final_url, str) else normalized,
            pw_status if isinstance(pw_status, int) else None,
            pw_html if isinstance(pw_html, str) else None,
            str(pw_title) if isinstance(pw_title, str) else None,
            str(pw_text) if isinstance(pw_text, str) else None,
            str(pw_rendered_title) if isinstance(pw_rendered_title, str) else None,
            str(pw_rendered_text) if isinstance(pw_rendered_text, str) else None,
            [str(item).strip() for item in page_diagnostics if str(item).strip()],
            list(errors),
        )
        # Fix 2: If Playwright natively detected a block, ensure pw_result captures it.
        if homepage.get("blocked"):
            pw_result["blocked"] = True
            pw_result["block_reason"] = homepage.get("block_reason")
            
        pw_result["needs_browser"] = True
        pw_result["fallback_reason"] = reason
        pw_result["internal_links"] = (
            browser_payload.get("internal_links") if isinstance(browser_payload.get("internal_links"), list) else []
        )
        pw_result["browser_pages"] = (
            browser_payload.get("visited_pages") if isinstance(browser_payload.get("visited_pages"), list) else []
        )
        diagnostics = list(primary_result.get("diagnostics") or [])
        browser_diags = browser_payload.get("diagnostics") if isinstance(browser_payload.get("diagnostics"), list) else []
        diagnostics.extend(str(item).strip() for item in browser_diags if str(item).strip())
        pw_result["diagnostics"] = diagnostics[:12]

        pw_weak_reason = _weak_content_reason(
            str(pw_result.get("final_url") or normalized),
            pw_result.get("status_code") if isinstance(pw_result.get("status_code"), int) else None,
            pw_result.get("html") if isinstance(pw_result.get("html"), str) else None,
            str(pw_result.get("rendered_text_excerpt") or pw_result.get("text_snippet") or ""),
        )
        primary_text_len = len(str(text_snippet or "").strip())
        browser_text_len = len(
            str(pw_result.get("rendered_text_excerpt") or pw_result.get("text_snippet") or "").strip()
        )
        improved = bool(
            not pw_result.get("blocked")
            and (
                (bool(weak_reason) and not pw_weak_reason)
                or browser_text_len > (primary_text_len + 80)
                or (
                    bool(str(pw_result.get("rendered_title") or "").strip())
                    and not bool(str(primary_result.get("title") or "").strip())
                )
            )
        )
        pw_result["browser_improved"] = improved
        if pw_weak_reason:
            diagnostics = list(pw_result.get("diagnostics") or [])
            diagnostics.append(f"browser_weak={pw_weak_reason}")
            pw_result["diagnostics"] = diagnostics[:12]

        logger.info(
            "collect_v2 path=browser url=%s status=%s blocked=%s improved=%s reason=%s",
            pw_result.get("final_url") or normalized,
            pw_result.get("status_code"),
            pw_result.get("blocked"),
            improved,
            reason,
        )
        return pw_result
    except Exception as exc:
        errors.append(f"playwright:{type(exc).__name__}:{exc}")
        primary_result["errors"] = errors
        primary_result["fallback_reason"] = reason
        # Guarantee exported fetch_method represents the terminal fallback path used
        primary_result["fetch_method"] = "playwright"
        diagnostics = list(primary_result.get("diagnostics") or [])
        diagnostics.append("path=http:fallback_failed")
        primary_result["diagnostics"] = diagnostics[:12]
        logger.info(
            "collect_v2 path=http_fallback_failed url=%s method=%s reason=%s",
            normalized,
            method_used,
            reason,
        )
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
        if path == "/products.json":
            # 200 → endpoint returned data (strong signal).
            # 401 → endpoint exists but requires auth (strong signal).
            # 403 alone is NOT treated as a signal: any WAF or Cloudflare
            # firewall returns 403 for arbitrary paths, so it carries no
            # Shopify-specific information without corroborating evidence.
            if status in (200, 401):
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
