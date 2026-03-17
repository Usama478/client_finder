from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class VerificationFinalContract(BaseModel):
    """
    Strict output contract for the Verification Agent.

    Validated against the full final_state in _persist_verification_to_db before
    any DB write occurs.  If validation fails the persister marks the row
    verification_result="failed" and raises — it never persists unvalidated data.

    Design rules:
    - All list fields default to [] so downstream agents never see None lists.
    - All dict fields default to {} so downstream agents never see None dicts.
    - All optional scalars default to None.
    - verification_result is a closed enum — no free-text values allowed.
    - verification_score is clamped to [0, 100] by Field constraints.
    - verification_confidence is clamped to [0.0, 1.0] by Field constraints.
    - social_links is Dict[str, str] (platform → URL), not a list.
    """

    # ------------------------------------------------------------------ #
    # Decision — the four values the UI and outreach logic branch on      #
    # ------------------------------------------------------------------ #
    verification_result: Literal["verified", "partial", "manual_review", "failed"]
    verification_score: int = Field(default=0, ge=0, le=100)
    verification_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    verification_reason: Optional[str] = None
    manual_review: bool = False
    contactability_score: int = Field(default=0, ge=0, le=100)

    # ------------------------------------------------------------------ #
    # Identity                                                            #
    # ------------------------------------------------------------------ #
    company_name_confirmed: Optional[str] = None
    domain_matches_business: Optional[bool] = None
    domain_match_confidence: Optional[float] = None
    country_confirmed: Optional[str] = None
    address_verified: Optional[bool] = None

    # ------------------------------------------------------------------ #
    # Contactability                                                      #
    # ------------------------------------------------------------------ #
    primary_email: Optional[str] = None
    all_emails: List[str] = Field(default_factory=list)
    email_type: Optional[str] = None
    email_confidence: Optional[int] = None
    email_on_domain: Optional[bool] = None
    free_provider_email: Optional[bool] = None
    outreach_safe_email: bool = False
    all_phones: List[str] = Field(default_factory=list)
    whatsapp_number: Optional[str] = None
    linkedin_company_url: Optional[str] = None
    social_links: Dict[str, str] = Field(default_factory=dict)
    contact_form_present: Optional[bool] = None
    contact_page_url: Optional[str] = None

    # ------------------------------------------------------------------ #
    # Commercial signals                                                  #
    # ------------------------------------------------------------------ #
    wholesale_page_found: Optional[bool] = None
    wholesale_page_url: Optional[str] = None
    employee_range: Optional[str] = None
    revenue_band: Optional[str] = None
    legitimacy_score: Optional[int] = None

    # ------------------------------------------------------------------ #
    # Legitimacy / site signals                                           #
    # ------------------------------------------------------------------ #
    has_about_page: Optional[bool] = None
    has_contact_page: Optional[bool] = None
    has_policy_pages: Optional[bool] = None
    domain_age_years: Optional[int] = None
    ssl_valid: Optional[bool] = None
    website_alive: Optional[bool] = None
    accessibility_status: Optional[str] = None
    collection_blocked: Optional[bool] = None

    # ------------------------------------------------------------------ #
    # Risk and system                                                     #
    # ------------------------------------------------------------------ #
    risk_flags: List[str] = Field(default_factory=list)
    system_failure: bool = False
    system_failure_stage: Optional[str] = None
    system_failure_reason: Optional[str] = None

    # ------------------------------------------------------------------ #
    # Email context (passed to Email Agent)                               #
    # ------------------------------------------------------------------ #
    email_context: Optional[Dict[str, Any]] = None
