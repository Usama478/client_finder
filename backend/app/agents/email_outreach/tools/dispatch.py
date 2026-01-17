from app.agents.email_outreach.state import EmailOutreachState

def generate_draft(state: EmailOutreachState) -> dict:
    print("   ✍️ DRAFTING: Writing customized email...")
    
    # MOCK LLM GENERATION
    subject = "Partnership Opportunity: Premium Manufacturing for " + state["business_profile"].get("name", "Your Brand")
    body = "Hi team, I saw your recent collection and loved the quality..."
    
    return {
        "email_subject": subject,
        "email_body": body,
        "outreach_status": "drafted"
    }

def send_email(state: EmailOutreachState) -> dict:
    print(f"   🚀 DISPATCH: Sending email to {state['contact_email']}...")
    # MOCK SENDING
    return {"outreach_status": "sent"}