from app.models.email_draft import EmailDraft


def check_lead_is_emailable(
    lead,
    sequence_position: int,
    exporter_profile_id: int,
    db,
) -> dict:
    """
    Deterministic gate. Returns:
    {"ok": bool, "reason": str, "skip_code": str | None}
    Never raises under any circumstance.
    """

    def _skip(code: str, reason: str) -> dict:
        return {"ok": False, "reason": reason, "skip_code": code}

    # 1. verification_failed
    if lead.verification_result == "failed":
        return _skip("verification_failed", "verification_result is 'failed'")

    # 2. no_email_no_form
    if lead.email_found is None and (lead.email_type or "") != "form_only":
        return _skip("no_email_no_form", "no email found and email_type is not form_only")

    # 3. bounced_email
    if (lead.email_status or "") == "bounced":
        return _skip("bounced_email", "email_status is 'bounced'")

    # 4. replied_already
    try:
        replied = (
            db.query(EmailDraft)
            .filter(
                EmailDraft.business_id == lead.result_id,
                EmailDraft.status == "replied",
            )
            .first()
        )
        if replied is not None:
            return _skip("replied_already", "a replied draft already exists for this lead")
    except Exception:
        pass

    # 5. low_score
    if (lead.verification_score or 0) < 30:
        return _skip("low_score", "verification_score is below 30")

    # 6. too_many_risk_flags
    if len(lead.risk_flags or []) >= 4:
        return _skip("too_many_risk_flags", "4 or more risk flags present")

    # 7. missing_buyer_context
    ctx = lead.email_context or {}
    if not ctx.get("company_name") and not ctx.get("product_categories"):
        return _skip("missing_buyer_context", "email_context missing company_name and product_categories")

    # 8. low_confidence_for_followup
    if sequence_position > 1 and (lead.email_score or 0) < 50:
        return _skip("low_confidence_for_followup", "email_score below 50 for follow-up sequence")

    # 9. draft_already_sent
    try:
        sent = (
            db.query(EmailDraft)
            .filter(
                EmailDraft.business_id == lead.result_id,
                EmailDraft.sequence_position == sequence_position,
                EmailDraft.exporter_profile_id == exporter_profile_id,
                EmailDraft.status == "sent",
            )
            .first()
        )
        if sent is not None:
            return _skip("draft_already_sent", "a sent draft already exists for this position")
    except Exception:
        pass

    # 10. draft_already_pending
    try:
        pending = (
            db.query(EmailDraft)
            .filter(
                EmailDraft.business_id == lead.result_id,
                EmailDraft.sequence_position == sequence_position,
                EmailDraft.exporter_profile_id == exporter_profile_id,
                EmailDraft.status.in_(["pending_review", "approved"]),
            )
            .first()
        )
        if pending is not None:
            return _skip("draft_already_pending", "a pending or approved draft already exists for this position")
    except Exception:
        pass

    return {"ok": True, "reason": "lead is emailable", "skip_code": None}
