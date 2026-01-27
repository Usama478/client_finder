from langgraph.graph import StateGraph, END
from app.agents.relevancy.state import RelevancyAgentState
from app.agents.relevancy.llm_router import llm_router
from app.agents.relevancy import tools 

# --- Node Wrappers ---

def gatekeepers_node(state: RelevancyAgentState):
    """
    Phase 1: Fast Checks.
    Returns partial updates to the state.
    """
    print("   🛡️ NODE: Running Gatekeepers...")
    # Pass the full state so tools can access 'business_data'
    u1 = tools.fetch_website_status(state)
    u2 = tools.detect_marketplace(state)
    return {**u1, **u2}

def data_collection_node(state: RelevancyAgentState):
    """
    Phase 2: Heavy Lifting (Scraping & Heuristics).
    """
    print("   🕷️ NODE: Running Data Collection...")
    u1 = tools.scrape_homepage_text(state)
    
    # Create a temporary state so the heuristics see the text we just scraped
    temp_state = {**state, **u1}
    
    u2 = tools.detect_business_model_heuristic(temp_state)
    u3 = tools.extract_product_keywords(temp_state)
    u4 = tools.classify_business_niche(temp_state)
    
    return {**u1, **u2, **u3, **u4}

def finalize_node(state: RelevancyAgentState):
    """
    Phase 3: The Judge.
    This uses the 'semantic_analysis' tool (LLM) to make the final decision.
    """
    print("   ⚖️ NODE: Finalizing Analysis...")
    
    # This calls the LLM to analyze the scraped text vs. the criteria
    result = tools.semantic_analysis(state)
    
    return {
        **result,
        "is_finalized": True
    }

# --- Graph Definition ---

workflow = StateGraph(RelevancyAgentState)

# 1. Add Nodes
workflow.add_node("llm_router", llm_router)
workflow.add_node("gatekeepers", gatekeepers_node)
workflow.add_node("data_collection", data_collection_node)
workflow.add_node("finalize", finalize_node)

# 2. Set Entry Point
workflow.set_entry_point("llm_router")

# 3. Add Conditional Routing (The Brain)
workflow.add_conditional_edges(
    "llm_router",
    lambda state: state["next_action"],
    {
        "run_gatekeeper_checks": "gatekeepers",
        "run_data_collection": "data_collection",
        "finalize_relevance": "finalize"
    }
)

# 4. Add Return Edges (Always loop back to Brain)
workflow.add_edge("gatekeepers", "llm_router")
workflow.add_edge("data_collection", "llm_router")
workflow.add_edge("finalize", END)

# 5. Compile
relevancy_graph = workflow.compile()