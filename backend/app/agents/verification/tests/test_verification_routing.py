"""
Verification Agent routing and scoring tests.

Tests 1-2 run the compiled graph with mocked nodes (no real HTTP/LLM/DB).
Tests 3-5 call final_contract_builder directly.
Test 6  mocks the DB session to verify stale-field wipe in Task 1.

Run with: pytest backend/app/agents/verification/tests/ -v
"""

from __future__ import annotations

import sys
import os
from contextlib import ExitStack
from typing import Any, Dict
from unittest.mock import MagicMock, patch

sys.path.insert(
    0,
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "..")),
)

import pytest

from app.agents.verification.nodes import final_contract_builder
from app.agents.verification.graph import verification_graph
from app.agents.verification.service import run_verification_for_business


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _base_state(**overrides: Any) -> Dict[str, Any]:
    """Return a fully-populated minimal initial state suitable for graph invocation."""
    state: Dict[str, Any] = {
        # Input
        "business_id": 999,
        "search_id": 1,
        "business_name": "Test Brand",
        "website": "https://testbrand.com",
        "address": None,
        "scraped_text_content": "Scraped content from relevancy agent homepage.",
        "relevancy_artifacts": None,
        "custom_prompt": None,
        "business_type": None,
        "primary_niche": None,
        # Collection
        "website_alive": None,
        "collection_blocked": None,
        "status_code": None,
        "final_url": None,
        "full_site_text": None,
        "contact_page_url": None,
        "wholesale_page_found": None,
        "wholesale_page_url": None,
        # Identity
        "company_name_confirmed": None,
        "domain_matches_business": None,
        "domain_match_confidence": None,
        "country_confirmed": None,
        # Contact
        "all_emails": [],
        "primary_email": None,
        "email_type": None,
        "email_confidence": None,
        "all_phones": [],
        "whatsapp_number": None,
        "linkedin_company_url": None,
        "social_links": {},
        "contact_form_present": None,
        # Legitimacy
        "legitimacy_score": None,
        "has_about_page": None,
        "has_contact_page": None,
        "has_policy_pages": None,
        "has_physical_address": None,
        "domain_age_years": None,
        "ssl_valid": None,
        "risk_flags": [],
        # Business intelligence
        "product_categories": [],
        "product_keywords": [],
        "price_positioning": None,
        "target_customer": None,
        "buys_externally": None,
        "b2b_language_detected": None,
        "company_description": None,
        "brand_tone": None,
        "markets_served": [],
        "ecommerce_enabled": None,
        # Size
        "employee_range": None,
        "revenue_band": None,
        # Decision
        "verification_status": None,
        "verification_result": None,
        "verification_score": None,
        "verification_confidence": None,
        "verification_reason": None,
        "manual_review": False,
        "contactability_score": None,
        # Email context
        "email_context": None,
        # Internal
        "is_finalized": False,
    }
    state.update(overrides)
    return state


# Node-level mock return values used by routing tests
_ACCESSIBILITY_DEAD = {"website_alive": False, "ssl_valid": False, "final_url": "https://testbrand.com", "status_code": None, "domain_age_years": None}
_ACCESSIBILITY_LIVE = {"website_alive": True,  "ssl_valid": True,  "final_url": "https://testbrand.com", "status_code": 200, "domain_age_years": 3}
_COLLECTOR_RETURN   = {"full_site_text": "Contact us at info@testbrand.com. About us page.", "contact_page_url": "https://testbrand.com/contact", "wholesale_page_found": False, "wholesale_page_url": None, "collection_blocked": False}
_IDENTITY_RETURN    = {"company_name_confirmed": "Test Brand", "domain_matches_business": True, "domain_match_confidence": 0.9, "country_confirmed": None}
_CONTACT_RETURN     = {"all_emails": [], "primary_email": None, "email_type": None, "email_confidence": None, "all_phones": [], "whatsapp_number": None, "linkedin_company_url": None, "social_links": {}, "contact_form_present": False}
_LEGITIMACY_RETURN  = {"legitimacy_score": 50, "has_about_page": True, "has_contact_page": False, "has_policy_pages": False, "has_physical_address": False, "risk_flags": []}
_SIZE_RETURN        = {"employee_range": "1-50", "revenue_band": "small"}
_BI_RETURN          = {"product_categories": ["clothing"], "product_keywords": ["t-shirt"], "price_positioning": "budget", "target_customer": "B2C", "buys_externally": None, "b2b_language_detected": False, "company_description": "A test brand.", "brand_tone": "casual", "markets_served": [], "ecommerce_enabled": True}
_EMAIL_CTX_RETURN   = {"email_context": {"company_name": "Test Brand", "risk_flags": []}}
_CONTRACT_RETURN    = {"verification_result": "partial", "verification_score": 30, "verification_confidence": 0.3, "verification_reason": "Partial: legitimacy 50/100", "manual_review": False, "contactability_score": 0, "is_finalized": True}


# ---------------------------------------------------------------------------
# Test 1 — Dead site routes to short path
# ---------------------------------------------------------------------------

def test_dead_site_routes_to_risk_path():
    """
    When site_accessibility_check returns website_alive=False, the graph
    branches to email_context_compiler → final_contract_builder, bypassing
    the full evidence pipeline.  targeted_page_collector and contact_extractor
    must NOT be called.  On the dead path contact_extractor's scraped_text_content
    fallback is never invoked (the node itself is skipped).
    """
    mock_collector   = MagicMock(return_value=_COLLECTOR_RETURN)
    mock_contact_ext = MagicMock(return_value=_CONTACT_RETURN)

    patches = [
        patch("app.agents.verification.nodes.input_preparation",              return_value={}),
        patch("app.agents.verification.nodes.site_accessibility_check",       return_value=_ACCESSIBILITY_DEAD),
        patch("app.agents.verification.nodes.targeted_page_collector",        mock_collector),
        patch("app.agents.verification.nodes.identity_resolver",              return_value={}),
        patch("app.agents.verification.nodes.contact_extractor",              mock_contact_ext),
        patch("app.agents.verification.nodes.legitimacy_analyzer",            return_value={}),
        patch("app.agents.verification.nodes.size_estimator",                 return_value={}),
        patch("app.agents.verification.nodes.business_intelligence_extractor",return_value={}),
        # email_context_compiler and final_contract_builder run for real
    ]

    with ExitStack() as stack:
        for p in patches:
            stack.enter_context(p)
        final_state = verification_graph.invoke(_base_state())

    # Dead-site path skips the evidence collection pipeline entirely
    assert mock_collector.call_count == 0, (
        "targeted_page_collector must not run on the dead-site path"
    )
    assert mock_contact_ext.call_count == 0, (
        "contact_extractor must not run on the dead-site path; "
        "scraped_text_content fallback is only relevant when the node executes"
    )

    # final_contract_builder ran and produced a structured result
    assert final_state.get("is_finalized") is True, "is_finalized must be True after final_contract_builder"
    assert final_state.get("verification_result") in ("failed", "partial"), (
        f"Expected 'failed' or 'partial' for a dead site, got: {final_state.get('verification_result')!r}"
    )

    # Dead site with no email and zero legitimacy → "failed"
    assert final_state.get("verification_result") == "failed", (
        "Dead site + no email + zero legitimacy should yield 'failed'"
    )


# ---------------------------------------------------------------------------
# Test 2 — Live site runs all 10 nodes in order
# ---------------------------------------------------------------------------

def test_live_site_routes_to_full_pipeline():
    """
    When site_accessibility_check returns website_alive=True, all 10 nodes
    must execute in the correct topological order.
    """
    call_order: list[str] = []

    def _tracker(name: str, return_val: dict):
        def _fn(state):
            call_order.append(name)
            return return_val
        return _fn

    node_return_map = {
        "input_preparation":               {},
        "site_accessibility_check":        _ACCESSIBILITY_LIVE,
        "targeted_page_collector":         _COLLECTOR_RETURN,
        "identity_resolver":               _IDENTITY_RETURN,
        "contact_extractor":               _CONTACT_RETURN,
        "legitimacy_analyzer":             _LEGITIMACY_RETURN,
        "size_estimator":                  _SIZE_RETURN,
        "business_intelligence_extractor": _BI_RETURN,
        "email_context_compiler":          _EMAIL_CTX_RETURN,
        "final_contract_builder":          _CONTRACT_RETURN,
    }

    patches = [
        patch(f"app.agents.verification.nodes.{fn_name}",
              side_effect=_tracker(fn_name, ret))
        for fn_name, ret in node_return_map.items()
    ]

    with ExitStack() as stack:
        for p in patches:
            stack.enter_context(p)
        final_state = verification_graph.invoke(_base_state())

    expected_order = [
        "input_preparation",
        "site_accessibility_check",
        "targeted_page_collector",
        "identity_resolver",
        "contact_extractor",
        "legitimacy_analyzer",
        "size_estimator",
        "business_intelligence_extractor",
        "final_contract_builder",
        "email_context_compiler",
    ]
    assert call_order == expected_order, (
        f"Node execution order mismatch.\n  Expected: {expected_order}\n  Got:      {call_order}"
    )
    assert final_state.get("verification_result") == "partial"
    assert final_state.get("is_finalized") is True


# ---------------------------------------------------------------------------
# Test 3 — Buying email produces verified result with high contactability
# ---------------------------------------------------------------------------

def test_buying_email_raises_contactability_score():
    """
    A buying@ email should grant the maximum email bonus (25 pts).
    With legitimacy_score=70 and domain_match_confidence=0.8 the result is 'verified'.
    """
    state = _base_state(
        primary_email="buying@brand.com",
        email_type="buying",
        legitimacy_score=70,
        domain_match_confidence=0.8,
        domain_matches_business=True,
        website_alive=True,
        ssl_valid=True,
        domain_age_years=5,
        all_phones=[],
        whatsapp_number=None,
        linkedin_company_url=None,
        has_contact_page=False,
        contact_form_present=False,
    )

    result = final_contract_builder(state)

    # contactability = 40 (base) + 25 (buying email bonus) = 65
    assert result["contactability_score"] >= 65, (
        f"Expected contactability_score >= 65, got {result['contactability_score']}"
    )
    # verified: legitimacy >= 70, email present, domain_confidence >= 0.6
    assert result["verification_result"] == "verified", (
        f"Expected 'verified', got {result['verification_result']!r}"
    )
    assert result["manual_review"] is False
    assert result["is_finalized"] is True


# ---------------------------------------------------------------------------
# Test 4 — No email pulls verification score below 50
# ---------------------------------------------------------------------------

def test_no_email_lowers_score():
    """
    Without a primary email the contactability base is 0.
    verification_score = (50 * 0.4) + (0 * 0.4) + (0.5 * 100 * 0.2) = 30.
    """
    state = _base_state(
        primary_email=None,
        email_type=None,
        legitimacy_score=50,
        domain_match_confidence=0.5,
        domain_matches_business=True,
        website_alive=True,
        all_phones=[],
        whatsapp_number=None,
        linkedin_company_url=None,
        has_contact_page=False,
        contact_form_present=False,
    )

    result = final_contract_builder(state)

    assert result["verification_score"] < 50, (
        f"Expected verification_score < 50 with no email, got {result['verification_score']}"
    )
    assert result["contactability_score"] == 0, (
        f"Expected contactability_score=0 with no email, got {result['contactability_score']}"
    )
    assert result["is_finalized"] is True


# ---------------------------------------------------------------------------
# Test 5 — Low domain match triggers manual review
# ---------------------------------------------------------------------------

def test_domain_mismatch_triggers_manual_review():
    """
    domain_matches_business=False and domain_match_confidence < 0.4 must
    route to manual_review regardless of other signals.
    """
    state = _base_state(
        domain_matches_business=False,
        domain_match_confidence=0.3,
        primary_email=None,
        email_type=None,
        legitimacy_score=60,
        website_alive=True,
        all_phones=[],
        whatsapp_number=None,
        linkedin_company_url=None,
        has_contact_page=False,
        contact_form_present=False,
    )

    result = final_contract_builder(state)

    assert result["verification_result"] == "manual_review", (
        f"Expected 'manual_review', got {result['verification_result']!r}"
    )
    assert result["manual_review"] is True, (
        "manual_review flag must be True when verification_result == 'manual_review'"
    )
    assert result["is_finalized"] is True


# ---------------------------------------------------------------------------
# Test 6 — Stale fields are wiped before graph runs (mocked DB)
# ---------------------------------------------------------------------------

def test_stale_field_wipe_in_service():
    """
    Task 1 of run_verification_for_business must wipe all stale verification
    fields on the lead row and commit BEFORE the graph is invoked.
    """
    mock_session = MagicMock()
    mock_lead    = MagicMock()

    # Seed lead with a previous run's data so the wipe is observable
    mock_lead.relevance_decision   = "relevant"
    mock_lead.verification_status  = "pending"
    mock_lead.verification_result  = "verified"   # stale value — must become None
    mock_lead.verification_score   = 95            # stale value — must become None
    mock_lead.risk_flags           = ["old flag"]  # stale list — must become []
    mock_lead.business_name        = "Test Brand"
    mock_lead.website              = "https://testbrand.com"
    mock_lead.search_id            = 1
    mock_lead.result_id            = 999

    # Wire the SQLAlchemy query chain
    (mock_session.query.return_value
        .filter.return_value
        .with_for_update.return_value
        .first.return_value) = mock_lead

    # Minimal final state the mocked graph returns
    mock_final_state = {
        "verification_result":    "partial",
        "verification_score":     30,
        "verification_confidence": 0.3,
        "verification_reason":    "Partial: mocked",
        "manual_review":          False,
        "contactability_score":   0,
        "is_finalized":           True,
        "risk_flags":             [],
        "all_emails":             [],
        "all_phones":             [],
        "social_links":           {},
        "email_context":          {"company_name": "Test Brand"},
        "primary_email":          None,
        "email_type":             None,
        "email_confidence":       None,
        "company_name_confirmed": None,
        "domain_match_confidence": None,
        "country_confirmed":      None,
        "wholesale_page_found":   None,
        "wholesale_page_url":     None,
        "legitimacy_score":       30,
        "has_about_page":         False,
        "has_contact_page":       False,
        "has_policy_pages":       False,
        "domain_age_years":       None,
        "employee_range":         "unknown",
        "revenue_band":           "unknown",
        "whatsapp_number":        None,
        "linkedin_company_url":   None,
        "contact_form_present":   None,
        "verification_artifacts": None,
        "domain_matches_business": None,
        "final_url":              None,
        "website_alive":          True,
        "status_code":            200,
        "collection_blocked":     False,
        "has_physical_address":   False,
        "ssl_valid":              True,
        "product_categories":     [],
        "product_keywords":       [],
        "price_positioning":      "unknown",
        "target_customer":        "unknown",
        "buys_externally":        None,
        "b2b_language_detected":  False,
        "company_description":    "",
        "brand_tone":             "commercial",
        "markets_served":         [],
        "ecommerce_enabled":      None,
    }

    with patch("app.agents.verification.service.SessionLocal",
               return_value=mock_session), \
         patch("app.agents.verification.service._build_initial_state",
               return_value=_base_state()), \
         patch("app.agents.verification.service.verification_graph") as mock_graph, \
         patch("app.agents.verification.service._persist_verification_to_db"):

        mock_graph.invoke.return_value = mock_final_state
        run_verification_for_business(999)

    # ---- Assert: stale decision fields wiped to None ----
    assert mock_lead.verification_result     is None, "verification_result must be wiped to None"
    assert mock_lead.verification_score      is None, "verification_score must be wiped to None"
    assert mock_lead.verification_confidence is None, "verification_confidence must be wiped to None"
    assert mock_lead.verification_reason     is None, "verification_reason must be wiped to None"

    # ---- Assert: stale list/dict fields reset ----
    assert mock_lead.risk_flags       == [], "risk_flags must be reset to []"
    assert mock_lead.all_emails_found == [], "all_emails_found must be reset to []"
    assert mock_lead.all_phones_found == [], "all_phones_found must be reset to []"
    assert mock_lead.social_links     == {}, "social_links must be reset to {}"

    # ---- Assert: nullable fields wiped to None ----
    assert mock_lead.email_found              is None
    assert mock_lead.email_score              is None
    assert mock_lead.verification_artifacts   is None
    assert mock_lead.contactability_score     is None
    assert mock_lead.company_name_confirmed   is None
    assert mock_lead.domain_match_confidence  is None
    assert mock_lead.country_confirmed        is None
    assert mock_lead.whatsapp_number          is None
    assert mock_lead.linkedin_company_url     is None
    assert mock_lead.email_context            is None

    # ---- Assert: verification_status set to "processing" before graph ran ----
    assert mock_lead.verification_status == "processing", (
        "verification_status must be 'processing' after the wipe commit"
    )

    # ---- Assert: commit was called (wipe was persisted before graph) ----
    assert mock_session.commit.called, "DB commit must be called after the stale-field wipe"

    # ---- Assert: graph was actually invoked ----
    assert mock_graph.invoke.called, "verification_graph.invoke must be called in Task 2"
