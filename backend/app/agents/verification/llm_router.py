from app.agents.verification.state import VerificationAgentState

def llm_router(state: VerificationAgentState) -> dict:
    print("🧠 ROUTER: Analyzing Verification Progress...")

    # 1. Start with Early Checks
    if state.get("website_alive") is None:
        print("   👉 Direction: Early Checks")
        return {"next_action": "run_early_checks"}

    # 2. Gatekeeper: If website is dead or too new, Stop.
    if state["website_alive"] is False or state.get("domain_age_years", 0) < 1:
        print("   👉 Direction: Finalize (Reject)")
        return {"next_action": "finalize_verification"}

    # 3. Move to Deep Verification
    if state.get("address_type") is None:
        print("   👉 Direction: Deep Verification")
        return {"next_action": "run_deep_verification"}

    # 4. Move to Contact Verification (Only if Deep checks passed)
    if state.get("emails_found") is None:
        print("   👉 Direction: Contact Verification")
        return {"next_action": "run_contact_verification"}

    # 5. Done
    print("   👉 Direction: Finalize (Complete)")
    return {"next_action": "finalize_verification"}