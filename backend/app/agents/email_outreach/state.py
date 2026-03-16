from typing import TypedDict, Optional, Dict, Any, List

class EmailOutreachState(TypedDict):
    # Identity
    result_id: int
    user_id: int

    # Inputs
    business_profile: Dict[str, Any]
    contact_email: Optional[str]
    verification_score: Optional[int]
    verification_status: Optional[str]
    verification_result: Optional[str]
    verification_reason: Optional[str]
    manual_review: bool
    accessibility_status: Optional[str]
    collection_blocked: bool
    system_error: bool
    system_risk: bool
    email_confidence: Optional[int]
    email_type: Optional[str]
    domain_match_confidence: Optional[float]
    risk_flags: List[str]
    system_failure: bool
    blocked_or_ambiguous: bool
    eligibility_block_code: Optional[str]
    eligibility_block_reason: Optional[str]

    # Drafting
    email_subject: Optional[str]
    email_body: Optional[str]

    # Human Loop (Simulated for now)
    approved: bool

    # Control
    next_action: Optional[str]

    # Final Output
    outreach_status: str # drafted, sent, skipped
