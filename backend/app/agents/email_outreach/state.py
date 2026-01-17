from typing import TypedDict, Optional, Dict, Any

class EmailOutreachState(TypedDict):
    # Identity
    result_id: int
    user_id: int

    # Inputs
    business_profile: Dict[str, Any]
    contact_email: str
    verification_score: int

    # Drafting
    email_subject: Optional[str]
    email_body: Optional[str]

    # Human Loop (Simulated for now)
    approved: bool

    # Control
    next_action: Optional[str]

    # Final Output
    outreach_status: str # drafted, sent, skipped