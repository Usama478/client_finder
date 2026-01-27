from typing import TypedDict, Optional, List, Dict, Any

class RelevancyAgentState(TypedDict):
    """
    Central state object passed through the LangGraph Relevancy Agent.
    Matches the project standard (TypedDict) for consistency with Agent 2 & 3.
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
    # Derived from search_sessions.search_query (e.g., 'Clothing Manufacturers in Germany')
    exporter_profile: str 

    # --- Tool Observations (Filled Incrementally) ---
    # Phase 1: Gatekeepers
    website_exists: Optional[bool]
    is_marketplace: Optional[bool]

    # Phase 2: Data Collection
    homepage_text: Optional[str]
    business_model: Optional[str]  # e.g. B2B, B2C, Manufacturer
    extracted_keywords: Optional[List[str]]
    classified_niche: Optional[str]

    # --- LLM Control & Reasoning ---
    # Options: 'run_gatekeeper_checks', 'run_data_collection', 'finalize_relevance'
    next_action: Optional[str]
    reasoning_trace: Optional[str] # For debugging/Viva defense

    # --- Final Output (Persisted to DB) ---
    relevance_decision: Optional[str] # 'relevant' | 'irrelevant'
    relevance_score: Optional[int]    # 0-100
    relevance_reason: Optional[str]   # Human-readable explanation
    
    # --- Flags ---
    is_finalized: bool