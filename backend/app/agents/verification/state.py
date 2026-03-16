from __future__ import annotations

from typing import Any, Dict, List, Optional, TypedDict


class VerificationAgentState(TypedDict):
    """
    Central state object for the Verification Agent (Agent 2).

    Sections:
      Input        — read from DB at startup; never written by nodes
      Collection   — written by gatekeeper / collector nodes
      Identity     — written by trust scanner / LLM analyst
      Contact      — written by contact hunter
      Legitimacy   — written by metric analyst + LLM
      BI           — written by LLM analyst (business intelligence)
      Size         — written by LLM analyst
      Decision     — written by metric analyst + LLM analyst
      Email ctx    — compiled at finalisation for Email Agent consumption
      Internal     — pipeline bookkeeping flags
    """

    # ------------------------------------------------------------------ #
    # Input Fields (hydrated from DB; never overwritten by nodes)         #
    # ------------------------------------------------------------------ #
    business_id: int          # search_results.result_id
    search_id: int            # FK → search_sessions.search_id
    business_name: str
    website: str
    address: Optional[str]
    scraped_text_content: Optional[str]   # reused from Relevancy Agent; avoids re-scrape
    relevancy_artifacts: Optional[Dict[str, Any]]  # full artifact blob from Relevancy Agent
    custom_prompt: Optional[str]          # exporter-specific prompt from SearchSession context

    # ------------------------------------------------------------------ #
    # Collection Fields (written by gatekeeper / collector nodes)         #
    # ------------------------------------------------------------------ #
    website_alive: Optional[bool]
    collection_blocked: Optional[bool]    # True if Cloudflare / bot-wall intercepted
    status_code: Optional[int]
    final_url: Optional[str]             # resolved URL after redirects
    full_site_text: Optional[str]        # cleaned, combined homepage + sub-page text
    contact_page_url: Optional[str]      # /contact URL actually crawled
    wholesale_page_found: Optional[bool]
    wholesale_page_url: Optional[str]

    # ------------------------------------------------------------------ #
    # Identity Fields (written by trust scanner / LLM analyst)            #
    # ------------------------------------------------------------------ #
    company_name_confirmed: Optional[str]     # name as it appears on the website
    domain_matches_business: Optional[bool]   # website content matches listed business
    domain_match_confidence: Optional[float]  # 0.0–1.0
    country_confirmed: Optional[str]          # ISO-3166-1 alpha-2 (e.g. "DE", "US")

    # ------------------------------------------------------------------ #
    # Contact Fields (written by contact hunter)                          #
    # ------------------------------------------------------------------ #
    all_emails: List[str]
    primary_email: Optional[str]
    email_type: Optional[str]           # "buying"|"sales"|"info"|"generic"|"form_only"
    email_confidence: Optional[int]     # 0–100
    all_phones: List[str]
    whatsapp_number: Optional[str]
    linkedin_company_url: Optional[str] # must be /company/ path, not personal profile
    social_links: Dict[str, str]        # platform → URL
    contact_form_present: Optional[bool]

    # ------------------------------------------------------------------ #
    # Legitimacy Fields (written by metric analyst + LLM)                 #
    # ------------------------------------------------------------------ #
    legitimacy_score: Optional[int]     # 0–100 deterministic sub-score
    has_about_page: Optional[bool]
    has_contact_page: Optional[bool]
    has_policy_pages: Optional[bool]
    has_physical_address: Optional[bool]
    domain_age_years: Optional[int]
    ssl_valid: Optional[bool]
    risk_flags: List[str]

    # ------------------------------------------------------------------ #
    # Business Intelligence Fields (LLM output)                           #
    # ------------------------------------------------------------------ #
    product_categories: List[str]
    product_keywords: List[str]
    price_positioning: Optional[str]
    target_customer: Optional[str]
    buys_externally: Optional[bool]
    b2b_language_detected: Optional[bool]
    company_description: Optional[str]
    brand_tone: Optional[str]
    markets_served: List[str]
    ecommerce_enabled: Optional[bool]

    # ------------------------------------------------------------------ #
    # Size Fields (written by LLM analyst)                                #
    # ------------------------------------------------------------------ #
    employee_range: Optional[str]   # e.g. "10-50", "50-200"
    revenue_band: Optional[str]     # e.g. "$1M-$10M"

    # ------------------------------------------------------------------ #
    # Decision Fields (written by metric analyst + LLM analyst)           #
    # ------------------------------------------------------------------ #
    verification_status: Optional[str]
    verification_result: Optional[str]      # "verified"|"partial"|"failed"|"manual_review"
    verification_score: Optional[int]       # 0–100 composite
    verification_confidence: Optional[float]  # 0.0–1.0
    verification_reason: Optional[str]
    manual_review: bool
    contactability_score: Optional[int]     # 0–100

    # ------------------------------------------------------------------ #
    # Email Context Fields (compiled for Email Agent consumption)          #
    # ------------------------------------------------------------------ #
    email_context: Optional[Dict[str, Any]]

    # ------------------------------------------------------------------ #
    # Internal                                                             #
    # ------------------------------------------------------------------ #
    is_finalized: bool
