from typing import Optional
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.search_result import SearchResult
from app.models.search_session import SearchSession
from app.agents.relevancy.state import RelevancyAgentState
from app.agents.relevancy.graph import relevancy_graph 

def run_relevancy_agent(db: Session, business_id: int) -> None:
    """
    Executes the Relevancy Agent for a single business lead.
    Flow: DB → State → LangGraph → State → DB
    """
    print(f"\n🚀 RUNNER: Starting Relevancy Agent for Business ID {business_id}...")

    try:
        # 1. Fetch Lead
        lead = db.query(SearchResult).filter(SearchResult.result_id == business_id).first()
        if not lead:
            print(f"❌ Error: SearchResult {business_id} not found.")
            return

        # 2. Fetch Criteria (The Query)
        session = db.query(SearchSession).filter(SearchSession.search_id == lead.search_id).first()
        
        # FIX 1: Access the attribute on the session object
        exporter_criteria = session.search_query if session else "General Business"

        # FIX 2: Prepare raw data for safe extraction
        # We do this because 'category' and 'description' are in the JSON blob, not main columns
        raw = lead.raw_data if lead.raw_data else {}

        # 3. Initialize State (TypedDict)
        initial_state: RelevancyAgentState = {
            # Identity
            "business_id": lead.result_id,
            "search_id": lead.search_id,
            
            # Context
            "business_name": lead.business_name,
            "category": raw.get("category"),       # <--- Safe JSON access
            "website": lead.website,
            "address": lead.address,
            "description": raw.get("description"), # <--- Safe JSON access
            "exporter_profile": exporter_criteria, 

            # Empty Observations
            "website_exists": None,
            "is_marketplace": None,
            "homepage_text": None,
            "business_model": None,
            "extracted_keywords": None,
            "classified_niche": None,

            # Control
            "next_action": None,
            "reasoning_trace": None,
            
            # Outputs
            "relevance_decision": None,
            "relevance_score": None,
            "relevance_reason": None,
            "is_finalized": False,
        }

        # 4. Run the Graph
        final_state = relevancy_graph.invoke(initial_state)

        # 5. Save to DB
        decision = final_state.get('relevance_decision', 'UNKNOWN')
        score = final_state.get('relevance_score')
        print(f"💾 SAVING: {str(decision).upper()} (Score: {score})")
        
        lead.relevance_status = final_state.get("relevance_decision")
        lead.relevance_score = final_state.get("relevance_score")
        lead.relevance_reason = final_state.get("relevance_reason")
        
        db.commit()
        print("✅ RELEVANCY AGENT COMPLETE.")

    except Exception as e:
        print(f"❌ RUNNER CRASHED: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise