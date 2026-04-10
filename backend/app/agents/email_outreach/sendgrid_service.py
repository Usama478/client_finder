import os
import logging
from datetime import datetime, timezone
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content, TrackingSettings, ClickTracking, OpenTracking

from app.db.session import SessionLocal
from app.models.email_draft import EmailDraft
from app.models.search_result import SearchResult
from app.models.exporter_profile import ExporterProfile

logger = logging.getLogger(__name__)

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
SENDGRID_FROM_EMAIL = os.getenv("SENDGRID_FROM_EMAIL")
SENDGRID_FROM_NAME = os.getenv("SENDGRID_FROM_NAME", "")

if SENDGRID_API_KEY is None:
    logger.warning("SENDGRID_API_KEY is not set in environment variables")


def send_approved_draft(draft_id: int) -> dict:
    """
    Send an approved email draft via SendGrid.
    
    Args:
        draft_id: The ID of the email draft to send
        
    Returns:
        dict with status and additional info
    """
    db = None
    try:
        db = SessionLocal()
        
        # 1. Fetch EmailDraft by draft_id
        draft = db.query(EmailDraft).filter(EmailDraft.id == draft_id).first()
        if not draft:
            raise ValueError(f"Draft {draft_id} not found")
        
        # 2. Check if draft is approved
        if draft.status != "approved":
            raise ValueError(
                f"Draft {draft_id} status is {draft.status}, must be approved"
            )
        
        # 3. Fetch SearchResult for lead email address
        lead = db.query(SearchResult).filter(
            SearchResult.result_id == draft.business_id
        ).first()
        if not lead:
            return {"status": "failed", "reason": "lead not found"}
        
        # 4. Fetch ExporterProfile for from_name
        profile = db.query(ExporterProfile).filter(
            ExporterProfile.id == draft.exporter_profile_id
        ).first()
        if not profile:
            return {"status": "failed", "reason": "exporter profile not found"}
        
        # 5. Get to_email
        to_email = lead.email_found
        if to_email is None:
            return {"status": "failed", "reason": "no email address on lead"}
        
        # 6. Determine from_name
        from_name = SENDGRID_FROM_NAME or profile.contact_person_name or ""
        
        # 7. Build SendGrid Mail object
        from_email_obj = Email(SENDGRID_FROM_EMAIL, from_name)
        to_email_obj = To(to_email)
        subject = draft.subject
        content = Content("text/plain", draft.body)
        
        mail = Mail(
            from_email=from_email_obj,
            to_emails=to_email_obj,
            subject=subject,
            plain_text_content=content
        )
        
        # Enable click tracking and open tracking
        mail.tracking_settings = TrackingSettings()
        mail.tracking_settings.click_tracking = ClickTracking(enable=True, enable_text=False)
        mail.tracking_settings.open_tracking = OpenTracking(enable=True)
        
        # 8. Send via SendGrid API
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(mail)
        
        # 9. On HTTP 202 response
        if response.status_code == 202:
            raw_message_id = response.headers.get("X-Message-Id", "")
            normalized_id = raw_message_id.split(".")[0] if raw_message_id else ""
            
            draft.sendgrid_message_id = raw_message_id
            draft.sendgrid_message_id_normalized = normalized_id
            draft.status = "sent"
            draft.sent_at = datetime.now(timezone.utc)
            if lead:
                lead.outreach_status = "sent"
            db.commit()
            
            return {"status": "sent", "message_id": raw_message_id}
        else:
            draft.status = "failed"
            draft.generation_error = f"Unexpected status code: {response.status_code}"
            db.commit()
            return {"status": "failed", "reason": f"Unexpected status code: {response.status_code}"}
            
    except Exception as error:
        # 10. On any SendGrid error
        if db and draft:
            try:
                draft.status = "failed"
                draft.generation_error = str(error)
                db.commit()
            except Exception as commit_error:
                logger.error(f"Failed to update draft status: {commit_error}")
        
        return {"status": "failed", "reason": str(error)}
    
    finally:
        if db:
            db.close()


def handle_sendgrid_webhook(events: list) -> dict:
    """
    Process SendGrid webhook events.
    
    Args:
        events: List of webhook event dictionaries from SendGrid
        
    Returns:
        dict with number of events processed
    """
    for event in events:
        db = None
        try:
            raw_id = event.get("sg_message_id", "")
            normalized_id = raw_id.split(".")[0] if raw_id else ""
            
            if not normalized_id:
                continue
            
            db = SessionLocal()
            
            # Query EmailDraft by normalized message ID
            draft = db.query(EmailDraft).filter(
                EmailDraft.sendgrid_message_id_normalized == normalized_id
            ).first()
            
            if not draft:
                logger.warning(f"No draft found for message_id: {normalized_id}")
                db.close()
                continue
            
            event_type = event.get("event", "")
            timestamp = event.get("timestamp", 0)
            event_dt = datetime.fromtimestamp(timestamp, tz=timezone.utc)
            
            # Handle open event
            if event_type == "open" and draft.opened_at is None:
                draft.opened_at = event_dt
                
                # Sync to lead
                lead = db.query(SearchResult).filter(SearchResult.result_id == draft.business_id).first()
                if lead and lead.outreach_status in ("sent", "pending"):
                    lead.outreach_status = "opened"
            
            # Handle click event
            if event_type == "click" and draft.clicked_at is None:
                draft.clicked_at = event_dt
            
            # Handle bounce event
            if event_type == "bounce":
                draft.status = "bounced"
                draft.bounced_at = datetime.now(timezone.utc)
                draft.bounce_reason = event.get("reason", "")
                
                # Update lead email status
                lead = db.query(SearchResult).filter(
                    SearchResult.result_id == draft.business_id
                ).first()
                if lead:
                    lead.email_status = "bounced"
                    lead.outreach_status = "bounced"
            
            db.commit()
            db.close()
            
        except Exception as e:
            logger.warning(f"Error processing webhook event: {e}")
            if db:
                try:
                    db.close()
                except:
                    pass
            continue
    
    return {"processed": len(events)}
