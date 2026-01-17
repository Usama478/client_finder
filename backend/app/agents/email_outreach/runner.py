from sqlalchemy.orm import Session
from app.models.search_result import SearchResult
from app.agents.email_outreach.graph import outreach_graph

def run_outreach_agent(db: Session, business_id: int):
    print(f"\n📧 STARTING OUTREACH for Business ID {business_id}...")

    # 1. Fetch Lead (Must be VERIFIED)
    lead = db.query(SearchResult).filter(SearchResult.result_id == business_id).first()
    
    if not lead or lead.verification_status != "verified":
        print("❌ Error: Lead not verified or not found.")
        return

    # 2. Build State
    initial_state = {
        "result_id": lead.result_id,
        "user_id": lead.user_id,
        "business_profile": lead.raw_data or {"name": lead.business_name},
        "contact_email": lead.email_found, # From Agent 2
        "verification_score": lead.verification_score,
        
        "email_subject": None,
        "email_body": None,
        "approved": False,
        "outreach_status": lead.outreach_status or "pending",
        "next_action": None
    }

    # 3. Run Graph
    final_state = outreach_graph.invoke(initial_state)

    print(f"💾 SAVING: {final_state['outreach_status'].upper()}")
    
    # 4. Save
    lead.outreach_status = final_state["outreach_status"]
    lead.email_subject = final_state["email_subject"]
    lead.email_body = final_state["email_body"]
    
    db.commit()
    print("✅ OUTREACH CYCLE COMPLETE.")