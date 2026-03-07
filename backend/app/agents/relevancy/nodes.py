from __future__ import annotations

from typing import Dict, List, Optional
from urllib.parse import urljoin

from app.agents.relevancy.schemas import CollectPageSourcesOutput, PageSource
from app.agents.relevancy.state import RelevancyAgentState
from app.agents.relevancy.tools_v2 import (
    collect_page_sources,
    detect_platform,
    extract_clean_text_and_sections,
    extract_structured_signals,
    llm_relevance_judge,
    marketplace_filter,
    shopify_probe,
)

MAX_PAGESOURCE_HTML = 39000


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
        status_code=status_code,
        content_type=None,
        title=None,
        html=html,
        html_len=html_len,
        html_truncated=html_truncated,
        error=" | ".join(expose_errors) if expose_errors else None,
    )


def marketplace_filter_node(state: RelevancyAgentState):
    return marketplace_filter(state)


def collect_page_sources_node(state: RelevancyAgentState):
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

    homepage_result = collect_page_sources(normalized)
    routing_fields = _collect_routing_fields(homepage_result)
    homepage = _to_page_source("homepage", normalized, homepage_result)
    homepage_status = homepage.status_code
    website_exists = homepage.fetched and (homepage_status is None or homepage_status < 400)

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
    candidates = ["about", "products", "shop", "collections", "contact"]
    pages: List[PageSource] = []
    collected_errors: List[str] = []

    for slug in candidates:
        target = urljoin(base_url.rstrip("/") + "/", slug)
        page_result = collect_page_sources(target, timeout_s=12)
        pages.append(_to_page_source(slug, target, page_result))
        page_errors = _collect_errors(page_result)
        if page_errors:
            collected_errors.append(f"{slug}:{page_errors[0]}")

    output = CollectPageSourcesOutput(
        website_exists=True,
        normalized_website=base_url,
        homepage=homepage,
        pages=pages,
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
    elif state.get("is_marketplace") is True:
        reason = "Marketplace URL filtered."
        confidence = 0.95
        mismatch_reasons = ["URL belongs to a marketplace domain."]
        signals_used = ["marketplace_filter"]

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
        "is_finalized": True,
    }


def finalize_manual_review_node(state: RelevancyAgentState):
    block_reason = state.get("collect_block_reason") or "unknown"
    status_code = state.get("collect_status_code")
    status_text = status_code if isinstance(status_code, int) else "unknown"
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
        "is_finalized": True,
    }
