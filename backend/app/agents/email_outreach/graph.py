from langgraph.graph import StateGraph, END
from app.agents.email_outreach.state import EmailOutreachState
from app.agents.email_outreach.llm_router import llm_router
from app.agents.email_outreach.tools import pre_checks, dispatch

# --- Nodes ---
def pre_check_node(state: EmailOutreachState):
    u1 = pre_checks.check_outreach_history(state)
    u2 = pre_checks.verify_email_presence(state)
    # If verify failed, it sets status='skipped'
    return {**u1, **u2}

def draft_node(state: EmailOutreachState):
    return dispatch.generate_draft(state)

def approval_node(state: EmailOutreachState):
    # This simulates the user clicking "Approve"
    return {"approved": True}

def send_node(state: EmailOutreachState):
    return dispatch.send_email(state)

def finalize_node(state: EmailOutreachState):
    print(f"🏁 FINALIZE: Outreach Status = {state.get('outreach_status')}")
    return {}

# --- Graph ---
workflow = StateGraph(EmailOutreachState)

workflow.add_node("llm", llm_router)
workflow.add_node("pre_checks", pre_check_node)
workflow.add_node("generate_draft", draft_node)
workflow.add_node("auto_approve", approval_node)
workflow.add_node("send_email", send_node)
workflow.add_node("finalize", finalize_node)

workflow.set_entry_point("pre_checks") # Start with checks, then go to Brain

workflow.add_conditional_edges(
    "llm",
    lambda s: s["next_action"],
    {
        "generate_draft": "generate_draft",
        "auto_approve": "auto_approve",
        "send_email": "send_email",
        "finalize": "finalize",
    }
)

workflow.add_edge("pre_checks", "llm")
workflow.add_edge("generate_draft", "llm")
workflow.add_edge("auto_approve", "llm")
workflow.add_edge("send_email", "llm")
workflow.add_edge("finalize", END)

outreach_graph = workflow.compile()