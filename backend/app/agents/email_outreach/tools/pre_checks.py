from app.agents.email_outreach.state import EmailOutreachState

def check_outreach_history(state: EmailOutreachState) -> dict:
    print("   📧 CHECK: Have we contacted them before?")
    # MOCK: No previous contact
    return {}

def verify_email_presence(state: EmailOutreachState) -> dict:
    print("   📧 CHECK: Is the email address valid?")
    if not state.get("contact_email"):
        print("   ❌ No email found. Skipping.")
        return {"outreach_status": "skipped"}
    return {}