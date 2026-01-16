from langgraph.graph import StateGraph, END
from app.agents.relevancy.state import RelevancyAgentState
from app.agents.relevancy.llm_router import llm_router
from app.agents.relevancy import tools

# --- NODE WRAPPERS ---
def gatekeeper_node(state: RelevancyAgentState):
    res1 = tools.fetch_website_status(state)
    res2 = tools.detect_marketplace(state)
    return {**res1, **res2}

def data_collection_node(state: RelevancyAgentState):
    res1 = tools.scrape_homepage_text(state)
    res2 = tools.detect_business_model(state)
    res3 = tools.extract_product_keywords(state)
    res4 = tools.classify_business_niche(state)
    return {**res1, **res2, **res3, **res4}

def finalize_node(state: RelevancyAgentState):
    print("🏁 FINALIZE: Calculating final score...")
    
    # MOCK SCORING LOGIC
    if state.get("is_marketplace") or not state.get("website_exists"):
        return {
            "relevance_score": 0, 
            "relevance_reason": "Invalid website or marketplace.", 
            "relevance_status": "irrelevant"
        }

    return {
        "relevance_score": 85,
        "relevance_reason": "Matches User Context (Fashion Brand looking for Manufacturer).",
        "relevance_status": "relevant"
    }

# --- BUILD THE GRAPH ---
workflow = StateGraph(RelevancyAgentState)

workflow.add_node("llm", llm_router)
workflow.add_node("gatekeepers", gatekeeper_node)
workflow.add_node("data_collection", data_collection_node)
workflow.add_node("finalize", finalize_node)

workflow.set_entry_point("llm")

workflow.add_conditional_edges(
    "llm",
    lambda state: state["next_action"],
    {
        "run_gatekeeper_checks": "gatekeepers",
        "run_data_collection": "data_collection",
        "finalize_relevance": "finalize",
    }
)

workflow.add_edge("gatekeepers", "llm")
workflow.add_edge("data_collection", "llm")
workflow.add_edge("finalize", END)

relevancy_graph = workflow.compile()