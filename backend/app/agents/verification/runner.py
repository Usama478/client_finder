from sqlalchemy.orm import Session
from app.models.search_result import SearchResult
from app.agents.verification.graph import verification_graph

def run_verification_agent(db: Session, business_id: int):
    print(f"\n🛡️ STARTING DEEP VERIFICATION for Business ID {business_id}...")

    # 1. Fetch Lead
    lead = db.query(SearchResult).filter(SearchResult.result_id == business_id).first()
    
    if not lead:
        print("❌ Error: Business not found.")
        return

    # 2. Build Initial State
    initial_state = {
        "result_id": lead.result_id,
        "user_id": lead.user_id,
        "business_profile": lead.raw_data or {},
        "relevance_reason": lead.relevance_reason or "",
        
        # All checks start None
        "website_alive": None,
        "domain_age_years": None,
        "address_type": None,
        "traffic_level": None,
        "emails_found": None,
        "next_action": None
    }

    # 3. Run Graph
    final_state = verification_graph.invoke(initial_state)

    print(f"💾 SAVING: {final_state['verification_result'].upper()} (Score: {final_state['verification_score']})")
    
    # 4. Save to DB
    lead.verification_status = final_state["verification_result"]
    lead.verification_score = final_state["verification_score"]
    lead.verification_reason = final_state["verification_reason"]
    lead.risk_flags = final_state["risk_flags"]      # Saves as JSON
    lead.manual_review = final_state["manual_review"] # Saves as Boolean
    
    # Save email if we found one
    if final_state.get("emails_found"):
        lead.email_found = final_state["emails_found"][0]
        lead.email_status = "found"

    db.commit()
    print("✅ DEEP VERIFICATION COMPLETE.")