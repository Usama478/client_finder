import json
from app.db.session import SessionLocal
from app.models.search_result import SearchResult
from app.models.search_session import SearchSession
from app.agents.relevancy.tools import gather_website_evidence, analyze_relevance_with_llm

db = SessionLocal()

# Grab the first 5 leads
leads = db.query(SearchResult).filter(SearchResult.result_id.in_([1, 2, 3, 4, 5])).all()

print("🚀 STARTING BATCH TEST (IDs 1 to 5)...\n")

for lead in leads:
    print(f"{'='*50}")
    print(f"🔍 EVALUATING LEAD {lead.result_id}: {lead.business_name} ({lead.website})")
    print(f"{'='*50}")
    
    # 1. Get Criteria
    session = db.query(SearchSession).filter(SearchSession.search_id == lead.search_id).first()
    criteria = session.search_query if session else "General Business"
    
    # 2. Setup State
    state = {
        "website": lead.website,
        "business_name": lead.business_name,
        "exporter_profile": criteria
    }
    
    # 3. Gather Evidence (The Eyes)
    evidence_data = gather_website_evidence(state)
    state.update(evidence_data)
    
    # ---> THIS IS WHAT YOU WANTED: PRINTING THE RAW EVIDENCE <---
    print("\n📦 EVIDENCE EXTRACTED:")
    print(json.dumps(state["evidence"], indent=2))
    
    # 4. Analyze (The Brain)
    analysis = analyze_relevance_with_llm(state)
    
    # 5. Save to DB
    lead.relevance_status = "completed"
    lead.relevance_decision = analysis.get("relevance_decision")
    lead.relevance_score = analysis.get("relevance_score")
    lead.relevance_reason = analysis.get("relevance_reason")
    lead.business_type = analysis.get("business_type")
    lead.primary_niche = analysis.get("primary_niche")
    db.commit()
    
    print(f"\n💾 SAVED: {str(lead.relevance_decision).upper()} | Score: {lead.relevance_score}")
    print(f"Reason: {lead.relevance_reason}\n")

db.close()
print("✅ BATCH TEST COMPLETE.")
