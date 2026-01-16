from sqlalchemy.orm import Session
from app.models.search_result import SearchResult
from app.models.user_context import UserContext
from app.agents.relevancy.graph import relevancy_graph

def run_relevancy_agent(db: Session, business_id: int):
    print(f"\n🚀 STARTING AGENT for Business ID {business_id}...")

    # 1. Fetch Data
    # FIX: Changed .id to .result_id to match your database schema
    business = db.query(SearchResult).filter(SearchResult.result_id == business_id).first()
    
    if not business:
        print("❌ Error: Business not found.")
        return

    context = db.query(UserContext).filter(UserContext.user_id == business.user_id).first()
    
    if not context:
        print("❌ Error: User Context not found.")
        return

    # 2. Initial State
    initial_state = {
        # FIX: Changed .id to .result_id here as well
        "result_id": business.result_id,
        "user_id": business.user_id,
        "business_data": business.raw_data or {},
        "user_context": {
            "description": context.company_description,
            "targets": context.target_markets
        },
        # Everything else starts Empty/None
        "website_exists": None,
        "is_marketplace": None,
        "homepage_text": None,
        "next_action": None
    }

    # 3. Run the Graph!
    try:
        final_state = relevancy_graph.invoke(initial_state)

        # 4. Save to DB
        print(f"\n💾 SAVING RESULT: {final_state['relevance_status'].upper()} (Score: {final_state['relevance_score']})")
        
        business.relevance_status = final_state["relevance_status"]
        business.relevance_score = final_state["relevance_score"]
        business.relevance_reason = final_state["relevance_reason"]
        
        db.commit()
        print("✅ AGENT RUN COMPLETE.")
        
    except Exception as e:
        print(f"❌ AGENT CRASHED: {str(e)}")