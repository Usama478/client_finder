from typing import TypedDict, Optional, List, Dict, Any

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

    # --- Tool Observations (New Architecture) ---
    # Phase 1: Gatekeepers
    website_exists: Optional[bool]
    is_marketplace: Optional[bool]
    # Detailed check results from investigate tool 
    # (replaces old flat text fields)
    evidence: Optional[Dict[str, Any]] 
    
    # --- Final Output (Analyst Decisions) ---
    relevance_decision: Optional[str] # 'relevant' | 'irrelevant'
    relevance_score: Optional[int]    # 0-100
    relevance_reason: Optional[str]   # Human-readable explanation
    business_type: Optional[str]      # e.g., 'Retailer', 'Wholesaler'
    primary_niche: Optional[str]      # e.g., 'Leather', 'Tech'
    
    # --- Flags ---
    is_finalized: bool