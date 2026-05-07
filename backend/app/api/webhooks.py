"""
Webhook receivers for SendGrid (email events) and Twilio (WhatsApp delivery/reply events).
These endpoints are called by external services — no auth required.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.lead import Lead, LeadStatus
from app.models.message import Message, MessageChannel, MessageDirection, MessageStatus

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


async def _handle_sendgrid_event(event: dict):
    async with AsyncSessionLocal() as db:
        external_id = event.get("sg_message_id", "").split(".")[0]
        if not external_id:
            return
        msg = await db.scalar(select(Message).where(Message.external_id == external_id))
        if not msg:
            return

        event_type = event.get("event")
        now = datetime.now(timezone.utc)

        if event_type == "open" and msg.status not in (MessageStatus.replied,):
            msg.status = MessageStatus.opened
            msg.opened_at = now
        elif event_type in ("click",) and msg.status not in (MessageStatus.replied,):
            msg.status = MessageStatus.opened
            msg.opened_at = msg.opened_at or now
        elif event_type == "delivered":
            if msg.status == MessageStatus.sent:
                msg.status = MessageStatus.delivered
                msg.delivered_at = now
        elif event_type == "bounce" or event_type == "dropped":
            msg.status = MessageStatus.failed

        await db.commit()


async def _handle_inbound_email(data: dict):
    """Process an inbound reply email from SendGrid Inbound Parse."""
    async with AsyncSessionLocal() as db:
        from_email = data.get("from", "")
        text_body = data.get("text", "") or data.get("html", "")

        lead = await db.scalar(select(Lead).where(Lead.email == from_email))
        if not lead:
            return

        reply_msg = Message(
            lead_id=lead.id,
            channel=MessageChannel.email,
            direction=MessageDirection.received,
            subject=data.get("subject"),
            content=text_body[:5000],
            status=MessageStatus.replied,
            sent_at=datetime.now(timezone.utc),
        )
        db.add(reply_msg)

        if lead.status == LeadStatus.contacted:
            lead.status = LeadStatus.interested
        await db.commit()


@router.post("/sendgrid")
async def sendgrid_webhook(request: Request, background_tasks: BackgroundTasks):
    """Receives delivery/open/click events from SendGrid Event Webhook."""
    events = await request.json()
    if not isinstance(events, list):
        events = [events]
    for event in events:
        background_tasks.add_task(_handle_sendgrid_event, event)
    return {"ok": True}


@router.post("/sendgrid/inbound")
async def sendgrid_inbound(request: Request, background_tasks: BackgroundTasks):
    """Receives inbound reply emails via SendGrid Inbound Parse."""
    form = await request.form()
    data = dict(form)
    background_tasks.add_task(_handle_inbound_email, data)
    return {"ok": True}


@router.get("/whatsapp")
async def whatsapp_verify(request: Request):
    """Meta webhook verification challenge."""
    from app.config import settings
    params = dict(request.query_params)
    if params.get("hub.verify_token") == settings.META_WA_VERIFY_TOKEN:
        return int(params.get("hub.challenge", 0))
    return {"error": "Invalid verify token"}


@router.post("/whatsapp")
async def whatsapp_webhook(request: Request, background_tasks: BackgroundTasks):
    """Receives delivery status updates and inbound messages from WhatsApp Cloud API."""
    body = await request.json()
    background_tasks.add_task(_process_whatsapp_event, body)
    return {"ok": True}


async def _process_whatsapp_event(body: dict):
    async with AsyncSessionLocal() as db:
        try:
            entry = body.get("entry", [{}])[0]
            changes = entry.get("changes", [{}])[0]
            value = changes.get("value", {})

            # Handle status updates
            for status_update in value.get("statuses", []):
                msg_id = status_update.get("id")
                wa_status = status_update.get("status")
                msg = await db.scalar(select(Message).where(Message.external_id == msg_id))
                if not msg:
                    continue
                now = datetime.now(timezone.utc)
                if wa_status == "delivered":
                    msg.status = MessageStatus.delivered
                    msg.delivered_at = now
                elif wa_status == "read":
                    msg.status = MessageStatus.opened
                    msg.opened_at = now
                elif wa_status == "failed":
                    msg.status = MessageStatus.failed
                await db.commit()

            # Handle inbound messages (replies)
            for wa_message in value.get("messages", []):
                from_number = wa_message.get("from", "")
                text = wa_message.get("text", {}).get("body", "")
                normalized = from_number.lstrip("+")

                lead = await db.scalar(
                    select(Lead).where(Lead.phone.like(f"%{normalized[-10:]}%"))
                )
                if not lead:
                    continue

                reply = Message(
                    lead_id=lead.id,
                    channel=MessageChannel.whatsapp,
                    direction=MessageDirection.received,
                    content=text[:5000],
                    status=MessageStatus.replied,
                    sent_at=datetime.now(timezone.utc),
                )
                db.add(reply)
                if lead.status == LeadStatus.contacted:
                    lead.status = LeadStatus.interested
                await db.commit()
        except Exception:
            pass
