"""
Test suite for email_outreach agent components.

Tests strategy normalization, email generation, draft creation, and
follow-up scheduling using mocked LLM calls and DB operations.

No real DB, no real LLM calls, no HTTP calls.
"""

import json
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest

from app.agents.email_outreach.draft_generator import (
    _normalize_strategy,
    build_email_strategy,
    generate_email_draft,
)
from app.agents.email_outreach.email_draft_service import generate_draft_for_lead
from app.agents.email_outreach.followup_scheduler import run_followup_check


# ---------------------------------------------------------------------------
# Test 1: Strategy normalization enforces exactly 3 capability highlights
# ---------------------------------------------------------------------------

def test_1_strategy_has_exactly_3_capability_highlights():
    """
    Mock LLM to return strategy with 2 items in capability_highlights.
    Assert after normalization it has 3.
    """
    mock_profile = MagicMock()
    mock_profile.specializations = ["organic cotton", "GOTS certified"]
    mock_profile.company_name = "Test Co"
    
    raw_strategy = {
        "capability_highlights": ["fast turnaround", "low MOQ"],
        "tone": "casual_professional",
        "angle": "sportswear",
        "personalization_hook": "your recent collections",
        "hook_source": "llm",
        "recipient_title": "Buying Team",
        "cta_type": "soft_offer",
        "pitch_angle_reason": "test",
    }
    
    result = _normalize_strategy(raw_strategy, sequence_position=1, profile=mock_profile)
    
    assert len(result["capability_highlights"]) == 3
    assert result["capability_highlights"][0] == "fast turnaround"
    assert result["capability_highlights"][1] == "low MOQ"
    assert result["capability_highlights"][2] == "organic cotton"


# ---------------------------------------------------------------------------
# Test 2: Strategy CTA type enforced by position
# ---------------------------------------------------------------------------

def test_2_strategy_cta_type_enforced_by_position():
    """
    Call _normalize_strategy with cta_type="wrong" and sequence_position=2.
    Assert result["cta_type"] == "sample_offer".
    """
    mock_profile = MagicMock()
    mock_profile.specializations = []
    mock_profile.company_name = "Test Co"
    
    raw_strategy = {
        "capability_highlights": ["a", "b", "c"],
        "tone": "casual_professional",
        "angle": "sportswear",
        "personalization_hook": "test hook",
        "hook_source": "llm",
        "recipient_title": "Buying Team",
        "cta_type": "wrong",
        "pitch_angle_reason": "test",
    }
    
    result = _normalize_strategy(raw_strategy, sequence_position=2, profile=mock_profile)
    
    assert result["cta_type"] == "sample_offer"


# ---------------------------------------------------------------------------
# Test 3: Strategy uses fallback for empty hook
# ---------------------------------------------------------------------------

def test_3_strategy_uses_fallback_for_empty_hook():
    """
    Call _normalize_strategy with personalization_hook="".
    Assert result["personalization_hook"] is not empty string.
    """
    mock_profile = MagicMock()
    mock_profile.specializations = []
    mock_profile.company_name = "Test Co"
    
    raw_strategy = {
        "capability_highlights": ["a", "b", "c"],
        "tone": "casual_professional",
        "angle": "sportswear",
        "personalization_hook": "",
        "hook_source": "",
        "recipient_title": "Buying Team",
        "cta_type": "soft_offer",
        "pitch_angle_reason": "test",
    }
    
    result = _normalize_strategy(raw_strategy, sequence_position=1, profile=mock_profile)
    
    assert result["personalization_hook"] != ""
    assert result["personalization_hook"] == "your recent collections"
    assert result["hook_source"] == "fallback"


# ---------------------------------------------------------------------------
# Test 4: Email body not empty on valid input
# ---------------------------------------------------------------------------

def test_4_email_body_not_empty_on_valid_input():
    """
    Mock LLM to return valid JSON with subject and body.
    Call generate_email_draft with mocked llm.
    Assert draft["subject"] is not None.
    Assert draft["body"] is not None.
    Assert draft["error"] is None.
    """
    mock_profile = MagicMock()
    mock_profile.contact_person_name = "John Doe"
    mock_profile.company_name = "Test Textiles"
    mock_profile.certifications = ["GOTS", "OEKO-TEX"]
    
    strategy = {
        "angle": "activewear",
        "personalization_hook": "your recent sustainability focus",
        "tone": "casual_professional",
        "capability_highlights": ["low MOQ", "fast sampling", "certified production"],
        "recipient_title": "Buying Team",
        "cta_type": "soft_offer",
    }
    
    email_context = {
        "company_name": "Brand X",
        "country": "USA",
    }
    
    llm_response = {
        "subject": "Activewear manufacturing partnership",
        "body": "Dear Buying Team,\n\nI noticed your recent sustainability focus...\n\nBest regards,\nJohn Doe\nTest Textiles",
    }
    
    with patch("app.agents.email_outreach.draft_generator._llm_call") as mock_llm:
        mock_llm.return_value = json.dumps(llm_response)
        
        result = generate_email_draft(strategy, email_context, mock_profile, sequence_position=1)
    
    assert result["subject"] is not None
    assert result["body"] is not None
    assert result["error"] is None
    assert result["subject"] == "Activewear manufacturing partnership"


# ---------------------------------------------------------------------------
# Test 5: Email generation retries on parse failure
# ---------------------------------------------------------------------------

def test_5_email_generation_retries_on_parse_failure():
    """
    Mock LLM to raise Exception on first call, return valid JSON on second call.
    Assert generate_email_draft returns valid draft (not error).
    """
    mock_profile = MagicMock()
    mock_profile.contact_person_name = "John Doe"
    mock_profile.company_name = "Test Textiles"
    mock_profile.certifications = ["GOTS"]
    
    strategy = {
        "angle": "activewear",
        "personalization_hook": "test",
        "tone": "casual_professional",
        "capability_highlights": ["a", "b", "c"],
        "recipient_title": "Buying Team",
        "cta_type": "soft_offer",
    }
    
    email_context = {
        "company_name": "Brand X",
        "country": "USA",
    }
    
    llm_response = {
        "subject": "Partnership opportunity",
        "body": "Test email body",
    }
    
    with patch("app.agents.email_outreach.draft_generator._llm_call") as mock_llm:
        mock_llm.side_effect = [
            Exception("First call fails"),
            json.dumps(llm_response),
        ]
        
        with patch("app.agents.email_outreach.draft_generator._time.sleep"):
            result = generate_email_draft(strategy, email_context, mock_profile, sequence_position=1)
    
    assert result["error"] is None
    assert result["subject"] == "Partnership opportunity"
    assert result["body"] == "Test email body"


# ---------------------------------------------------------------------------
# Test 6: Both retries fail returns error
# ---------------------------------------------------------------------------

def test_6_both_retries_fail_returns_error():
    """
    Mock LLM to raise Exception on both calls.
    Assert result["error"] == "generation_failed"
    Assert result["subject"] is None
    """
    mock_profile = MagicMock()
    mock_profile.contact_person_name = "John Doe"
    mock_profile.company_name = "Test Textiles"
    mock_profile.certifications = ["GOTS"]
    
    strategy = {
        "angle": "activewear",
        "personalization_hook": "test",
        "tone": "casual_professional",
        "capability_highlights": ["a", "b", "c"],
        "recipient_title": "Buying Team",
        "cta_type": "soft_offer",
    }
    
    email_context = {
        "company_name": "Brand X",
        "country": "USA",
    }
    
    with patch("app.agents.email_outreach.draft_generator._llm_call") as mock_llm:
        mock_llm.side_effect = [
            Exception("First call fails"),
            Exception("Second call fails"),
        ]
        
        with patch("app.agents.email_outreach.draft_generator._time.sleep"):
            result = generate_email_draft(strategy, email_context, mock_profile, sequence_position=1)
    
    assert result["error"] == "generation_failed"
    assert result["subject"] is None
    assert result["body"] is None


# ---------------------------------------------------------------------------
# Test 7: Generate draft skips verification_failed lead
# ---------------------------------------------------------------------------

def test_7_generate_draft_skips_verification_failed_lead():
    """
    Mock SearchResult with verification_result="failed".
    Mock DB. Call generate_draft_for_lead.
    Assert result["status"] == "skipped"
    Assert result["skip_code"] == "verification_failed"
    """
    mock_db = MagicMock()
    mock_lead = MagicMock()
    mock_lead.result_id = 123
    mock_lead.verification_result = "failed"
    mock_lead.search_id = 1
    
    mock_profile = MagicMock()
    mock_profile.id = 1
    mock_profile.company_name = "Test Co"
    
    mock_db.query.return_value.filter.return_value.first.return_value = mock_lead
    
    with patch("app.agents.email_outreach.email_draft_service.SessionLocal") as mock_session:
        mock_session.return_value = mock_db
        
        with patch("app.agents.email_outreach.email_draft_service._get_exporter_profile") as mock_get_profile:
            mock_get_profile.return_value = mock_profile
            
            result = generate_draft_for_lead(business_id=123, user_id=1, sequence_position=1)
    
    assert result["status"] == "skipped"
    assert result["skip_code"] == "verification_failed"


# ---------------------------------------------------------------------------
# Test 8: Generate draft creates DB row on failure
# ---------------------------------------------------------------------------

def test_8_generate_draft_creates_db_row_on_failure():
    """
    Mock LLM generation to fail (return error dict).
    Mock DB session with add/commit tracking.
    Call generate_draft_for_lead.
    Assert db.add was called (DB row was created).
    Assert the row has status="failed".
    """
    mock_db = MagicMock()
    mock_lead = MagicMock()
    mock_lead.result_id = 123
    mock_lead.verification_result = "verified"
    mock_lead.search_id = 1
    mock_lead.email_context = {"company_name": "Test Buyer"}
    mock_lead.email_found = "test@example.com"
    mock_lead.email_status = None
    mock_lead.verification_score = 80
    mock_lead.risk_flags = []
    mock_lead.email_score = 75
    
    mock_profile = MagicMock()
    mock_profile.id = 1
    mock_profile.company_name = "Test Exporter"
    
    # Mock DB queries
    mock_db.query.return_value.filter.return_value.first.return_value = None
    
    # Set up lead query to return mock_lead
    def query_side_effect(model):
        mock_query = MagicMock()
        if model.__name__ == "SearchResult":
            mock_query.filter.return_value.first.return_value = mock_lead
        else:
            mock_query.filter.return_value.first.return_value = None
        return mock_query
    
    mock_db.query.side_effect = query_side_effect
    
    with patch("app.agents.email_outreach.email_draft_service.SessionLocal") as mock_session:
        mock_session.return_value = mock_db
        
        with patch("app.agents.email_outreach.email_draft_service._get_exporter_profile") as mock_get_profile:
            mock_get_profile.return_value = mock_profile
            
            with patch("app.agents.email_outreach.email_draft_service.build_email_strategy") as mock_strategy:
                mock_strategy.return_value = {"angle": "test"}
                
                with patch("app.agents.email_outreach.email_draft_service.generate_email_draft") as mock_generate:
                    mock_generate.return_value = {
                        "subject": None,
                        "body": None,
                        "error": "generation_failed",
                    }
                    
                    result = generate_draft_for_lead(business_id=123, user_id=1, sequence_position=1)
    
    assert mock_db.add.called
    added_draft = mock_db.add.call_args[0][0]
    assert added_draft.status == "failed"
    assert result["status"] == "failed"


# ---------------------------------------------------------------------------
# Test 9: Followup skips bounced leads
# ---------------------------------------------------------------------------

def test_9_followup_skips_bounced_leads():
    """
    Mock one draft with status="sent", sequence_position=1, sent_at=7 days ago.
    Mock lead with email_status="bounced".
    Call run_followup_check.
    Assert result["skipped"] == 1
    Assert result["generated"] == 0
    """
    mock_db = MagicMock()
    
    mock_draft = MagicMock()
    mock_draft.id = 1
    mock_draft.business_id = 123
    mock_draft.exporter_profile_id = 1
    mock_draft.status = "sent"
    mock_draft.sequence_position = 1
    mock_draft.sent_at = datetime.now(timezone.utc) - timedelta(days=7)
    
    mock_lead = MagicMock()
    mock_lead.result_id = 123
    mock_lead.email_status = "bounced"
    
    def query_side_effect(model):
        mock_query = MagicMock()
        if model.__name__ == "EmailDraft":
            mock_query.filter.return_value.all.return_value = [mock_draft]
            mock_query.filter.return_value.first.return_value = None
        elif model.__name__ == "SearchResult":
            mock_query.filter.return_value.first.return_value = mock_lead
        return mock_query
    
    mock_db.query.side_effect = query_side_effect
    
    with patch("app.agents.email_outreach.followup_scheduler.SessionLocal") as mock_session:
        mock_session.return_value = mock_db
        
        result = run_followup_check()
    
    assert result["skipped"] == 1
    assert result["generated"] == 0


# ---------------------------------------------------------------------------
# Test 10: Followup skips if next draft exists
# ---------------------------------------------------------------------------

def test_10_followup_skips_if_next_draft_exists():
    """
    Mock draft with status="sent", sequence_position=1.
    Mock DB to return existing draft for sequence_position=2.
    Call run_followup_check.
    Assert no new draft was generated.
    """
    mock_db = MagicMock()
    
    mock_draft = MagicMock()
    mock_draft.id = 1
    mock_draft.business_id = 123
    mock_draft.exporter_profile_id = 1
    mock_draft.status = "sent"
    mock_draft.sequence_position = 1
    mock_draft.sent_at = datetime.now(timezone.utc) - timedelta(days=7)
    
    mock_lead = MagicMock()
    mock_lead.result_id = 123
    mock_lead.email_status = None
    
    mock_existing_followup = MagicMock()
    mock_existing_followup.id = 2
    mock_existing_followup.sequence_position = 2
    
    call_count = {"filter_count": 0}
    
    def query_side_effect(model):
        mock_query = MagicMock()
        if model.__name__ == "EmailDraft":
            mock_query.filter.return_value.all.return_value = [mock_draft]
            
            def first_side_effect():
                call_count["filter_count"] += 1
                if call_count["filter_count"] == 1:
                    return mock_existing_followup
                return None
            
            mock_query.filter.return_value.first.side_effect = first_side_effect
        elif model.__name__ == "SearchResult":
            mock_query.filter.return_value.first.return_value = mock_lead
        return mock_query
    
    mock_db.query.side_effect = query_side_effect
    
    with patch("app.agents.email_outreach.followup_scheduler.SessionLocal") as mock_session:
        mock_session.return_value = mock_db
        
        result = run_followup_check()
    
    assert result["skipped"] == 1
    assert result["generated"] == 0
