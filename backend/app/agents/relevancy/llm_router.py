from app.agents.relevancy.state import RelevancyAgentState

def llm_router(state: RelevancyAgentState) -> dict:
    """
    Decides the next step based on what data is missing.
    """
    print("🧠 ROUTER: Deciding next move...")

    # 1. If we haven't checked the website yet, go to Gatekeepers
    if state.get("website_exists") is None:
        print("   👉 Direction: Gatekeepers")
        return {"next_action": "run_gatekeeper_checks"}

    # 2. If website is dead or it's a marketplace, Stop immediately.
    if state["website_exists"] is False or state["is_marketplace"] is True:
        print("   👉 Direction: Finalize (Early Exit)")
        return {"next_action": "finalize_relevance"}

    # 3. If we have the website but no text data, go to Data Collection
    if state.get("homepage_text") is None:
        print("   👉 Direction: Data Collection")
        return {"next_action": "run_data_collection"}

    # 4. If we have everything, go to Finalize
    print("   👉 Direction: Finalize (Complete)")
    return {"next_action": "finalize_relevance"}