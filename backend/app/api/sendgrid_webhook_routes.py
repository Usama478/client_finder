import logging
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.agents.email_outreach.sendgrid_service import handle_sendgrid_webhook

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/webhooks", tags=["webhooks"])


@router.post("/sendgrid")
async def sendgrid_webhook(request: Request):
    """
    Receive and process SendGrid webhook events.
    
    SendGrid sends events like: open, click, bounce, delivered, etc.
    This endpoint always returns 200 to prevent SendGrid from retrying.
    """
    try:
        events = await request.json()
        
        # Handle both single event and list of events
        if not isinstance(events, list):
            events = [events]
        
        result = handle_sendgrid_webhook(events)
        
        return JSONResponse({"ok": True}, status_code=200)
        
    except Exception as e:
        logger.error(f"Error in sendgrid webhook: {e}")
        # Always return 200 to prevent SendGrid retries
        return JSONResponse({"ok": True}, status_code=200)
