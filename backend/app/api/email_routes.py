from __future__ import annotations

import logging
import os
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.agents.email_outreach.email_draft_service import (
    generate_batch_for_session,
    generate_draft_for_lead,
)
from app.agents.email_outreach.followup_scheduler import run_followup_check
from app.agents.email_outreach.sendgrid_service import send_approved_draft
from app.core.security import get_current_user
from app.db.session import SessionLocal
from app.models.email_draft import EmailDraft
from app.models.search_result import SearchResult

logger = logging.getLogger(__name__)

EMAIL_AGENT_ENABLED = os.getenv("EMAIL_AGENT_ENABLED", "false").lower() == "true"

router = APIRouter(prefix="/api/v1/email", tags=["email"])


# --------------------------------------------------------------------------- #
# Request / Response schemas                                                   #
# --------------------------------------------------------------------------- #

class GenerateDraftRequest(BaseModel):
    user_id: int
    sequence_position: int = 1
    user_instructions: str = ""


class GenerateBatchRequest(BaseModel):
    search_id: int
    user_id: int
    sequence_position: int = 1


# --------------------------------------------------------------------------- #
# Routes                                                                       #
# --------------------------------------------------------------------------- #

@router.post("/generate/{business_id}")
def generate_draft(business_id: int, request: GenerateDraftRequest, current_user = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Generate an email draft for a single lead.

    Returns the generation result dict on success.
    Returns HTTP 404 if the business_id does not exist.
    Returns HTTP 500 for any other unexpected failure.
    """
    if not EMAIL_AGENT_ENABLED:
        raise HTTPException(status_code=503, detail="Email agent temporarily disabled")
    try:
        result = generate_draft_for_lead(
            business_id=business_id,
            user_id=request.user_id,
            sequence_position=request.sequence_position,
            user_instructions=request.user_instructions,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.error(
            "generate_draft FAILED business_id=%s error=%s", business_id, exc, exc_info=True
        )
        raise HTTPException(status_code=500, detail=f"Draft generation failed: {exc}")


@router.post("/generate-batch")
def generate_batch(request: GenerateBatchRequest, current_user = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Generate email drafts for all verified leads in a search session.

    Returns a summary dict with generation statistics.
    """
    if not EMAIL_AGENT_ENABLED:
        raise HTTPException(status_code=503, detail="Email agent temporarily disabled")
    try:
        result = generate_batch_for_session(
            search_id=request.search_id,
            user_id=request.user_id,
            sequence_position=request.sequence_position,
        )
        return result
    except Exception as exc:
        logger.error(
            "generate_batch FAILED search_id=%s error=%s",
            request.search_id,
            exc,
            exc_info=True,
        )
        raise HTTPException(status_code=500, detail=f"Batch generation failed: {exc}")


@router.get("/drafts/{business_id}")
def get_drafts_for_business(business_id: int, current_user = Depends(get_current_user)) -> List[Dict[str, Any]]:
    """
    Get all email drafts for a specific business.

    Returns a list of draft summaries (without body and strategy).
    Returns an empty list if no drafts are found.
    """
    db = SessionLocal()
    try:
        drafts = (
            db.query(EmailDraft)
            .join(SearchResult, EmailDraft.business_id == SearchResult.result_id)
            .filter(
                EmailDraft.business_id == business_id,
                SearchResult.user_id == current_user.user_id
            )
            .all()
        )
        
        return [
            {
                "id": draft.id,
                "business_id": draft.business_id,
                "sequence_position": draft.sequence_position,
                "subject": draft.subject,
                "status": draft.status,
                "sent_at": draft.sent_at,
                "opened_at": draft.opened_at,
                "clicked_at": draft.clicked_at,
                "created_at": draft.created_at,
            }
            for draft in drafts
        ]
    finally:
        db.close()


@router.get("/drafts/detail/{draft_id}")
def get_draft_detail(draft_id: int, current_user = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Get full details for a specific email draft.

    Returns the complete draft record including body and strategy.
    Returns HTTP 404 if the draft is not found.
    """
    db = SessionLocal()
    try:
        draft = (
            db.query(EmailDraft)
            .join(SearchResult, EmailDraft.business_id == SearchResult.result_id)
            .filter(
                EmailDraft.id == draft_id,
                SearchResult.user_id == current_user.user_id
            )
            .first()
        )
        
        if not draft:
            raise HTTPException(
                status_code=404,
                detail=f"Draft ID {draft_id} not found.",
            )
        
        return {
            "id": draft.id,
            "business_id": draft.business_id,
            "exporter_profile_id": draft.exporter_profile_id,
            "sequence_position": draft.sequence_position,
            "subject": draft.subject,
            "body": draft.body,
            "strategy": draft.strategy,
            "status": draft.status,
            "sendgrid_message_id": draft.sendgrid_message_id,
            "sendgrid_message_id_normalized": draft.sendgrid_message_id_normalized,
            "sent_at": draft.sent_at,
            "opened_at": draft.opened_at,
            "clicked_at": draft.clicked_at,
            "bounced_at": draft.bounced_at,
            "bounce_reason": draft.bounce_reason,
            "generation_model": draft.generation_model,
            "generation_error": draft.generation_error,
            "created_at": draft.created_at,
            "updated_at": draft.updated_at,
        }
    finally:
        db.close()


@router.patch("/drafts/{draft_id}/approve")
def approve_draft(draft_id: int, current_user = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Approve a draft for sending.

    Sets draft.status = "approved".
    Only allowed if current status is "pending_review".
    Returns HTTP 400 if the draft is not in the correct state.
    Returns HTTP 404 if the draft is not found.
    """
    db = SessionLocal()
    try:
        draft = (
            db.query(EmailDraft)
            .join(SearchResult, EmailDraft.business_id == SearchResult.result_id)
            .filter(
                EmailDraft.id == draft_id,
                SearchResult.user_id == current_user.user_id
            )
            .first()
        )
        
        if not draft:
            raise HTTPException(
                status_code=404,
                detail=f"Draft ID {draft_id} not found.",
            )
        
        if draft.status not in ("pending_review", "failed"):
            raise HTTPException(
                status_code=400,
                detail=f"Cannot approve draft with status '{draft.status}'. "
                       f"Only 'pending_review' drafts can be approved.",
            )
        
        draft.status = "approved"
        db.commit()
        
        return {
            "id": draft.id,
            "business_id": draft.business_id,
            "status": draft.status,
            "message": "Draft approved successfully",
        }
    finally:
        db.close()


@router.patch("/drafts/{draft_id}/send")
def send_draft(draft_id: int, current_user = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Send an approved email draft via SendGrid.

    Returns the send result dict.
    Returns HTTP 400 if the draft cannot be sent (e.g., not approved).
    """
    if not EMAIL_AGENT_ENABLED:
        raise HTTPException(status_code=503, detail="Email agent temporarily disabled")
    try:
        result = send_approved_draft(draft_id)
        
        if result["status"] == "failed":
            raise HTTPException(
                status_code=400,
                detail=result.get("reason", "Send failed"),
            )
        
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            "send_draft FAILED draft_id=%s error=%s", draft_id, exc, exc_info=True
        )
        raise HTTPException(status_code=500, detail=f"Send failed: {exc}")


@router.delete("/drafts/{draft_id}")
def delete_draft(draft_id: int, current_user = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Delete an email draft.

    Returns HTTP 404 if the draft is not found.
    """
    db = SessionLocal()
    try:
        draft = (
            db.query(EmailDraft)
            .join(SearchResult, EmailDraft.business_id == SearchResult.result_id)
            .filter(
                EmailDraft.id == draft_id,
                SearchResult.user_id == current_user.user_id
            )
            .first()
        )
        
        if not draft:
            raise HTTPException(
                status_code=404,
                detail=f"Draft ID {draft_id} not found.",
            )
        
        db.delete(draft)
        db.commit()
        
        return {
            "id": draft_id,
            "message": "Draft deleted successfully",
        }
    finally:
        db.close()


@router.post("/followup-check")
def followup_check(current_user = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Run the follow-up scheduler to generate drafts for sent emails.

    This endpoint checks for sent emails that are ready for follow-up
    and automatically generates the next sequence draft for each.

    Can be triggered manually or via a cron job.
    """
    if not EMAIL_AGENT_ENABLED:
        raise HTTPException(status_code=503, detail="Email agent temporarily disabled")
    try:
        result = run_followup_check()
        return result
    except Exception as exc:
        logger.error("followup_check FAILED error=%s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Follow-up check failed: {exc}")
