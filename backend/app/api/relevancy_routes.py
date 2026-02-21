from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from app.db.session import get_db
from app.agents.relevancy.runner import run_relevancy_agent

router = APIRouter(prefix="/api/v1/relevancy", tags=["relevancy"])

class AnalyzeRequest(BaseModel):
    business_ids: List[int]

def process_relevancy_batch(business_ids: List[int]):
    """Background task to run relevancy agents"""
    # Need a separate DB session for background task
    from app.db.session import SessionLocal
    import logging
    from app.models.search_result import SearchResult
    db = SessionLocal()
    try:
        for b_id in business_ids:
            try:
                run_relevancy_agent(db, b_id)
            except Exception as e:
                logging.error(f"Agent Failed: {str(e)}", exc_info=True)
                # Fallback handler: Update the relevance_status to "failed" on unhandled exception
                try:
                    lead = db.query(SearchResult).filter(SearchResult.id == b_id).first()
                    if lead:
                        lead.relevance_status = "failed"
                        db.commit()
                except Exception as inner_e:
                    logging.error(f"Failed to update lead status to failed: {inner_e}")
    finally:
        db.close()

@router.post("/analyze")
def analyze_businesses(request: AnalyzeRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Triggers the Relevancy Agent for a list of business IDs.
    Runs asynchronously in the background.
    """
    if not request.business_ids:
        raise HTTPException(status_code=400, detail="No business IDs provided.")
    
    # Fire and forget
    background_tasks.add_task(process_relevancy_batch, request.business_ids)
    
    return {
        "status": "processing",
        "message": f"Started Relevancy Agent for {len(request.business_ids)} leads.",
        "business_ids": request.business_ids
    }
