from app.agents.verification.state import VerificationAgentState

def llm_router(state: VerificationAgentState) -> dict:
    """
    Decides the next step in the loop based on data availability.
    """
    print("   🤔 AGENT 2 BRAIN: Deciding next step...")
    
    # 1. Check if we are done (Score exists)
    if state.get("verification_score") is not None:
         return {"next_action": "finalize_verification"}

    # 2. Logic Chain
    # Step A: If we haven't checked the website yet, do early checks.
    if state.get("website_alive") is None:
        return {"next_action": "run_early_checks"}
    
    # Step B: If website is dead, stop immediately.
    if state.get("website_alive") is False:
        return {"next_action": "finalize_verification"}

    # Step C: If website is alive but we haven't scraped deep details, do deep verification.
    if state.get("full_site_text") is None:
        return {"next_action": "run_deep_verification"}
        
    # Step D: If we have text but haven't checked contacts, do contact verification.
    if state.get("emails_found") is None:
        return {"next_action": "run_contact_verification"}
        
    # Step E: If we have everything, finalize.
    return {"next_action": "finalize_verification"}