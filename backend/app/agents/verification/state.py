from __future__ import annotations

from typing import Any, Dict, List, Optional, TypedDict


class VerificationAgentState(TypedDict):
    """
    Central state object for the Verification Agent (Agent 2).

    Every field written by the pipeline must appear here.  Tools return partial
    dicts; LangGraph merges them into this object after each node.  The state is
    the single source of truth — no tool may persist to the DB directly.
    """

    # ------------------------------------------------------------------ #
    # Input Fields (hydrated by the runner from the DB row)              #
    # ------------------------------------------------------------------ #
    business_id: int
    search_id: int
    business_name_input: str          # raw name from SearchResult — not verified
    website: str
    address_input: Optional[str]      # address from the lead record
    description_input: Optional[str]
    category_input: Optional[str]
    scraped_text_content: Optional[str]   # re-used from Relevancy Agent — avoids double scrape
    relevancy_artifacts: Dict[str, Any]   # full artifact blob from Agent 1
    custom_prompt: Optional[str]          # exporter-specific context from SearchSession

    # ------------------------------------------------------------------ #
    # Collection Fields (set by gatekeeper / trust scanner)              #
    # ------------------------------------------------------------------ #
    website_alive: Optional[bool]
    collection_blocked: Optional[bool]   # True if Cloudflare / bot-wall intercepted
    status_code: Optional[int]
    final_url: Optional[str]             # after redirects
    full_site_text: Optional[str]        # cleaned, combined homepage + sub-page text
    contact_page_url: Optional[str]      # the /contact URL actually crawled

    # ------------------------------------------------------------------ #
    # Identity Fields (set by trust scanner / LLM analyst)               #
    # ------------------------------------------------------------------ #
    company_name_verified: Optional[str]      # name as it appears on the website itself
    domain_canonical: Optional[str]           # root domain, normalised (e.g. "acme.com")
    domain_matches_listing: Optional[bool]    # does website content match the listed business?
    country_detected: Optional[str]           # ISO-3166-1 alpha-2 (e.g. "DE", "US")

    # ------------------------------------------------------------------ #
    # Contactability Fields (set by contact hunter)                      #
    # ------------------------------------------------------------------ #
    emails_found: List[str]             # all validated email addresses
    primary_email: Optional[str]        # highest-priority outreach email
    phone_numbers: List[str]            # all extracted phone numbers
    contact_form_present: Optional[bool]
    linkedin_company_url: Optional[str] # must be /company/ path, not a personal profile
    social_links: List[str]             # remaining social URLs (Facebook, Instagram, etc.)

    # ------------------------------------------------------------------ #
    # Legitimacy & Commercial Fields (set by metric analyst + LLM)       #
    # ------------------------------------------------------------------ #
    is_real_company: Optional[bool]
    legitimacy_score: Optional[int]         # 0–100 deterministic sub-score
    employee_range: Optional[str]           # e.g. "10-50", "50-200"
    revenue_estimate_band: Optional[str]    # e.g. "$1M-$10M"
    company_type_verified: Optional[str]    # e.g. "manufacturer", "wholesaler", "retailer"
    wholesale_available: Optional[bool]     # B2B / wholesale offering detected

    # ------------------------------------------------------------------ #
    # Decision Fields (set by metric analyst + LLM analyst)              #
    # ------------------------------------------------------------------ #
    verification_result: Optional[str]          # "verified"|"unverified"|"risky"|"failed"|"unknown"
    verification_score: Optional[int]           # 0–100 composite
    verification_confidence: Optional[float]    # 0.0–1.0
    verification_manual_review: bool
    risk_flags: List[str]
    evidence_summary: Optional[str]

    # ------------------------------------------------------------------ #
    # Internal                                                            #
    # ------------------------------------------------------------------ #
    is_finalized: bool
