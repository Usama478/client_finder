"""
Pytest coverage for the relevancy agent's routing logic.

Design principles:
- Routing functions (_route_after_*) are tested as pure functions with crafted
  state dicts — no network calls, no DB, no LLM.
- Two end-to-end smoke tests invoke the compiled graph with all heavy nodes
  mocked so only the routing wiring is exercised.
- The old test_social_routing.py used asyncio + ainvoke on a sync-compiled
  graph; that file is superseded by this one.
"""

from __future__ import annotations

from typing import Any, Dict
from unittest.mock import patch

import pytest

from app.agents.relevancy.graph import (
    _route_after_collect,
    _route_after_platform,
    _route_after_preclassify,
    _route_after_structured,
    relevancy_graph,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _base_state(**overrides: Any) -> Dict[str, Any]:
    """Minimal state dict with safe defaults; caller overrides as needed."""
    state: Dict[str, Any] = {
        "business_id": 1,
        "search_id": 1,
        "business_name": "Test Business",
        "category": None,
        "website": "https://example.com",
        "address": None,
        "description": None,
        "exporter_profile": "premium clothing wholesaler",
        "website_exists": None,
        "is_marketplace": False,
        "is_social_profile": False,
        "evidence": None,
        "collect_sources_output": {},
        "collect_blocked": False,
        "collect_block_reason": None,
        "collect_needs_browser": False,
        "collect_status_code": None,
        "platform_detection_output": {
            "platform": "unknown",
            "confidence": 0.0,
            "shopify_detected": False,
            "reasons": [],
        },
        "shopify_probe_output": {
            "performed": False,
            "detected": False,
            "confidence": 0.0,
            "signals": [],
        },
        "structured_signals_output": {
            "entities": [],
            "counts": {"json-ld": 0, "microdata": 0, "rdfa": 0},
            "signal_flags": [],
            "strong_signal": False,
            "quality": "empty",
            "structured_has_product_catalog": False,
            "structured_has_organization": False,
            "structured_signal_strength": "none",
            "structured_signals_used": [],
        },
        "clean_text_output": {"text_excerpt": "", "sections": {}},
        "catalog_intelligence_output": {},
        "business_model_intelligence_output": {},
        "llm_decision_output": {},
        "structured_has_product_catalog": False,
        "structured_has_organization": False,
        "structured_signal_strength": "none",
        "structured_signals_used": [],
        "should_run_shopify_probe": False,
        "relevance_decision": None,
        "relevance_score": None,
        "relevance_reason": None,
        "business_type": None,
        "primary_niche": None,
        "manual_review": False,
        "confidence": 0.0,
        "match_reasons": [],
        "mismatch_reasons": [],
        "signals_used": [],
        "is_finalized": False,
    }
    state.update(overrides)
    return state


# ---------------------------------------------------------------------------
# _route_after_preclassify
# ---------------------------------------------------------------------------

class TestRouteAfterPreclassify:
    def test_social_profile_routes_to_end_irrelevant(self):
        state = _base_state(is_social_profile=True)
        assert _route_after_preclassify(state) == "end_irrelevant"

    def test_marketplace_routes_to_end_irrelevant(self):
        state = _base_state(is_marketplace=True)
        assert _route_after_preclassify(state) == "end_irrelevant"

    def test_normal_site_routes_to_collect(self):
        state = _base_state(is_social_profile=False, is_marketplace=False)
        assert _route_after_preclassify(state) == "collect_page_sources"

    def test_both_flags_true_social_wins(self):
        # social is checked first; result is still end_irrelevant
        state = _base_state(is_social_profile=True, is_marketplace=True)
        assert _route_after_preclassify(state) == "end_irrelevant"


# ---------------------------------------------------------------------------
# _route_after_collect
# ---------------------------------------------------------------------------

class TestRouteAfterCollect:
    def test_blocked_routes_to_finalize_manual_review(self):
        state = _base_state(collect_blocked=True, website_exists=False)
        assert _route_after_collect(state) == "finalize_manual_review"

    def test_blocked_with_partial_html_routes_to_finalize_manual_review(self):
        # Even if website_exists is somehow True while blocked, blocked wins.
        state = _base_state(collect_blocked=True, website_exists=True)
        assert _route_after_collect(state) == "finalize_manual_review"

    def test_404_routes_to_end_irrelevant(self):
        state = _base_state(collect_blocked=False, website_exists=False, collect_status_code=404)
        assert _route_after_collect(state) == "end_irrelevant"

    def test_410_routes_to_end_irrelevant(self):
        state = _base_state(collect_blocked=False, website_exists=False, collect_status_code=410)
        assert _route_after_collect(state) == "end_irrelevant"

    def test_503_routes_to_finalize_manual_review(self):
        # 503 is transient / recoverable — should be manual review, not irrelevant.
        state = _base_state(collect_blocked=False, website_exists=False, collect_status_code=503)
        assert _route_after_collect(state) == "finalize_manual_review"

    def test_401_routes_to_finalize_manual_review(self):
        # 401 means the site exists but requires auth.
        state = _base_state(collect_blocked=False, website_exists=False, collect_status_code=401)
        assert _route_after_collect(state) == "finalize_manual_review"

    def test_unknown_status_routes_to_finalize_manual_review(self):
        state = _base_state(collect_blocked=False, website_exists=False, collect_status_code=None)
        assert _route_after_collect(state) == "finalize_manual_review"

    def test_healthy_site_routes_to_extract(self):
        state = _base_state(collect_blocked=False, website_exists=True)
        assert _route_after_collect(state) == "extract_structured_signals"


# ---------------------------------------------------------------------------
# _route_after_structured
# ---------------------------------------------------------------------------

class TestRouteAfterStructured:
    def test_blocked_guard_returns_finalize_manual_review(self):
        # Defensive: collect_blocked should never be True here in normal flow,
        # but the guard must still route correctly.
        state = _base_state(
            collect_blocked=True,
            website_exists=True,
            structured_signals_output={
                "structured_signal_strength": "strong",
                "structured_has_product_catalog": True,
            },
        )
        assert _route_after_structured(state) == "finalize_manual_review"

    def test_strong_catalog_takes_fast_path(self):
        state = _base_state(
            collect_blocked=False,
            structured_signals_output={
                "structured_signal_strength": "strong",
                "structured_has_product_catalog": True,
            },
        )
        assert _route_after_structured(state) == "catalog_intelligence"

    def test_strong_signal_without_catalog_does_not_fast_path(self):
        state = _base_state(
            collect_blocked=False,
            structured_signals_output={
                "structured_signal_strength": "strong",
                "structured_has_product_catalog": False,
            },
        )
        assert _route_after_structured(state) == "extract_clean_text_and_sections"

    def test_weak_signal_routes_to_clean_text(self):
        state = _base_state(
            collect_blocked=False,
            structured_signals_output={
                "structured_signal_strength": "weak",
                "structured_has_product_catalog": True,
            },
        )
        assert _route_after_structured(state) == "extract_clean_text_and_sections"

    def test_empty_structured_output_routes_to_clean_text(self):
        state = _base_state(collect_blocked=False, structured_signals_output={})
        assert _route_after_structured(state) == "extract_clean_text_and_sections"


# ---------------------------------------------------------------------------
# _route_after_platform
# ---------------------------------------------------------------------------

class TestRouteAfterPlatform:
    def test_blocked_guard_returns_finalize_manual_review(self):
        state = _base_state(collect_blocked=True, should_run_shopify_probe=False)
        assert _route_after_platform(state) == "finalize_manual_review"

    def test_shopify_probe_requested(self):
        state = _base_state(collect_blocked=False, should_run_shopify_probe=True)
        assert _route_after_platform(state) == "shopify_probe"

    def test_no_probe_routes_to_catalog(self):
        state = _base_state(collect_blocked=False, should_run_shopify_probe=False)
        assert _route_after_platform(state) == "catalog_intelligence"


# ---------------------------------------------------------------------------
# Graph smoke tests (all heavy nodes mocked)
# ---------------------------------------------------------------------------

def _make_preclassify_mock(is_social: bool = False, is_marketplace: bool = False):
    def _mock(state):
        return {"is_social_profile": is_social, "is_marketplace": is_marketplace}
    return _mock


def _make_collect_mock(blocked: bool = False, website_exists: bool = True, status_code: int = 200):
    def _mock(state):
        return {
            "collect_blocked": blocked,
            "collect_block_reason": "cloudflare_challenge" if blocked else None,
            "collect_needs_browser": False,
            "collect_status_code": status_code if not website_exists else 200,
            "website_exists": website_exists,
            "collect_sources_output": {"website_exists": website_exists, "normalized_website": state.get("website")},
        }
    return _mock


def _noop_node(state):
    return {}


def _judge_node(state):
    return {
        "relevance_decision": "irrelevant",
        "relevance_score": 10,
        "relevance_reason": "Mocked judge output.",
        "manual_review": False,
        "confidence": 0.85,
        "match_reasons": [],
        "mismatch_reasons": ["mocked"],
        "signals_used": ["mock"],
        "llm_decision_output": {
            "relevance_decision": "irrelevant",
            "relevance_score": 10,
            "relevance_reason": "Mocked judge output.",
            "manual_review": False,
            "confidence": 0.85,
            "match_reasons": [],
            "mismatch_reasons": ["mocked"],
            "signals_used": ["mock"],
            "business_type": "Retailer",
            "primary_niche": "Fashion",
        },
        "is_finalized": True,
    }


# ---------------------------------------------------------------------------
# Shopify probe — probe_only flag
# ---------------------------------------------------------------------------

class TestShopifyProbeOnly:
    """collect_page_sources called with probe_only=True must not launch browser."""

    def test_probe_only_returns_without_browser_on_404(self):
        from app.agents.relevancy.tools_v2.collect import collect_page_sources

        fake_result = {
            "final_url": "https://not-shopify.example.com/products.json",
            "status_code": 404,
            "html": "<html><body>Not Found</body></html>",
            "text_snippet": "Not Found",
            "blocked": False,
            "block_reason": None,
            "fetch_method": "curl_cffi",
            "needs_browser": False,
            "fallback_reason": None,
            "browser_improved": False,
            "page_diagnostics": [],
            "internal_links": [],
            "browser_pages": [],
            "diagnostics": [],
            "errors": [],
            "rendered_title": None,
            "rendered_text_excerpt": None,
            "title": None,
        }
        with patch(
            "app.agents.relevancy.tools_v2.collect._fetch_with_curl_cffi",
            return_value=("https://not-shopify.example.com/products.json", 404, "<html><body>Not Found</body></html>"),
        ), patch(
            "app.agents.relevancy.tools_v2.collect.collect_with_playwright",
        ) as mock_pw:
            result = collect_page_sources(
                "https://not-shopify.example.com/products.json",
                timeout_s=5,
                probe_only=True,
            )
        mock_pw.assert_not_called()
        assert result.get("needs_browser") is False

    def test_probe_only_returns_without_browser_on_403(self):
        from app.agents.relevancy.tools_v2.collect import collect_page_sources

        with patch(
            "app.agents.relevancy.tools_v2.collect._fetch_with_curl_cffi",
            return_value=("https://example.com/products.json", 403, "<html>Forbidden</html>"),
        ), patch(
            "app.agents.relevancy.tools_v2.collect.collect_with_playwright",
        ) as mock_pw:
            result = collect_page_sources(
                "https://example.com/products.json",
                timeout_s=5,
                probe_only=True,
            )
        mock_pw.assert_not_called()
        assert result.get("needs_browser") is False
        # 403 still sets blocked=True via _detect_block — that's correct
        assert result.get("status_code") == 403

    def test_non_probe_still_escalates_on_weak_content(self):
        """Without probe_only, the normal escalation path is unchanged."""
        from app.agents.relevancy.tools_v2.collect import collect_page_sources

        # Return a short HTML page that _weak_content_reason will flag
        with patch(
            "app.agents.relevancy.tools_v2.collect._fetch_with_curl_cffi",
            return_value=("https://js-heavy.example.com", 200, "<html><body>Hi</body></html>"),
        ), patch(
            "app.agents.relevancy.tools_v2.collect.collect_with_playwright",
            side_effect=RuntimeError("pw not needed for assertion"),
        ):
            result = collect_page_sources(
                "https://js-heavy.example.com",
                timeout_s=5,
                probe_only=False,
            )
        # The result may come from the Playwright exception path; the key check
        # is that needs_browser was set to True before the attempt was made.
        assert result.get("needs_browser") is True


_NODES_MODULE = "app.agents.relevancy.nodes"


class TestGraphSmoke:
    """End-to-end routing wiring tests with all side-effectful nodes mocked."""

    def test_social_profile_ends_irrelevant(self):
        """Facebook URL → preclassify → end_irrelevant → irrelevant decision."""
        state = _base_state(website="https://www.facebook.com/TVFashionOutletDallas")
        with patch(f"{_NODES_MODULE}.preclassify_target_node", side_effect=_make_preclassify_mock(is_social=True)):
            result = relevancy_graph.invoke(state)
        assert result["relevance_decision"] == "irrelevant"
        assert result.get("is_finalized") is True
        assert "[SOCIAL_PROFILE_REJECTION]" in (result.get("relevance_reason") or "")

    def test_marketplace_ends_irrelevant(self):
        """Marketplace URL → preclassify → end_irrelevant → irrelevant + MARKETPLACE_REJECTION."""
        state = _base_state(website="https://www.amazon.com/seller/xyz")
        with patch(f"{_NODES_MODULE}.preclassify_target_node", side_effect=_make_preclassify_mock(is_marketplace=True)):
            result = relevancy_graph.invoke(state)
        assert result["relevance_decision"] == "irrelevant"
        # Confirm the mock-driven path produces the marketplace reason code,
        # not the social-profile code that used to fire when amazon.com was
        # (incorrectly) listed in SOCIAL_DOMAINS.
        assert "[MARKETPLACE_REJECTION]" in (result.get("relevance_reason") or ""), (
            f"Expected MARKETPLACE_REJECTION in reason, got: {result.get('relevance_reason')!r}"
        )

    def test_blocked_site_ends_manual_review(self):
        """Blocked collection → finalize_manual_review → unknown + manual_review."""
        state = _base_state(website="https://blocked-site.example.com")
        with (
            patch(f"{_NODES_MODULE}.preclassify_target_node", side_effect=_make_preclassify_mock()),
            patch(f"{_NODES_MODULE}.collect_page_sources_node", side_effect=_make_collect_mock(blocked=True, website_exists=False, status_code=403)),
        ):
            result = relevancy_graph.invoke(state)
        assert result["relevance_decision"] == "unknown"
        assert result.get("manual_review") is True
        assert result.get("is_finalized") is True

    def test_404_site_ends_irrelevant(self):
        """404 response → end_irrelevant → irrelevant decision."""
        state = _base_state(website="https://gone.example.com")
        with (
            patch(f"{_NODES_MODULE}.preclassify_target_node", side_effect=_make_preclassify_mock()),
            patch(f"{_NODES_MODULE}.collect_page_sources_node", side_effect=_make_collect_mock(blocked=False, website_exists=False, status_code=404)),
        ):
            result = relevancy_graph.invoke(state)
        assert result["relevance_decision"] in ("irrelevant", "unknown")
        assert result.get("is_finalized") is True

    def test_503_site_ends_manual_review(self):
        """503 response → finalize_manual_review → unknown + manual_review."""
        state = _base_state(website="https://down.example.com")
        with (
            patch(f"{_NODES_MODULE}.preclassify_target_node", side_effect=_make_preclassify_mock()),
            patch(f"{_NODES_MODULE}.collect_page_sources_node", side_effect=_make_collect_mock(blocked=False, website_exists=False, status_code=503)),
        ):
            result = relevancy_graph.invoke(state)
        assert result["relevance_decision"] == "unknown"
        assert result.get("manual_review") is True

    def test_healthy_site_reaches_judge(self):
        """Healthy site → full pipeline → reaches llm_relevance_judge."""
        state = _base_state(website="https://normal-retailer.example.com")
        with (
            patch(f"{_NODES_MODULE}.preclassify_target_node", side_effect=_make_preclassify_mock()),
            patch(f"{_NODES_MODULE}.collect_page_sources_node", side_effect=_make_collect_mock(website_exists=True)),
            patch(f"{_NODES_MODULE}.extract_structured_signals_node", side_effect=_noop_node),
            patch(f"{_NODES_MODULE}.extract_clean_text_and_sections_node", side_effect=_noop_node),
            patch(f"{_NODES_MODULE}.detect_platform_node", side_effect=_noop_node),
            patch(f"{_NODES_MODULE}.catalog_intelligence_node", side_effect=_noop_node),
            patch(f"{_NODES_MODULE}.business_model_intelligence_node", side_effect=_noop_node),
            patch(f"{_NODES_MODULE}.llm_relevance_judge_node", side_effect=_judge_node),
        ):
            result = relevancy_graph.invoke(state)
        assert result["relevance_decision"] == "irrelevant"
        assert result.get("is_finalized") is True


# ---------------------------------------------------------------------------
# Schema contract
# ---------------------------------------------------------------------------

def test_llm_relevance_decision_accepts_low_confidence():
    """Judge outputs low_confidence; schema must accept it without crashing."""
    from app.agents.relevancy.schemas import LLMRelevanceDecision

    decision = LLMRelevanceDecision.model_validate(
        {
            "relevance_decision": "low_confidence",
            "manual_review": True,
            "confidence": 0.25,
            "match_reasons": [],
            "mismatch_reasons": ["Insufficient evidence to classify."],
            "signals_used": ["collect_status"],
            "relevance_score": 0,
            "relevance_reason": "Insufficient evidence to classify.",
            "business_type": "Unknown",
            "primary_niche": "Unknown",
        }
    )
    assert decision.relevance_decision == "low_confidence"
    assert decision.manual_review is True
