from typing import TypedDict, Optional, List, Dict, Any

class VerificationAgentState(TypedDict):
    """
    Central state object for Agent 2 (Verification Agent).
    """
    # --- Identity ---
    business_id: int          
    search_id: int            

    # --- Context (From Agent 1) ---
    business_name: str
    website: Optional[str]
    address: Optional[str]
    scraped_text_content: Optional[str]

    # --- Early Checks ---
    website_alive: Optional[bool]
    domain_age_years: Optional[int]

    # --- Deep Verification ---
    full_site_text: Optional[str]
    address_validation: Optional[str]   # commercial/residential
    traffic_level: Optional[str]        # low/medium/high
    legitimacy_signals: Optional[Dict[str, Any]]

    # --- Contact Verification ---
    emails_found: Optional[List[str]]
    email_valid: Optional[bool]
    social_links: Optional[List[str]]

    # --- LLM Control ---
    next_action: Optional[str]
    
    # --- Final Output ---
    verification_score: Optional[int]
    risk_flags: Optional[List[str]]
    evidence_summary: Optional[str]
    manual_review: Optional[bool]
    is_finalized: bool