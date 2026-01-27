from typing import Dict, Any, Literal, Optional
from pydantic import BaseModel, Field
from app.agents.relevancy.state import RelevancyAgentState

# --- Pydantic Schema for Internal Validation ---
class LLMRouterOutput(BaseModel):
    """
    Strict schema enforced on Router output.
    Ensures the graph never receives an invalid 'next_action'.
    """
    next_action: Literal[
        "run_gatekeeper_checks",
        "run_data_collection",
        "finalize_relevance",
    ] = Field(..., description="Next action for the LangGraph router")

    reasoning_trace: Optional[str] = Field(
        default=None,
        description="Short explanation for why this action was chosen",
    )

# --- The Brain (Deterministic Router) ---
def llm_router(state: RelevancyAgentState) -> Dict[str, Any]:
    """
    Central decision-maker. 
    Uses Rule-Based Logic to route traffic efficiently.
    """

    # 1. Gatekeeper Phase
    if state.get("website_exists") is None:
        return LLMRouterOutput(
            next_action="run_gatekeeper_checks",
            reasoning_trace="Initial state. Need to check if website exists."
        ).dict()

    # 2. Early Rejection (Fail Fast)
    if state.get("website_exists") is False:
        return LLMRouterOutput(
            next_action="finalize_relevance",
            reasoning_trace="Rejected: No active website detected."
        ).dict()

    if state.get("is_marketplace") is True:
        return LLMRouterOutput(
            next_action="finalize_relevance",
            reasoning_trace="Rejected: Domain is a marketplace (Amazon/Yelp)."
        ).dict()

    # 3. Data Collection Phase
    if state.get("homepage_text") is None:
        return LLMRouterOutput(
            next_action="run_data_collection",
            reasoning_trace="Gatekeepers passed. Need to scrape data for analysis."
        ).dict()

    # 4. Finalize (We have everything)
    return LLMRouterOutput(
        next_action="finalize_relevance",
        reasoning_trace="All data collected. Ready for semantic analysis."
    ).dict()