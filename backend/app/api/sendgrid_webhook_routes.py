import json
import logging
import hmac
import hashlib
import os
from fastapi import APIRouter, Request, HTTPException
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
    webhook_key = os.getenv("SENDGRID_WEBHOOK_KEY")
    if not webhook_key:
        raise HTTPException(status_code=403, detail="Webhook verification not configured")
    sig = request.headers.get(
        "X-Twilio-Email-Event-Webhook-Signature", "")
    ts = request.headers.get(
        "X-Twilio-Email-Event-Webhook-Timestamp", "")
    body = await request.body()
    token = ts.encode() + body
    expected = hmac.new(
        webhook_key.encode(), token, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        raise HTTPException(status_code=403, detail="Invalid signature")
    try:
        events = json.loads(body)
        
        # Handle both single event and list of events
        if not isinstance(events, list):
            events = [events]
        
        result = handle_sendgrid_webhook(events)
        
        return JSONResponse({"ok": True}, status_code=200)
        
    except Exception as e:
        logger.error(f"Error in sendgrid webhook: {e}")
        # Always return 200 to prevent SendGrid retries
        return JSONResponse({"ok": True}, status_code=200)
