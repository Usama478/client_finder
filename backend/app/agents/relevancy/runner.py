from sqlalchemy.orm import Session
from app.models.search_result import SearchResult
from app.models.search_session import SearchSession
from app.agents.relevancy.state import RelevancyAgentState
from app.agents.relevancy.graph import relevancy_graph


def run_relevancy_agent(db: Session, business_id: int) -> None:
    """
    Executes the Relevancy Agent for a single business lead.
    Flow: DB -> State -> LangGraph -> State -> DB.
    """
    print(f"\nRUNNER: Starting Relevancy Agent for Business ID {business_id}...")

    lead = None
    try:
        # 1. Fetch Lead
        lead = db.query(SearchResult).filter(SearchResult.result_id == business_id).first()
        if not lead:
            print(f"Error: SearchResult {business_id} not found.")
            return

        # 2. Fetch Criteria
        session = db.query(SearchSession).filter(SearchSession.search_id == lead.search_id).first()

        if session and session.context:
            exporter_criteria = session.context.prompt_text
        else:
            exporter_criteria = session.search_query if session else "General Business"

        raw = lead.raw_data if lead.raw_data else {}

        # 3. Initialize State
        initial_state: RelevancyAgentState = {
            "business_id": lead.result_id,
            "search_id": lead.search_id,
            "business_name": lead.business_name,
            "category": raw.get("category"),
            "website": lead.website,
            "address": lead.address,
            "description": raw.get("description"),
            "exporter_profile": exporter_criteria,
            "website_exists": None,
            "is_marketplace": None,
            "evidence": None,
            "relevance_decision": None,
            "relevance_score": None,
            "relevance_reason": None,
            "business_type": None,
            "primary_niche": None,
            "is_finalized": False,
        }

        # 4. Run the graph
        final_state = relevancy_graph.invoke(initial_state)

        # 5. Save to DB
        decision = final_state.get("relevance_decision", "unknown")
        score = final_state.get("relevance_score")
        print(f"SAVING: {str(decision).upper()} (Score: {score})")

        lead.relevance_status = "completed"
        lead.relevance_decision = final_state.get("relevance_decision")
        lead.relevance_score = final_state.get("relevance_score")
        lead.relevance_reason = final_state.get("relevance_reason")
        lead.business_type = final_state.get("business_type")
        lead.primary_niche = final_state.get("primary_niche")

        db.commit()
        print("RELEVANCY AGENT COMPLETE.")

    except Exception as e:
        print(f"RUNNER CRASHED: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        if lead:
            try:
                lead.relevance_status = "failed"
                db.commit()
            except Exception:
                db.rollback()
        raise
