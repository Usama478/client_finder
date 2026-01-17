from app.agents.email_outreach.state import EmailOutreachState

def llm_router(state: EmailOutreachState) -> dict:
    print("🧠 ROUTER: Deciding Outreach Step...")

    # 1. If status is skipped, stop.
    if state.get("outreach_status") == "skipped":
        return {"next_action": "finalize"}

    # 2. If no draft yet, go to Drafting
    if state.get("email_body") is None:
        return {"next_action": "generate_draft"}

    # 3. If drafted but not approved...
    # FOR NOW: Auto-approve to show the cycle
    # LATER: Return "wait_for_human"
    if not state.get("approved"):
        print("   👤 HUMAN: Auto-Approving Draft (Mock)...")
        return {"next_action": "auto_approve"}

    # 4. If approved, Send it
    if state.get("approved") and state.get("outreach_status") != "sent":
        return {"next_action": "send_email"}

    return {"next_action": "finalize"}