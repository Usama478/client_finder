from unittest.mock import MagicMock, patch
import pytest

from app.agents.email_outreach.pre_checks import check_lead_is_emailable


def _make_lead(**kwargs):
    """Return a MagicMock lead with safe defaults for all fields used by the gate."""
    lead = MagicMock()
    lead.result_id = 1
    lead.verification_result = "verified"
    lead.email_found = "contact@example.com"
    lead.email_type = None
    lead.email_status = "active"
    lead.verification_score = 60
    lead.risk_flags = []
    lead.email_context = {
        "company_name": "Test Brand",
        "product_categories": ["Denim"],
    }
    lead.email_score = 80
    for k, v in kwargs.items():
        setattr(lead, k, v)
    return lead


def _make_db(first_return=None):
    """Return a mock db session whose .query().filter().first() chain returns `first_return`."""
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = first_return
    return db


# ---------------------------------------------------------------------------
# Check 1 — verification_failed
# ---------------------------------------------------------------------------

def test_1_verification_failed():
    lead = _make_lead(verification_result="failed")
    result = check_lead_is_emailable(lead, sequence_position=1, exporter_profile_id=10, db=_make_db())
    assert result["skip_code"] == "verification_failed"
    assert result["ok"] is False


# ---------------------------------------------------------------------------
# Check 2 — no_email_no_form
# ---------------------------------------------------------------------------

def test_2_no_email_no_form():
    lead = _make_lead(email_found=None, email_type=None)
    result = check_lead_is_emailable(lead, sequence_position=1, exporter_profile_id=10, db=_make_db())
    assert result["skip_code"] == "no_email_no_form"
    assert result["ok"] is False


# ---------------------------------------------------------------------------
# Check 3 — form_only bypasses no_email_no_form and passes the full gate
# ---------------------------------------------------------------------------

def test_3_form_only_passes_gate():
    lead = _make_lead(
        email_found=None,
        email_type="form_only",
        verification_result="verified",
        email_status="active",
        verification_score=60,
        risk_flags=[],
        email_context={"company_name": "Test Brand", "product_categories": ["Denim"]},
        email_score=80,
    )
    result = check_lead_is_emailable(lead, sequence_position=1, exporter_profile_id=10, db=_make_db(first_return=None))
    assert result["ok"] is True


# ---------------------------------------------------------------------------
# Check 4 — bounced_email
# ---------------------------------------------------------------------------

def test_4_bounced_email():
    lead = _make_lead(email_status="bounced")
    result = check_lead_is_emailable(lead, sequence_position=1, exporter_profile_id=10, db=_make_db())
    assert result["skip_code"] == "bounced_email"
    assert result["ok"] is False


# ---------------------------------------------------------------------------
# Check 5 — replied_already
# ---------------------------------------------------------------------------

def test_5_replied_already():
    replied_draft = MagicMock()
    replied_draft.status = "replied"

    db = MagicMock()
    # First .query().filter().first() call returns the replied draft (check 4).
    db.query.return_value.filter.return_value.first.return_value = replied_draft

    lead = _make_lead()
    result = check_lead_is_emailable(lead, sequence_position=1, exporter_profile_id=10, db=db)
    assert result["skip_code"] == "replied_already"
    assert result["ok"] is False


# ---------------------------------------------------------------------------
# Check 6 — low_score
# ---------------------------------------------------------------------------

def test_6_low_score():
    lead = _make_lead(verification_score=20)
    result = check_lead_is_emailable(lead, sequence_position=1, exporter_profile_id=10, db=_make_db(first_return=None))
    assert result["skip_code"] == "low_score"
    assert result["ok"] is False


# ---------------------------------------------------------------------------
# Check 7 — too_many_risk_flags
# ---------------------------------------------------------------------------

def test_7_too_many_risk_flags():
    lead = _make_lead(risk_flags=["flag1", "flag2", "flag3"])
    result = check_lead_is_emailable(lead, sequence_position=1, exporter_profile_id=10, db=_make_db(first_return=None))
    assert result["skip_code"] == "too_many_risk_flags"
    assert result["ok"] is False


# ---------------------------------------------------------------------------
# Check 8 — missing_buyer_context
# ---------------------------------------------------------------------------

def test_8_missing_buyer_context():
    lead = _make_lead(email_context={})
    result = check_lead_is_emailable(lead, sequence_position=1, exporter_profile_id=10, db=_make_db(first_return=None))
    assert result["skip_code"] == "missing_buyer_context"
    assert result["ok"] is False


# ---------------------------------------------------------------------------
# Check 9 — low_confidence_for_followup
# ---------------------------------------------------------------------------

def test_9_low_confidence_followup():
    lead = _make_lead(email_score=30)
    result = check_lead_is_emailable(lead, sequence_position=2, exporter_profile_id=10, db=_make_db(first_return=None))
    assert result["skip_code"] == "low_confidence_for_followup"
    assert result["ok"] is False


# ---------------------------------------------------------------------------
# Check 10 — draft_already_sent
# ---------------------------------------------------------------------------

def test_10_draft_already_sent():
    sent_draft = MagicMock()
    sent_draft.status = "sent"

    db = MagicMock()
    # Check 4 (replied) returns None; checks 9–10 return the sent draft.
    # We use side_effect to control the sequence of .first() calls.
    db.query.return_value.filter.return_value.first.side_effect = [
        None,       # check 4: replied_already → no match
        sent_draft, # check 9: draft_already_sent → match
    ]

    lead = _make_lead()
    result = check_lead_is_emailable(lead, sequence_position=1, exporter_profile_id=10, db=db)
    assert result["skip_code"] == "draft_already_sent"
    assert result["ok"] is False


# ---------------------------------------------------------------------------
# Check 11 — draft_already_pending
# ---------------------------------------------------------------------------

def test_11_draft_already_pending():
    pending_draft = MagicMock()
    pending_draft.status = "pending_review"

    db = MagicMock()
    db.query.return_value.filter.return_value.first.side_effect = [
        None,          # check 4: replied_already → no match
        None,          # check 9: draft_already_sent → no match
        pending_draft, # check 10: draft_already_pending → match
    ]

    lead = _make_lead()
    result = check_lead_is_emailable(lead, sequence_position=1, exporter_profile_id=10, db=db)
    assert result["skip_code"] == "draft_already_pending"
    assert result["ok"] is False


# ---------------------------------------------------------------------------
# Check 12 — all good → ok
# ---------------------------------------------------------------------------

def test_12_all_good_returns_ok():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.side_effect = [
        None,  # check 4: replied_already → no match
        None,  # check 9: draft_already_sent → no match
        None,  # check 10: draft_already_pending → no match
    ]

    lead = _make_lead()
    result = check_lead_is_emailable(lead, sequence_position=1, exporter_profile_id=10, db=db)
    assert result["ok"] is True
    assert result["skip_code"] is None
    assert result["reason"] == "lead is emailable"
