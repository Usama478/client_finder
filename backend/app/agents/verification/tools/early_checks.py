from app.agents.verification.state import VerificationAgentState

def fetch_website_status(state: VerificationAgentState) -> dict:
    print("   🛡️ EARLY: Pinging website for life signals...")
    # MOCK: Website is alive
    return {"website_alive": True}

def domain_age_check(state: VerificationAgentState) -> dict:
    print("   🛡️ EARLY: Checking WHOIS database...")
    # MOCK: Domain is 6 years old (Safe)
    return {"domain_age_years": 6}