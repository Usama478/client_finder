from __future__ import annotations

import logging
import time
from typing import Dict, List, Optional, Tuple
from urllib.parse import urljoin

from app.agents.relevancy.schemas import CollectPageSourcesOutput, PageSource
from app.agents.relevancy.state import RelevancyAgentState
from app.agents.relevancy.tools_v2 import (
    catalog_intelligence,
    collect_page_sources,
    detect_platform,
    extract_clean_text_and_sections,
    extract_structured_signals,
    business_model_intelligence,
    llm_relevance_judge,
    marketplace_filter,
    shopify_probe,
    social_profile_filter,
)

MAX_PAGESOURCE_HTML = 39000
PRIORITY_ROUTE_LABELS: Tuple[str, ...] = (
    "wholesale",
    "trade",
    "stockists",
    "retailers",
    "stores",
    "about",
    "contact",
    "faq",
    "shipping",
    "products",
    "shop",
    "collections",
    "category",
)
PRIORITY_ROUTE_SLUGS: Tuple[Tuple[str, Tuple[str, ...]], ...] = (
    ("wholesale", ("wholesale", "grosshandel", "b2b")),
    ("trade", ("trade", "trade-program", "haendler")),
    ("stockists", ("stockists", "stockist", "where-to-buy")),
    ("retailers", ("retailers", "retailer", "retail-partners")),
    ("stores", ("stores", "store-locator", "storefinder")),
    ("about", ("about", "about-us", "ueber-uns")),
    ("contact", ("contact", "kontakt", "support")),
    ("faq", ("faq", "faqs", "haeufige-fragen")),
    ("shipping", ("shipping", "delivery", "versand")),
    ("products", ("products", "produkt", "produkte")),
    ("shop", ("shop", "store", "einkaufen")),
    ("collections", ("collections", "collection", "kollektionen")),
    ("category", ("category", "categories", "kategorie")),
)
logger = logging.getLogger(__name__)


def _normalize_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    value = url.strip()
    if not value:
        return None
    if not value.startswith(("http://", "https://")):
        return f"https://{value}"
    return value


def _collect_errors(fetch_result: Dict[str, object]) -> List[str]:
    errors: List[str] = []
    raw_errors = fetch_result.get("errors")
    if isinstance(raw_errors, list):
        for item in raw_errors:
            text = str(item).strip()
            if text:
                errors.append(text)
    blocked = bool(fetch_result.get("blocked"))
    block_reason = fetch_result.get("block_reason")
    if blocked and isinstance(block_reason, str) and block_reason.strip():
        errors.append(f"blocked:{block_reason.strip()}")
    fallback_reason = fetch_result.get("fallback_reason")
    if isinstance(fallback_reason, str) and fallback_reason.strip():
        errors.append(f"fallback:{fallback_reason.strip()}")
    return errors[:12]


def _as_status_code(value: object) -> Optional[int]:
    if isinstance(value, bool) or not isinstance(value, int):
        return None
    if 100 <= value <= 599:
        return value
    return None


def _collect_routing_fields(fetch_result: Dict[str, object]) -> Dict[str, object]:
    status_code = _as_status_code(fetch_result.get("status_code"))
    block_reason = fetch_result.get("block_reason")
    return {
        "collect_blocked": bool(fetch_result.get("blocked")),
        "collect_needs_browser": bool(fetch_result.get("needs_browser")),
        "collect_block_reason": str(block_reason).strip() if isinstance(block_reason, str) and block_reason.strip() else None,
        "collect_status_code": status_code,
    }


def _to_page_source(label: str, requested_url: str, fetch_result: Dict[str, object]) -> PageSource:
    status_code = _as_status_code(fetch_result.get("status_code"))
    final_url = fetch_result.get("final_url")
    fetch_method = fetch_result.get("fetch_method")
    title = fetch_result.get("title")
    rendered_title = fetch_result.get("rendered_title")
    text_snippet = fetch_result.get("text_snippet")
    rendered_text_excerpt = fetch_result.get("rendered_text_excerpt")
    page_diagnostics = fetch_result.get("page_diagnostics") if isinstance(fetch_result.get("page_diagnostics"), list) else []
    raw_html = fetch_result.get("html")
    html_len: Optional[int] = None
    html_truncated = False
    html: Optional[str] = None
    if isinstance(raw_html, str):
        html_len = len(raw_html)
        if html_len > MAX_PAGESOURCE_HTML:
            html = raw_html[:MAX_PAGESOURCE_HTML]
            html_truncated = True
        else:
            html = raw_html
    blocked = bool(fetch_result.get("blocked"))
    errors = _collect_errors(fetch_result)
    fetched = (status_code is None or status_code < 400) and not blocked and isinstance(html, str) and bool(html.strip())
    expose_errors = errors if (not fetched or blocked or (status_code is not None and status_code >= 400)) else []

    return PageSource(
        label=label,
        requested_url=requested_url,
        final_url=str(final_url) if isinstance(final_url, str) else None,
        fetched=fetched,
        fetch_method=(
            str(fetch_method)
            if isinstance(fetch_method, str) and fetch_method in {"curl_cffi", "httpx", "playwright"}
            else None
        ),
        status_code=status_code,
        content_type=None,
        title=str(title).strip() if isinstance(title, str) and title.strip() else None,
        rendered_title=str(rendered_title).strip()
        if isinstance(rendered_title, str) and str(rendered_title).strip()
        else None,
        text_excerpt=str(text_snippet).strip() if isinstance(text_snippet, str) and text_snippet.strip() else None,
        rendered_text_excerpt=str(rendered_text_excerpt).strip()
        if isinstance(rendered_text_excerpt, str) and str(rendered_text_excerpt).strip()
        else None,
        html=html,
        html_len=html_len,
        html_truncated=html_truncated,
        blocked=blocked,
        block_reason=(
            str(fetch_result.get("block_reason")).strip()[:140]
            if isinstance(fetch_result.get("block_reason"), str) and str(fetch_result.get("block_reason")).strip()
            else None
        ),
        needs_browser=bool(fetch_result.get("needs_browser")),
        browser_fallback_reason=(
            str(fetch_result.get("fallback_reason")).strip()[:140]
            if isinstance(fetch_result.get("fallback_reason"), str) and str(fetch_result.get("fallback_reason")).strip()
            else None
        ),
        browser_improved=bool(fetch_result.get("browser_improved")),
        page_diagnostics=[str(item).strip() for item in page_diagnostics if str(item).strip()][:6],
        error=(" | ".join(expose_errors))[:300] if expose_errors else None,
    )


def _normalized_label(value: object, fallback: str = "page") -> str:
    text = str(value or "").strip().lower()
    if not text:
        return fallback
    clean = "".join(ch for ch in text if ch.isalnum() or ch in {"_", "-", " "}).strip()
    if not clean:
        return fallback
    return clean[:40]


def _homepage_link_candidates(base_url: str, homepage_result: Dict[str, object]) -> List[Tuple[str, str]]:
    candidates: List[Tuple[int, int, int, str, str]] = []
    label_rank = {label: idx for idx, label in enumerate(PRIORITY_ROUTE_LABELS)}
    raw_links = homepage_result.get("internal_links")
    if isinstance(raw_links, list):
        for item in raw_links[:16]:
            if not isinstance(item, dict):
                continue
            target = str(item.get("url") or "").strip()
            if not target:
                continue
            label = _normalized_label(item.get("label"), fallback="page")
            priority = label_rank.get(label, len(PRIORITY_ROUTE_LABELS) + 2)
            score = int(item.get("score") or 0)
            candidates.append((priority, 0, -score, label[:40], target))

    for label, slugs in PRIORITY_ROUTE_SLUGS:
        priority = label_rank.get(label, len(PRIORITY_ROUTE_LABELS) + 2)
        for slug in slugs:
            target = urljoin(base_url.rstrip("/") + "/", slug)
            candidates.append((priority, 1, 0, label[:40], target))

    candidates.sort(key=lambda item: (item[0], item[1], item[2], len(item[4])))
    deduped: List[Tuple[str, str]] = []
    seen_urls: set[str] = set()
    for _, _, _, label, target in candidates:
        key = target.rstrip("/")
        if not key or key in seen_urls:
            continue
        seen_urls.add(key)
        deduped.append((label[:40], target))
    return deduped[:16]


def marketplace_filter_node(state: RelevancyAgentState):
    return marketplace_filter(state)


def preclassify_target_node(state: RelevancyAgentState):
    return social_profile_filter(state)


def collect_page_sources_node(state: RelevancyAgentState):
    start_time = time.time()
    normalized = _normalize_url(state.get("website"))
    if not normalized:
        output = CollectPageSourcesOutput(website_exists=False, normalized_website=None)
        return {
            "website_exists": False,
            "collect_sources_output": output.model_dump(),
            "collect_blocked": False,
            "collect_needs_browser": False,
            "collect_block_reason": None,
            "collect_status_code": None,
        }

    homepage_result = collect_page_sources(normalized, collect_internal_links=True, max_internal_pages=2)
    routing_fields = _collect_routing_fields(homepage_result)
    homepage = _to_page_source("homepage", normalized, homepage_result)
    homepage_status = homepage.status_code
    website_exists = homepage.fetched and (homepage_status is None or homepage_status < 400)

    if not website_exists and not homepage.blocked:
        raw_browser_pages = homepage_result.get("browser_pages")
        if isinstance(raw_browser_pages, list):
            for bp in raw_browser_pages:
                if not isinstance(bp, dict) or bp.get("blocked"):
                    continue
                bp_status = bp.get("status_code")
                if bp_status is not None and (not isinstance(bp_status, int) or bp_status >= 400):
                    continue
                if str(bp.get("rendered_text_excerpt") or "").strip() or str(bp.get("rendered_title") or "").strip() or str(bp.get("html") or "").strip():
                    website_exists = True
                    break

    if not website_exists:
        errors = _collect_errors(homepage_result)
        if not errors:
            if homepage_status is not None:
                errors.append(f"status={homepage_status}")
            else:
                errors.append("fetch_failed")
        output = CollectPageSourcesOutput(
            website_exists=False,
            normalized_website=normalized,
            homepage=homepage,
            pages=[],
            fetch_method=homepage.fetch_method,
            browser_fallback_reason=homepage.browser_fallback_reason,
            browser_improved=homepage.browser_improved,
            diagnostics=[str(item).strip() for item in (homepage_result.get("diagnostics") or []) if str(item).strip()],
            errors=errors,
        )
        output_data = output.model_dump()
        output_data.update(
            {
                "blocked": routing_fields["collect_blocked"],
                "block_reason": routing_fields["collect_block_reason"],
                "needs_browser": routing_fields["collect_needs_browser"],
                "status_code": routing_fields["collect_status_code"],
            }
        )
        return {
            "website": homepage.final_url or normalized,
            "website_exists": False,
            "collect_sources_output": output_data,
            **routing_fields,
        }

    base_url = homepage.final_url or normalized
    pages: List[PageSource] = []
    collected_errors: List[str] = []
    seen_targets: set[str] = set()
    force_browser_for_routes = bool(homepage_result.get("needs_browser"))

    raw_browser_pages = homepage_result.get("browser_pages")
    if isinstance(raw_browser_pages, list):
        for browser_page in raw_browser_pages[:2]:
            if not isinstance(browser_page, dict):
                continue
            requested = str(browser_page.get("requested_url") or browser_page.get("final_url") or "").strip()
            if not requested:
                continue
            target_key = requested.rstrip("/")
            if target_key in seen_targets:
                continue
            label = _normalized_label(browser_page.get("label"), fallback="page")
            pages.append(_to_page_source(label, requested, browser_page))
            seen_targets.add(target_key)
            page_errors = _collect_errors(browser_page)
            if page_errors:
                collected_errors.append(f"{label}:{page_errors[0]}")
            if len(pages) >= 2:
                break

    use_browser_session_pages = homepage_result.get("fetch_method") == "playwright" and bool(raw_browser_pages)
    if not use_browser_session_pages:
        for label, target in _homepage_link_candidates(base_url, homepage_result):
            if len(pages) >= 2:
                break
            
            elapsed = time.time() - start_time
            remaining_budget = 60.0 - elapsed
            if remaining_budget <= 0:
                logger.warning(f"collect_v2 node global timeout budget exceeded (60s) on {base_url}")
                collected_errors.append("timeout:global_60s_budget_exceeded")
                break

            target_key = target.rstrip("/")
            if target_key in seen_targets:
                continue
            
            fetch_timeout = max(5, int(remaining_budget))
            page_result = collect_page_sources(target, timeout_s=fetch_timeout, force_browser=force_browser_for_routes)
            pages.append(_to_page_source(label, target, page_result))
            seen_targets.add(target_key)
            page_errors = _collect_errors(page_result)
            if page_errors:
                collected_errors.append(f"{label}:{page_errors[0]}")

    logger.info(
        "collect_v2 node website=%s homepage_method=%s homepage_browser=%s pages=%s",
        base_url,
        homepage.fetch_method,
        homepage.needs_browser,
        len(pages),
    )

    output = CollectPageSourcesOutput(
        website_exists=True,
        normalized_website=base_url,
        homepage=homepage,
        pages=pages,
        fetch_method=homepage.fetch_method,
        browser_fallback_reason=homepage.browser_fallback_reason,
        browser_improved=homepage.browser_improved,
        diagnostics=[str(item).strip() for item in (homepage_result.get("diagnostics") or []) if str(item).strip()],
        errors=collected_errors,
    )
    output_data = output.model_dump()
    output_data.update(
        {
            "blocked": routing_fields["collect_blocked"],
            "block_reason": routing_fields["collect_block_reason"],
            "needs_browser": routing_fields["collect_needs_browser"],
            "status_code": routing_fields["collect_status_code"],
        }
    )
    return {
        "website": base_url,
        "website_exists": True,
        "collect_sources_output": output_data,
        **routing_fields,
    }


def detect_platform_node(state: RelevancyAgentState):
    return detect_platform(state)


def shopify_probe_node(state: RelevancyAgentState):
    return shopify_probe(state)


def extract_structured_signals_node(state: RelevancyAgentState):
    return extract_structured_signals(state)


def extract_clean_text_and_sections_node(state: RelevancyAgentState):
    return extract_clean_text_and_sections(state)


def catalog_intelligence_node(state: RelevancyAgentState):
    return catalog_intelligence(state)


def business_model_intelligence_node(state: RelevancyAgentState):
    return business_model_intelligence(state)


def llm_relevance_judge_node(state: RelevancyAgentState):
    return llm_relevance_judge(state)


def end_irrelevant_node(state: RelevancyAgentState):
    decision = "irrelevant"
    manual_review = False
    confidence = 0.75
    reason = "Rejected by gatekeeper."
    mismatch_reasons: List[str] = ["Failed initial routing gate."]
    signals_used: List[str] = []

    if state.get("website_exists") is False:
        status_code = state.get("collect_status_code")
        if isinstance(status_code, int) and status_code in (404, 410):
            reason = f"Website unavailable (HTTP {status_code})."
            confidence = 0.9
            mismatch_reasons = [f"Website returned HTTP {status_code}."]
            signals_used = ["collect_status"]
        else:
            decision = "unknown"
            manual_review = True
            confidence = 0.2
            reason = "Website could not be reliably reached."
            mismatch_reasons = ["Website reachability is inconclusive with current fetch signals."]
            signals_used = ["collect_status", "headers_cookies"]
    elif state.get("is_social_profile") is True:
        reason = "Social media profile detected; skipping deep analysis."
        confidence = 0.95
        mismatch_reasons = ["URL belongs to a social media domain."]
        signals_used = ["social_detect"]
    elif state.get("is_marketplace") is True:
        reason = "Marketplace URL filtered."
        confidence = 0.95
        mismatch_reasons = ["URL belongs to a marketplace domain."]
        signals_used = ["marketplace_filter"]

    decision_output = {
        "relevance_decision": decision,
        "relevance_score": 0,
        "relevance_reason": reason,
        "business_type": "Unknown",
        "primary_niche": "Unknown",
        "manual_review": manual_review,
        "confidence": confidence,
        "match_reasons": [],
        "mismatch_reasons": mismatch_reasons,
        "signals_used": signals_used,
    }

    return {
        "relevance_decision": decision,
        "relevance_score": 0,
        "relevance_reason": reason,
        "business_type": "Unknown",
        "primary_niche": "Unknown",
        "manual_review": manual_review,
        "confidence": confidence,
        "match_reasons": [],
        "mismatch_reasons": mismatch_reasons,
        "signals_used": signals_used,
        "llm_decision_output": decision_output,
        "is_finalized": True,
    }


def finalize_manual_review_node(state: RelevancyAgentState):
    block_reason = state.get("collect_block_reason") or "unknown"
    status_code = state.get("collect_status_code")
    status_text = status_code if isinstance(status_code, int) else "unknown"
    decision_output = {
        "relevance_decision": "unknown",
        "relevance_score": 0,
        "relevance_reason": f"blocked:{block_reason} status={status_text}",
        "business_type": "Unknown",
        "primary_niche": "Unknown",
        "manual_review": True,
        "confidence": 0.0,
        "match_reasons": [],
        "mismatch_reasons": [f"Blocked during collection ({block_reason})."],
        "signals_used": ["blocked_status"],
    }

    return {
        "relevance_decision": "unknown",
        "relevance_score": 0,
        "relevance_reason": f"blocked:{block_reason} status={status_text}",
        "business_type": "Unknown",
        "primary_niche": "Unknown",
        "manual_review": True,
        "confidence": 0.0,
        "match_reasons": [],
        "mismatch_reasons": [f"Blocked during collection ({block_reason})."],
        "signals_used": ["blocked_status"],
        "llm_decision_output": decision_output,
        "is_finalized": True,
    }
