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
        
        # Init None for Evidence
        "website_alive": None,
        "domain_age_years": None,
        "full_site_text": None,
        "social_links": None,
        "legitimacy_signals": None,
        "emails_found": None,
        "email_valid": None,
        
        # Init None for Output
        "verification_score": None,
        "risk_flags": None,
        "evidence_summary": None,
        "manual_review": None,
        "is_finalized": False,
    }

    # Run Graph
    graph = build_verification_graph()
    final_state = graph.invoke(state)
    # --- 🔎 DEBUG: RAW TOOL OUTPUT ---
    print("\n" + "="*50)
    print("🔎 RAW TOOL OUTPUT (STATE CHECK)")
    print("="*50)
    print(f"🌐 Alive: {final_state.get('website_alive')}")
    print(f"📅 Age (Years): {final_state.get('domain_age_years')}")
    print(f"🔗 Socials: {final_state.get('social_links')}")
    print(f"📧 Emails Validated: {final_state.get('emails_found')}")
    print(f"⚖️ Legal Signals: {final_state.get('legitimacy_signals')}")
    
    # Print the address to see if it's real or garbage
    address_val = final_state.get('address')
    print(f"📍 Extracted Address: {address_val}")
    
    # Print just the first 500 characters of the scraped text to see if it bypassed bot-protection
    scraped_text = str(final_state.get('full_site_text') or "")
    print(f"📄 Text Snippet (First 500 chars):\n{scraped_text[:500]}...")
    print("="*50 + "\n")

    # Create safe fallback if Analyst didn't run (Dead Site)
    score = final_state.get("verification_score")
    summary = final_state.get("evidence_summary")
    flags = final_state.get("risk_flags") or []

    if final_state.get("website_alive") is False:
        score = 0
        summary = "Verification Failed: Website is unreachable or dead."
        flags.append("Dead Website")

    # Save to DB
    print(f"💾 SAVING: Score {score} | Status: {'Verified' if (score or 0) > 40 else 'Risky'}")
    
    lead.verification_score = score
    # Threshold for "verified" usually > 40 or 50 in strict systems, let's say 50 based on analyst
    lead.verification_result = "verified" if (score or 0) >= 50 else "risky"
    lead.verification_status = "completed"
    lead.risk_flags = flags
    lead.verification_reason = summary
    
    # Save Emails & Socials
    emails = final_state.get("emails_found")
    if emails:
        lead.email_found = ",".join(emails)
        lead.email_status = "found"
        
    socials = final_state.get("social_links")
    if socials:
        # Assuming there's a column for social links or just logging it
        # If DB schema has social_links column:
        # lead.social_links = ",".join(socials)
        pass # Schema check needed, but keeping safe for now
        
    # Safely merge into raw_data so SQLAlchemy detects it
    current_raw_data = dict(lead.raw_data or {})
    
    if final_state.get("domain_age_years") is not None:
        current_raw_data["domain_age"] = final_state.get("domain_age_years")
        
    if final_state.get("website_alive") is not None:
        current_raw_data["website_status"] = "Alive" if final_state.get("website_alive") else "Dead"
        
    legitimacy = final_state.get("legitimacy_signals")
    if legitimacy and isinstance(legitimacy, dict):
        for k, v in legitimacy.items():
            current_raw_data[k] = v
            
    lead.raw_data = current_raw_data
    
    db.commit()
    print("✅ VERIFICATION COMPLETE.")
