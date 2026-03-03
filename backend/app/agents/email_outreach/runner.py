from sqlalchemy.orm import Session
from app.models.search_result import SearchResult
from app.agents.email_outreach.graph import outreach_graph

def run_outreach_agent(db: Session, business_id: int, min_verification_score: int = None):
    print(f"\n📧 STARTING OUTREACH for Business ID {business_id}...")

    # 1. Fetch Lead (verification must have finished successfully)
    lead = db.query(SearchResult).filter(SearchResult.result_id == business_id).first()
    
    if not lead:
        print("❌ Error: Lead not found.")
        return

    if lead.verification_status != "completed":
        print(f"❌ Error: Verification is not completed (status={lead.verification_status}).")
        return

    if min_verification_score is not None and (lead.verification_score or 0) < min_verification_score:
        print(
            f"❌ Error: Verification score {(lead.verification_score or 0)} "
            f"is below threshold {min_verification_score}."
        )
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
