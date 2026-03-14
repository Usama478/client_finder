from __future__ import annotations

import re
from typing import Any, Dict, List
from urllib.parse import urlparse

from app.agents.relevancy.schemas import PlatformDetectionOutput
from app.agents.relevancy.state import RelevancyAgentState

MARKETPLACE_DOMAINS = {
    "amazon.",
    "etsy.",
    "ebay.",
    "alibaba.",
    "aliexpress.",
    "walmart.",
    "temu.",
    "daraz.",
}
SHOPIFY_META_GENERATOR_RE = re.compile(
    r'<meta[^>]+name=["\']generator["\'][^>]+content=["\']([^"\']+)["\']',
    re.IGNORECASE,
)
SHOPIFY_HTML_MARKERS = (
    "cdn.shopify.com",
    "shopify.theme",
    "shopify-section",
    "shopify-payment-button",
    "myshopify.com",
)
SHOPIFY_COOKIE_MARKERS = ("__st", "_shopify", "shopify_pay")
SHOPIFY_HEADER_MARKERS = ("x-shopid", "x-shopify")


def marketplace_filter(state: RelevancyAgentState) -> Dict[str, object]:
    raw_url = (state.get("website") or "").lower()
    if not raw_url:
        return {"is_marketplace": False}

    domain = urlparse(raw_url if raw_url.startswith("http") else f"https://{raw_url}").netloc.lower()
    is_marketplace = any(token in domain for token in MARKETPLACE_DOMAINS)
    return {"is_marketplace": is_marketplace}


def _string_map(raw: Any) -> Dict[str, str]:
    if not isinstance(raw, dict):
        return {}
    output: Dict[str, str] = {}
    for key, value in raw.items():
        key_text = str(key).strip().lower()
        value_text = str(value).strip().lower()
        if key_text:
            output[key_text] = value_text
    return output


def _collect_headers(collect: Dict[str, object], homepage: Dict[str, object]) -> Dict[str, str]:
    homepage_headers = _string_map(homepage.get("headers"))
    collect_headers = _string_map(collect.get("headers"))
    if homepage_headers:
        return homepage_headers
    return collect_headers


def _collect_cookie_blob(collect: Dict[str, object], homepage: Dict[str, object], headers: Dict[str, str]) -> str:
    parts: List[str] = []
    set_cookie_header = headers.get("set-cookie")
    if set_cookie_header:
        parts.append(set_cookie_header)

    for source in (collect.get("cookies"), homepage.get("cookies")):
        if isinstance(source, list):
            parts.extend(str(item).lower() for item in source)
        elif isinstance(source, str):
            parts.append(source.lower())

    return " | ".join(parts)


def _shopify_indicators(html: str, headers: Dict[str, str], cookie_blob: str) -> List[str]:
    indicators: List[str] = []

    if "cdn.shopify.com" in html:
        indicators.append("html.cdn_shopify")

    meta_matches = SHOPIFY_META_GENERATOR_RE.findall(html)
    if any("shopify" in value.lower() for value in meta_matches):
        indicators.append("meta.generator_shopify")

    if "__st" in html:
        indicators.append("html.__st_cookie")

    if any(marker in cookie_blob for marker in SHOPIFY_COOKIE_MARKERS):
        indicators.append("cookie.shopify")

    header_names = set(headers.keys())
    if any(marker in key for marker in SHOPIFY_HEADER_MARKERS for key in header_names):
        indicators.append("header.shopify")

    return indicators


def detect_platform(state: RelevancyAgentState) -> Dict[str, object]:
    collect = state.get("collect_sources_output") or {}
    homepage = collect.get("homepage") or {}
    html = (homepage.get("html") or "").lower()
    final_url = (homepage.get("final_url") or state.get("website") or "").lower()
    headers = _collect_headers(collect, homepage)
    cookie_blob = _collect_cookie_blob(collect, homepage, headers)
    indicator_signals = _shopify_indicators(html, headers, cookie_blob)

    reasons: List[str] = []
    platform = "unknown"
    confidence = 0.0
    shopify_confidence = 0.0

    if any(marker in html for marker in SHOPIFY_HTML_MARKERS):
        platform = "shopify"
        confidence = 0.9
        shopify_confidence = 0.9
        reasons.append("shopify signatures in homepage html")
    elif any(token in headers for token in ("x-shopid", "x-shopify-stage", "x-shopify-shop-api-call-limit")):
        platform = "shopify"
        confidence = 0.84
        shopify_confidence = 0.84
        reasons.append("shopify response headers")
    elif "shopify" in cookie_blob:
        platform = "shopify"
        confidence = 0.76
        shopify_confidence = 0.76
        reasons.append("shopify cookie markers")
    elif "wp-content" in html:
        # Require explicit WooCommerce-specific markers; bare wp-content alone means WordPress
        woocommerce_markers = (
            "woocommerce",   # class/script text present in page
            "/wc-api/",      # WooCommerce REST API path
            "?add-to-cart=", # WooCommerce cart query param
        )
        is_woocommerce = (
            any(marker in html for marker in woocommerce_markers)
            or "woocommerce_" in cookie_blob
        )
        if is_woocommerce:
            platform = "woocommerce"
            confidence = 0.86
            reasons.append("woocommerce specific signatures")
        else:
            platform = "wordpress"
            confidence = 0.65
            reasons.append("wordpress asset path (no woocommerce markers)")
    elif "myshopify.com" in final_url:
        platform = "shopify"
        confidence = 0.81
        reasons.append("myshopify domain")
    elif html:
        platform = "custom"
        confidence = 0.42
        reasons.append("no known cms signature")

    if indicator_signals:
        reasons.extend(indicator_signals)
        indicator_confidence = 0.75 if len(indicator_signals) == 1 else 0.88
        shopify_confidence = max(shopify_confidence, indicator_confidence)
        if platform in ("unknown", "custom") and indicator_confidence >= 0.8:
            platform = "shopify"
            confidence = indicator_confidence

    if platform == "shopify":
        shopify_confidence = max(shopify_confidence, confidence)

    shopify_detected = shopify_confidence >= 0.8
    should_probe_shopify = state.get("collect_blocked") is not True and (
        shopify_confidence >= 0.7 or bool(indicator_signals)
    )
    output = PlatformDetectionOutput(
        platform=platform,
        confidence=confidence,
        shopify_detected=shopify_detected,
        reasons=reasons,
    )
    return {
        "platform_detection_output": output.model_dump(),
        "should_run_shopify_probe": should_probe_shopify,
    }
