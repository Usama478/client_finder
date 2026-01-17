from langgraph.graph import StateGraph, END
from app.agents.verification.state import VerificationAgentState
from app.agents.verification.llm_router import llm_router
from app.agents.verification.tools import early_checks, deep_checks, contact_checks

# --- Node Wrappers ---
def early_check_node(state: VerificationAgentState):
    u1 = early_checks.fetch_website_status(state)
    u2 = early_checks.domain_age_check(state)
    return {**u1, **u2}

def deep_check_node(state: VerificationAgentState):
    u1 = deep_checks.scrape_full_website(state)
    u2 = deep_checks.address_validation(state)
    u3 = deep_checks.traffic_check(state)
    u4 = deep_checks.business_legitimacy_check(state)
    return {**u1, **u2, **u3, **u4}

def contact_check_node(state: VerificationAgentState):
    u1 = contact_checks.email_extraction(state)
    u2 = contact_checks.email_validation(state)
    u3 = contact_checks.social_link_verification(state)
    return {**u1, **u2, **u3}

def finalize_node(state: VerificationAgentState):
    print("🏁 FINALIZE: Calculating Risk Score...")
    
    risk_flags = []
    
    # Logic: Detect Risks
    if state.get("domain_age_years", 0) < 2:
        risk_flags.append("New domain (< 2 years)")
    if not state.get("email_valid", True):
        risk_flags.append("Invalid email server")
    if not state.get("website_alive"):
        risk_flags.append("Website Offline")

    # Scoring Logic
    score = 85
    if risk_flags:
        score = 55
        
    verification_result = "verified" if score > 70 else "risky"
    if not state.get("website_alive"):
        verification_result = "rejected"

    return {
        "verification_score": score,
        "risk_flags": risk_flags,
        "verification_reason": f"Verification complete. Found {len(risk_flags)} risks.",
        "manual_review": len(risk_flags) > 0,
        "verification_result": verification_result
    }

# --- Graph Setup ---
workflow = StateGraph(VerificationAgentState)

workflow.add_node("llm", llm_router)
workflow.add_node("early_checks", early_check_node)
workflow.add_node("deep_verification", deep_check_node)
workflow.add_node("contact_verification", contact_check_node)
workflow.add_node("finalize", finalize_node)

workflow.set_entry_point("llm")

workflow.add_conditional_edges(
    "llm",
    lambda s: s["next_action"],
    {
        "run_early_checks": "early_checks",
        "run_deep_verification": "deep_verification",
        "run_contact_verification": "contact_verification",
        "finalize_verification": "finalize",
    }
)

workflow.add_edge("early_checks", "llm")
workflow.add_edge("deep_verification", "llm")
workflow.add_edge("contact_verification", "llm")
workflow.add_edge("finalize", END)

verification_graph = workflow.compile()