from langgraph.graph import StateGraph, END
from app.agents.relevancy.state import RelevancyAgentState
from app.agents.relevancy import tools 

# --- Node Wrappers ---

def check_status_node(state: RelevancyAgentState):
    """
    Phase 1: Basic Health Check.
    """
    print("   🏥 NODE: Checking Website Status...")
    return tools.fetch_website_status(state)

def marketplace_node(state: RelevancyAgentState):
    """
    Phase 2: Marketplace Filter.
    """
    print("   🛒 NODE: Checking Marketplace Status...")
    return tools.detect_marketplace(state)

def investigate_node(state: RelevancyAgentState):
    """
    Phase 3: The Investigator (Gather Hard Evidence).
    Only runs if website exists and is not a generic marketplace.
    """
    # Fail-safe: If site dead or junk, skip investigation to save time
    if state.get("website_exists") is False or state.get("is_marketplace") is True:
        print("   ⏭️ Skipping Investigation (Site dead or Marketplace).")
        return {"evidence": {"error": "Skipped because site is dead or marketplace"}}

    print("   🕵️ NODE: Running Investigator...")
    return tools.gather_website_evidence(state)

def analyze_node(state: RelevancyAgentState):
    """
    Phase 4: The Analyst (LLM Decision).
    """
    # Fail-safe: If no evidence or skipped
    evidence = state.get("evidence", {})
    if not evidence or "error" in evidence:
        print("   ⏭️ Skipping Analysis (No evidence).")
        return {
            "relevance_decision": "irrelevant",
            "relevance_score": 0,
            "relevance_reason": "Website unreachable or identified as generic marketplace.",
            "business_type": "Unknown",
            "primary_niche": "Unknown",
            "is_finalized": True
        }

    print("   📊 NODE: Running Analyst...")
    return tools.analyze_relevance_with_llm(state)

# --- Graph Definition ---

workflow = StateGraph(RelevancyAgentState)

# 1. Add Nodes
workflow.add_node("check_status", check_status_node)
workflow.add_node("detect_marketplace", marketplace_node)
workflow.add_node("investigate", investigate_node)
workflow.add_node("analyze", analyze_node)

# 2. Set Entry Point
workflow.set_entry_point("check_status")

# 3. Add Edges (Linear Flow)
workflow.add_edge("check_status", "detect_marketplace")
workflow.add_edge("detect_marketplace", "investigate")
workflow.add_edge("investigate", "analyze")
workflow.add_edge("analyze", END)

# 4. Compile
relevancy_graph = workflow.compile()