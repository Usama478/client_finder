from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class VerificationFinalContract(BaseModel):
    """
    Strict output contract for the Verification Agent.

    The runner must validate the final state against this model before writing
    to the database.  If validation fails the runner must write
    verification_result="failed" and raise — it must never persist unvalidated
    partial data.

    Design rules:
    - All list fields default to [] so downstream agents never see None lists.
    - All optional scalars default to None.
    - verification_result is a closed enum — no free-text values allowed.
    - verification_score is clamped to [0, 100] by the validator in the runner.
    - verification_confidence is clamped to [0.0, 1.0] by the validator.
    """

    # ------------------------------------------------------------------ #
    # Decision — the four values the UI and outreach logic branch on      #
    # ------------------------------------------------------------------ #
    verification_result: Literal["verified", "unverified", "risky", "failed", "unknown"]
    verification_score: int = Field(default=0, ge=0, le=100)
    verification_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    verification_manual_review: bool = False

    # ------------------------------------------------------------------ #
    # Identity                                                            #
    # ------------------------------------------------------------------ #
    company_name_verified: Optional[str] = None
    domain_canonical: Optional[str] = None
    domain_matches_listing: Optional[bool] = None
    country_detected: Optional[str] = None
    is_real_company: Optional[bool] = None
    company_type_verified: Optional[str] = None   # "manufacturer"|"wholesaler"|"retailer"|etc.
    wholesale_available: Optional[bool] = None

    # ------------------------------------------------------------------ #
    # Contactability                                                      #
    # ------------------------------------------------------------------ #
    primary_email: Optional[str] = None
    emails_found: List[str] = Field(default_factory=list)
    phone_numbers: List[str] = Field(default_factory=list)
    contact_page_url: Optional[str] = None
    contact_form_present: Optional[bool] = None
    linkedin_company_url: Optional[str] = None
    social_links: List[str] = Field(default_factory=list)

    # ------------------------------------------------------------------ #
    # Commercial signals                                                  #
    # ------------------------------------------------------------------ #
    employee_range: Optional[str] = None          # e.g. "10-50"
    revenue_estimate_band: Optional[str] = None   # e.g. "$1M-$10M"
    legitimacy_score: Optional[int] = None        # 0-100 deterministic sub-score

    # ------------------------------------------------------------------ #
    # Audit trail                                                         #
    # ------------------------------------------------------------------ #
    risk_flags: List[str] = Field(default_factory=list)
    evidence_summary: Optional[str] = None
