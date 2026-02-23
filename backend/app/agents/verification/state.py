from typing import TypedDict, Optional, List, Dict, Any

class VerificationAgentState(TypedDict):
    """
    Central state object for Agent 2 (Verification Agent).
    Serves as an Audit Trail for the deterministic pipeline.
    """
    # --- Identity ---
    business_id: int          
    search_id: int            

    # --- Context (From Agent 1) ---
    business_name: str
    website: Optional[str]
    address: Optional[str] # Input address from DB
    scraped_text_content: Optional[str]

    # --- Gatekeeper Output ---
    website_alive: Optional[bool]
    domain_age_years: Optional[float]

    # --- Trust Scanner Output ---
    full_site_text: Optional[str]
    
    # Custom AI Context
    custom_prompt: Optional[str]

    # Email & Contact Info
    social_links: Optional[List[str]]
    legitimacy_signals: Optional[Dict[str, Any]]
    
    # --- Contact Hunter Output ---
    emails_found: Optional[List[str]]
    email_valid: Optional[bool]
    
    # --- Analyst Output ---
    verification_score: Optional[int]
    risk_flags: Optional[List[str]]
    evidence_summary: Optional[str]
    manual_review: Optional[bool]
    is_finalized: bool
