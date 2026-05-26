import json
import logging
import os
import time

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
from sendgrid.helpers.eventwebhook import EventWebhook, EventWebhookHeader

from app.agents.email_outreach.sendgrid_service import handle_sendgrid_webhook

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/webhooks", tags=["webhooks"])


@router.post("/sendgrid")
async def sendgrid_webhook(request: Request):
    """
    Receive and process SendGrid webhook events.

    SendGrid sends events like: open, click, bounce, delivered, etc.
    Signature failures return 403. Processing errors return 500 for retry.
    """
    public_key = os.getenv("SENDGRID_WEBHOOK_PUBLIC_KEY")
    if not public_key:
        raise HTTPException(status_code=403, detail="Webhook verification not configured")

    sig = request.headers.get(EventWebhookHeader.SIGNATURE, "")
    ts = request.headers.get(EventWebhookHeader.TIMESTAMP, "")
    body = await request.body()

    try:
        if abs(time.time() - int(ts)) > 300:
            raise HTTPException(status_code=403, detail="Webhook timestamp too old")
    except ValueError:
        raise HTTPException(status_code=403, detail="Invalid timestamp")

    ew = EventWebhook()
    ec_public_key = ew.convert_public_key(public_key)
    if not ew.verify_signature(body.decode(), ec_public_key, sig, ts):
        raise HTTPException(status_code=403, detail="Invalid signature")

    try:
        events = json.loads(body)

        if not isinstance(events, list):
            events = [events]

        handle_sendgrid_webhook(events)

        return JSONResponse({"ok": True}, status_code=200)

    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in sendgrid webhook: {e}")
        return JSONResponse({"error": "Invalid payload"}, status_code=400)
    except Exception as e:
        logger.error(f"Error processing sendgrid webhook: {e}")
        return JSONResponse({"error": "Processing error"}, status_code=500)
