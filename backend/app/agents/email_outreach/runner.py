from sqlalchemy.orm import Session
from app.models.search_result import SearchResult
from app.agents.email_outreach.graph import outreach_graph
from app.agents.email_outreach.tools import pre_checks


_BLOCKED_STATUS_CODES = {401, 403, 405, 429, 503}


def _derive_verification_safety_flags(lead: SearchResult) -> dict:
    artifacts = lead.verification_artifacts or {}
    if not isinstance(artifacts, dict):
        artifacts = {}
    accessibility = artifacts.get("accessibility") or {}
    contact = artifacts.get("contact") or {}
    if not isinstance(contact, dict):
        contact = {}
    email_safety = contact.get("email_safety") or {}
    if not isinstance(email_safety, dict):
        email_safety = {}
    system_info = artifacts.get("system") or {}
    risk_flags = set(lead.risk_flags or [])

    system_failure = bool(system_info.get("failure")) or any(
        str(flag).startswith("system_failure") for flag in risk_flags
    )
    system_risk = bool(system_info.get("system_risk")) or bool(system_info.get("system_error"))
    system_error = bool(system_info.get("system_error"))
    accessibility_status = str(accessibility.get("accessibility_status") or "").lower() or None
    collection_blocked = bool(accessibility.get("collection_blocked"))

    blocked_or_ambiguous = bool(
        (accessibility_status in {"blocked", "ambiguous"})
        or collection_blocked
        or system_error
        or system_risk
        or system_failure
        or accessibility.get("status_code") in _BLOCKED_STATUS_CODES
    )
    email_on_domain_raw = email_safety.get("email_on_domain")
    free_provider_email_raw = email_safety.get("free_provider_email")
    email_on_domain = email_on_domain_raw if isinstance(email_on_domain_raw, bool) else None
    free_provider_email = (
        free_provider_email_raw
        if isinstance(free_provider_email_raw, bool)
        else None
    )
    outreach_safe_email = bool(email_safety.get("outreach_safe_email") is True)
    return {
        "system_failure": system_failure,
        "system_error": system_error,
        "system_risk": system_risk,
        "accessibility_status": accessibility_status,
        "collection_blocked": collection_blocked,
        "blocked_or_ambiguous": blocked_or_ambiguous,
        "email_on_domain": email_on_domain,
        "free_provider_email": free_provider_email,
        "outreach_safe_email": outreach_safe_email,
    }


def _persist_gate_skip(lead: SearchResult, block_code: str, block_reason: str) -> None:
    lead.outreach_status = "skipped"
    lead.email_status = "skipped"
    lead.email_subject = None
    lead.email_body = None

    context = lead.email_context if isinstance(lead.email_context, dict) else {}
    context["outreach_gate"] = {
        "eligible": False,
        "decision": "skipped",
        "reason_code": block_code,
        "reason": block_reason,
    }
    lead.email_context = context

def run_outreach_agent(db: Session, business_id: int, min_verification_score: int = None):
    print(f"\n📧 STARTING OUTREACH for Business ID {business_id}...")

    # 1. Fetch Lead (verification must have finished successfully)
    lead = db.query(SearchResult).filter(SearchResult.result_id == business_id).first()
    
    if not lead:
        print("❌ Error: Lead not found.")
        return

    if min_verification_score is not None and (lead.verification_score or 0) < min_verification_score:
        _persist_gate_skip(
            lead=lead,
            block_code="below_min_verification_score",
            block_reason=(
                f"verification_score={(lead.verification_score or 0)} "
                f"is below threshold {min_verification_score}"
            ),
        )
        db.commit()
        print(
            f"❌ Error: Verification score {(lead.verification_score or 0)} "
            f"is below threshold {min_verification_score}."
        )
        return

    safety = _derive_verification_safety_flags(lead)

    # 2. Build State
    initial_state = {
        "result_id": lead.result_id,
        "user_id": lead.user_id,
        "business_profile": lead.raw_data or {"name": lead.business_name},
        "contact_email": lead.email_found, # From Agent 2
        "verification_score": lead.verification_score,
        "verification_status": lead.verification_status,
        "verification_result": lead.verification_result,
        "verification_reason": lead.verification_reason,
        "manual_review": bool(lead.manual_review),
        "accessibility_status": safety["accessibility_status"],
        "collection_blocked": safety["collection_blocked"],
        "system_error": safety["system_error"],
        "system_risk": safety["system_risk"],
        "email_confidence": lead.email_score,
        "email_type": lead.email_type,
        "email_on_domain": safety["email_on_domain"],
        "free_provider_email": safety["free_provider_email"],
        "outreach_safe_email": safety["outreach_safe_email"],
        "domain_match_confidence": lead.domain_match_confidence,
        "risk_flags": list(lead.risk_flags or []),
        "system_failure": safety["system_failure"],
        "blocked_or_ambiguous": safety["blocked_or_ambiguous"],
        "eligibility_block_code": None,
        "eligibility_block_reason": None,
        
        "email_subject": None,
        "email_body": None,
        "approved": False,
        "outreach_status": lead.outreach_status or "pending",
        "next_action": None
    }

    gate = pre_checks.verify_verification_eligibility(initial_state)
    if gate.get("outreach_status") == "skipped":
        _persist_gate_skip(
            lead=lead,
            block_code=gate.get("eligibility_block_code") or "eligibility_denied",
            block_reason=gate.get("eligibility_block_reason") or "eligibility gate denied outreach",
        )
        db.commit()
        print(f"❌ Error: {gate.get('eligibility_block_reason')}")
        return

    # 3. Run Graph
    final_state = outreach_graph.invoke(initial_state)

    print(f"💾 SAVING: {final_state['outreach_status'].upper()}")
    
    # 4. Save
    lead.outreach_status = final_state["outreach_status"]
    lead.email_subject = final_state["email_subject"]
    lead.email_body = final_state["email_body"]
    
    db.commit()
    print("✅ OUTREACH CYCLE COMPLETE.")
