from typing import Any, Dict, Literal, Optional, TypedDict

class RelevancyAgentState(TypedDict):
    """
    Central state object passed through the LangGraph Relevancy Agent.
    Matches the project standard (TypedDict) for consistency.
    """

    # --- Core Identifiers (Immutable) ---
    business_id: int    # search_results.result_id
    search_id: int      # Link to the search session

    # --- Business Input Data (from Google Maps / DB) ---
    business_name: str
    category: Optional[str]
    website: Optional[str]
    address: Optional[str]
    description: Optional[str]

    # --- Exporter Context (Decision Criteria) ---
    # Derived from search_sessions.search_query
    exporter_profile: str 

    # --- Tool Observations (Gatekeepers) ---
    website_exists: Optional[bool]
    is_marketplace: Optional[bool]

    # --- v1 Compatibility ---
    evidence: Optional[Dict[str, Any]]

    # --- v2 Tool Outputs ---
    collect_sources_output: Optional[Dict[str, Any]]
    collect_blocked: Optional[bool]
    collect_block_reason: Optional[str]
    collect_needs_browser: Optional[bool]
    collect_status_code: Optional[int]
    platform_detection_output: Optional[Dict[str, Any]]
    shopify_probe_output: Optional[Dict[str, Any]]
    structured_signals_output: Optional[Dict[str, Any]]
    clean_text_output: Optional[Dict[str, Any]]
    catalog_intelligence_output: Optional[Dict[str, Any]]
    business_model_intelligence_output: Optional[Dict[str, Any]]
    llm_decision_output: Optional[Dict[str, Any]]
    structured_has_product_catalog: Optional[bool]
    structured_has_organization: Optional[bool]
    structured_signal_strength: Optional[Literal["none", "weak", "strong"]]
    structured_signals_used: Optional[list[str]]

    # --- Routing Flags ---
    should_run_shopify_probe: Optional[bool]
    
    # --- Final Output (Analyst Decisions) ---
    relevance_decision: Optional[str] # 'relevant' | 'irrelevant' | 'unknown'
    relevance_score: Optional[int]    # 0-100
    relevance_reason: Optional[str]   # Human-readable explanation
    business_type: Optional[str]      # e.g., 'Retailer', 'Wholesaler'
    primary_niche: Optional[str]      # e.g., 'Leather', 'Tech'
    manual_review: Optional[bool]
    confidence: Optional[float]       # 0-1
    match_reasons: Optional[list[str]]
    mismatch_reasons: Optional[list[str]]
    signals_used: Optional[list[str]]
    
    # --- Flags ---
    is_finalized: bool
