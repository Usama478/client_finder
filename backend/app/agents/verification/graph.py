import json
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from typing import Dict, Any

from app.agents.verification.state import VerificationAgentState
from app.agents.verification.llm_router import llm_router
from app.agents.verification.tools import early_checks, deep_checks, contact_checks

# --- Finalizer Function (Inside Graph for simplicity) ---
def finalize_verification(state: VerificationAgentState) -> Dict[str, Any]:
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0, model_kwargs={"response_format": {"type": "json_object"}})
    
    prompt = f"""
    Verify this business. Return JSON.
    Context:
    - Alive: {state.get("website_alive")}
    - Address Type: {state.get("address_validation")}
    - Signals: {state.get("legitimacy_signals")}
    - Emails: {state.get("emails_found")}
    
    Output JSON keys: verification_score (0-100), risk_flags (list of strings), evidence_summary (string), manual_review (bool).
    """
    try:
        response = llm.invoke([("user", prompt)])
        data = json.loads(response.content)
        return {
            "verification_score": data.get("verification_score", 0),
            "risk_flags": data.get("risk_flags", []),
            "evidence_summary": data.get("evidence_summary", "Auto-generated"),
            "manual_review": data.get("manual_review", False),
            "is_finalized": True
        }
    except:
        return {"verification_score": 0, "is_finalized": True}

# --- The Graph ---
def build_verification_graph():
    graph = StateGraph(VerificationAgentState)

    # 1. Add Brain Node
    graph.add_node("llm", llm_router)
    
    # 2. Add Tool Nodes (Using your modular files)
    graph.add_node("early_checks", lambda s: {**early_checks.fetch_website_status(s), **early_checks.domain_age_check(s)})
    
    graph.add_node("deep_verification", lambda s: {
        **deep_checks.scrape_full_website(s), 
        **deep_checks.address_validation(s), 
        **deep_checks.traffic_check(s),
        **deep_checks.business_legitimacy_check(s)
    })
    
    graph.add_node("contact_verification", lambda s: {
        **contact_checks.email_extraction(s), 
        **contact_checks.email_validation(s), 
        **contact_checks.social_link_verification(s)
    })
    
    graph.add_node("finalize", finalize_verification)

    # 3. Set Entry
    graph.set_entry_point("llm")

    # 4. Routing Logic
    graph.add_conditional_edges(
        "llm",
        lambda s: s["next_action"],
        {
            "run_early_checks": "early_checks",
            "run_deep_verification": "deep_verification",
            "run_contact_verification": "contact_verification",
            "finalize_verification": "finalize",
        },
    )

    # 5. Loop Back to Brain
    graph.add_edge("early_checks", "llm")
    graph.add_edge("deep_verification", "llm")
    graph.add_edge("contact_verification", "llm")
    graph.add_edge("finalize", END)

    return graph.compile()