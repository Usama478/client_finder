from typing import TypedDict, List, Optional, Dict, Any

class RelevancyAgentState(TypedDict):
    # Identity
    result_id: int
    user_id: int

    # Business input
    business_data: Dict[str, Any]
    user_context: Dict[str, Any]

    # Observations (Memory from Tools)
    website_exists: Optional[bool]
    is_marketplace: Optional[bool]
    
    homepage_text: Optional[str]
    business_model: Optional[str]
    product_keywords: Optional[List[str]]
    business_niche: Optional[str]

    # Control (The Router's Instruction)
    next_action: Optional[str]

    # Final output
    relevance_score: Optional[int]
    relevance_reason: Optional[str]
    relevance_status: str # 'pending', 'relevant', 'irrelevant'