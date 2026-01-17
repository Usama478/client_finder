from typing import TypedDict, Optional, List, Dict, Any

class VerificationAgentState(TypedDict):
    # Identity
    result_id: int
    user_id: int

    # Context (Input)
    business_profile: Dict[str, Any]
    relevance_reason: str

    # Phase 1: Early Checks
    website_alive: Optional[bool]
    domain_age_years: Optional[int]

    # Phase 2: Deep Verification
    address_type: Optional[str]
    traffic_level: Optional[str]
    about_page_exists: Optional[bool]
    legitimacy_flags: Optional[List[str]]

    # Phase 3: Contact Verification
    emails_found: Optional[List[str]]
    email_valid: Optional[bool]
    social_verified: Optional[bool]

    # Control
    next_action: Optional[str]

    # Final Output
    verification_score: Optional[int]
    risk_flags: Optional[List[str]]
    verification_reason: Optional[str]
    manual_review: Optional[bool]
    verification_result: Optional[str] # verified, rejected, risky