from app.agents.verification.state import VerificationAgentState

def email_extraction(state: VerificationAgentState) -> dict:
    print("   🛡️ CONTACT: Extracting emails from text...")
    return {"emails_found": ["contact@mock-business.com"]}

def email_validation(state: VerificationAgentState) -> dict:
    print("   🛡️ CONTACT: Validating SMTP server...")
    return {"email_valid": True}

def social_link_verification(state: VerificationAgentState) -> dict:
    print("   🛡️ CONTACT: Checking LinkedIn/Instagram consistency...")
    return {"social_verified": True}