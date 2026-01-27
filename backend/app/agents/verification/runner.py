from sqlalchemy.orm import Session
from app.models.search_result import SearchResult
from app.agents.verification.graph import build_verification_graph
from app.agents.verification.state import VerificationAgentState

def run_verification_agent(db: Session, business_id: int):
    print(f"\n🚀 VERIFICATION AGENT: Starting for Lead {business_id}...")
    
    # Fetch Lead
    lead = db.query(SearchResult).filter(SearchResult.result_id == business_id).first()
    if not lead:
        print("❌ Lead not found.")
        return

    # Initialize State
    state: VerificationAgentState = {
        "business_id": lead.result_id,
        "search_id": lead.search_id,
        "business_name": lead.business_name,
        "website": lead.website,
        "address": lead.address,
        "scraped_text_content": lead.scraped_text_content, 
        
        # Init None
        "website_alive": None,
        "domain_age_years": None,
        "full_site_text": None,
        "address_validation": None,
        "traffic_level": None,
        "legitimacy_signals": None,
        "emails_found": None,
        "email_valid": None,
        "social_links": None,
        "next_action": None,
        "verification_score": None,
        "risk_flags": None,
        "evidence_summary": None,
        "manual_review": None,
        "is_finalized": False,
    }

    # Run Graph
    graph = build_verification_graph()
    final_state = graph.invoke(state)

    # Save to DB
    print(f"💾 SAVING: Score {final_state.get('verification_score')} | Emails: {final_state.get('emails_found')}")
    
    lead.verification_score = final_state.get("verification_score")
    lead.verification_result = "verified" if (final_state.get("verification_score") or 0) > 70 else "risky"
    lead.risk_flags = final_state.get("risk_flags")
    lead.verification_reason = final_state.get("evidence_summary")
    
    # Save Emails for Agent 3
    emails = final_state.get("emails_found")
    if emails:
        lead.email_found = ",".join(emails)
        lead.email_status = "found"
    
    db.commit()
    print("✅ VERIFICATION COMPLETE.")