from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from app.db.session import get_db
from app.agents.verification.runner import run_verification_agent

router = APIRouter(prefix="/api/v1/verification", tags=["verification"])

class VerifyRequest(BaseModel):
    business_ids: List[int]

def process_verification_batch(business_ids: List[int]):
    """Background task to run verification agents"""
    # Need a separate DB session for background task
    from app.db.session import SessionLocal
    import logging
    from app.models.search_result import SearchResult
    db = SessionLocal()
    try:
        for b_id in business_ids:
            try:
                run_verification_agent(db, b_id)
            except Exception as e:
                logging.error(f"Verification Failed: {str(e)}", exc_info=True)
                # Fallback handler: Update the verification_status to "failed" on unhandled exception
                try:
                    lead = db.query(SearchResult).filter(SearchResult.result_id == b_id).first()
                    if lead:
                        lead.verification_status = "failed"
                        db.commit()
                except Exception as inner_e:
                    logging.error(f"Failed to update lead status to failed: {inner_e}")
    finally:
        db.close()

@router.post("/verify")
def verify_businesses(request: VerifyRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Triggers the Verification Agent for a list of business IDs.
    Runs asynchronously in the background.
    """
    if not request.business_ids:
        raise HTTPException(status_code=400, detail="No business IDs provided.")
    
    # Fire and forget
    background_tasks.add_task(process_verification_batch, request.business_ids)
    
    return {
        "status": "processing",
        "message": f"Started Verification Agent for {len(request.business_ids)} leads.",
        "business_ids": request.business_ids
    }
