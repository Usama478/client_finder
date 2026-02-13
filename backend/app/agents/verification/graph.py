from langgraph.graph import StateGraph, END
from typing import Dict, Any

from app.agents.verification.state import VerificationAgentState
from app.agents.verification.tools import early_checks, deep_checks, contact_checks
from app.agents.verification import llm_analyst

# --- The Graph ---
def build_verification_graph():
    graph = StateGraph(VerificationAgentState)

    # 1. Add Tool Nodes
    graph.add_node("gatekeeper", early_checks.run_gatekeeper_checks)
    graph.add_node("trust_scanner", deep_checks.run_trust_scanner)
    graph.add_node("contact_hunter", contact_checks.run_contact_hunter)
    graph.add_node("llm_analyst", llm_analyst.run_llm_analyst)
    
    # 2. Set Entry
    graph.set_entry_point("gatekeeper")

    # 3. Routing Logic (Deterministic Hard Stop)
    def check_alive(state: VerificationAgentState):
        if state.get("website_alive"):
            return "trust_scanner"
        return END

    graph.add_conditional_edges(
        "gatekeeper",
        check_alive,
        {
            "trust_scanner": "trust_scanner",
            END: END
        }
    )

    # 4. Linear Flow
    graph.add_edge("trust_scanner", "contact_hunter")
    graph.add_edge("contact_hunter", "llm_analyst")
    graph.add_edge("llm_analyst", END)

    return graph.compile()
