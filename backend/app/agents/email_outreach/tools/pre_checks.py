from app.agents.email_outreach.state import EmailOutreachState

_MIN_EMAIL_CONFIDENCE = 50
_MIN_DOMAIN_MATCH_CONFIDENCE = 0.4


def _skip(code: str, reason: str) -> dict:
    print(f"   ❌ GATE [{code}]: {reason}. Skipping outreach.")
    return {
        "outreach_status": "skipped",
        "eligibility_block_code": code,
        "eligibility_block_reason": reason,
    }


def check_outreach_history(state: EmailOutreachState) -> dict:
    print("   📧 CHECK: Have we contacted them before?")
    # MOCK: No previous contact
    return {}


def verify_verification_eligibility(state: EmailOutreachState) -> dict:
    print("   🛡️ CHECK: Is verification output safe for outreach?")

    if state.get("verification_status") != "completed":
        return _skip(
            "verification_not_completed",
            f"verification_status={state.get('verification_status')!r} is not completed",
        )

    verification_result = (state.get("verification_result") or "").lower()
    if verification_result == "failed":
        return _skip("verification_failed", "verification_result='failed'")
    if verification_result not in {"verified", "partial"}:
        return _skip(
            "verification_not_outreach_safe",
            f"verification_result={verification_result!r} is not outreach-safe",
        )

    if bool(state.get("manual_review")):
        return _skip("manual_review_required", "manual_review=true")

    accessibility_status = (state.get("accessibility_status") or "").lower()
    if accessibility_status == "blocked":
        return _skip("accessibility_blocked", "accessibility_status='blocked'")
    if accessibility_status == "ambiguous":
        return _skip("accessibility_ambiguous", "accessibility_status='ambiguous'")
    if bool(state.get("collection_blocked")):
        return _skip("collection_blocked", "collection_blocked=true")

    if bool(state.get("system_error")):
        return _skip("system_error", "verification system_error=true")
    if bool(state.get("system_risk")):
        return _skip("system_risk", "verification system_risk=true")
    if bool(state.get("system_failure")) or bool(state.get("blocked_or_ambiguous")):
        return _skip("verification_ambiguous", "verification indicates blocked/system ambiguity")

    contact_email = (state.get("contact_email") or "").strip()
    if not contact_email:
        return _skip("no_primary_email", "no primary email available")

    if (state.get("email_type") or "").lower() == "form_only":
        return _skip("form_only_contact", "email_type=form_only is not directly emailable")

    if state.get("outreach_safe_email") is not True:
        return _skip(
            "unsafe_email_semantics",
            (
                "outreach_safe_email is not true "
                f"(email_on_domain={state.get('email_on_domain')}, "
                f"free_provider_email={state.get('free_provider_email')})"
            ),
        )

    email_conf = state.get("email_confidence")
    if email_conf is not None:
        try:
            if int(email_conf) < _MIN_EMAIL_CONFIDENCE:
                return _skip(
                    "low_email_confidence",
                    f"email_confidence={int(email_conf)} is below {_MIN_EMAIL_CONFIDENCE}"
                )
        except (TypeError, ValueError):
            return _skip("invalid_email_confidence", "email_confidence is invalid")

    dmc = state.get("domain_match_confidence")
    if dmc is not None:
        try:
            if float(dmc) < _MIN_DOMAIN_MATCH_CONFIDENCE:
                return _skip(
                    "low_domain_match_confidence",
                    f"domain_match_confidence={float(dmc):.2f} is below {_MIN_DOMAIN_MATCH_CONFIDENCE:.2f}"
                )
        except (TypeError, ValueError):
            return _skip("invalid_domain_match_confidence", "domain_match_confidence is invalid")

    return {}


def verify_email_presence(state: EmailOutreachState) -> dict:
    gate = verify_verification_eligibility(state)
    if gate.get("outreach_status") == "skipped":
        return gate

    print("   📧 CHECK: Is the email address valid?")
    if not state.get("contact_email"):
        return _skip("no_contact_email", "no contact email")
    return {}
