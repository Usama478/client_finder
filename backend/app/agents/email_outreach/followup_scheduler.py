import logging
from datetime import datetime, timedelta, timezone

from app.agents.email_outreach.email_draft_service import generate_draft_for_lead
from app.db.session import SessionLocal
from app.models.email_draft import EmailDraft
from app.models.search_result import SearchResult

logger = logging.getLogger(__name__)


def run_followup_check() -> dict:
    """
    Check for sent emails that need follow-ups and generate drafts for them.

    Logic:
    1. Find all EmailDraft records where:
       - status == "sent"
       - sequence_position < 3
       - sent_at < 5 days ago
       - draft.status != "bounced"
    2. For each qualifying draft:
       - Fetch the lead (SearchResult)
       - Skip if lead.email_status == "bounced"
       - Check if a follow-up draft already exists
       - If not, generate the next sequence draft
    3. Return summary statistics

    Returns:
        dict with keys: checked, generated, skipped, failed
    """
    db = SessionLocal()
    
    checked = 0
    generated = 0
    skipped = 0
    failed = 0
    
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=5)
        
        qualifying_drafts = (
            db.query(EmailDraft)
            .filter(
                EmailDraft.status == "sent",
                EmailDraft.sequence_position < 3,
                EmailDraft.sent_at < cutoff,
            )
            .all()
        )
        
        logger.info(f"followup_check: found {len(qualifying_drafts)} qualifying drafts")
        
        for draft in qualifying_drafts:
            checked += 1
            
            try:
                lead = (
                    db.query(SearchResult)
                    .filter(SearchResult.result_id == draft.business_id)
                    .first()
                )
                
                if lead is None:
                    logger.warning(
                        f"followup_check: lead not found for business_id={draft.business_id}"
                    )
                    skipped += 1
                    continue
                
                if lead.email_status == "bounced":
                    logger.info(
                        f"followup_check: skipping business_id={draft.business_id} "
                        f"(email_status=bounced)"
                    )
                    skipped += 1
                    continue
                
                next_position = draft.sequence_position + 1
                
                existing_followup = (
                    db.query(EmailDraft)
                    .filter(
                        EmailDraft.business_id == draft.business_id,
                        EmailDraft.sequence_position == next_position,
                        EmailDraft.exporter_profile_id == draft.exporter_profile_id,
                    )
                    .first()
                )
                
                if existing_followup is not None:
                    logger.info(
                        f"followup_check: follow-up already exists for "
                        f"business_id={draft.business_id} position={next_position}"
                    )
                    skipped += 1
                    continue
                
                result = generate_draft_for_lead(
                    business_id=draft.business_id,
                    user_id=lead.user_id,
                    sequence_position=next_position,
                )
                
                if result["status"] == "created":
                    generated += 1
                    logger.info(
                        f"followup_check: generated follow-up draft_id={result['draft_id']} "
                        f"for business_id={draft.business_id} position={next_position}"
                    )
                elif result["status"] == "skipped":
                    skipped += 1
                elif result["status"] == "failed":
                    failed += 1
                    
            except Exception as e:
                logger.error(
                    f"followup_check: error processing draft_id={draft.id} "
                    f"business_id={draft.business_id}: {e}",
                    exc_info=True,
                )
                failed += 1
                continue
        
    finally:
        db.close()
    
    summary = {
        "checked": checked,
        "generated": generated,
        "skipped": skipped,
        "failed": failed,
    }
    
    logger.info(f"followup_check complete: {summary}")
    
    return summary
