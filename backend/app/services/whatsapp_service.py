"""
WhatsApp messaging via Twilio WhatsApp API.
Supports both template messages (first outreach) and session messages (replies).
"""
from datetime import datetime, timezone

from twilio.rest import Client

from app.config import settings
from app.models.lead import Lead
from app.models.message import Message, MessageChannel, MessageDirection, MessageStatus


def _personalize(template: str, lead: Lead) -> str:
    replacements = {
        "{business_name}": lead.business_name or "",
        "{city}": lead.city or "",
        "{category}": lead.category or "business",
    }
    result = template
    for token, value in replacements.items():
        result = result.replace(token, value)
    return result


def _format_phone(phone: str) -> str:
    """Ensure phone number is in E.164 format for WhatsApp."""
    digits = "".join(c for c in phone if c.isdigit() or c == "+")
    if not digits.startswith("+"):
        # Default to India country code if no prefix
        digits = "+91" + digits.lstrip("0")
    return f"whatsapp:{digits}"


def send_whatsapp(lead: Lead, template: str, campaign_id=None) -> Message:
    """Send a WhatsApp message to a lead. Returns a Message record (unsaved)."""
    if not lead.phone:
        raise ValueError(f"Lead {lead.id} has no phone number")

    personalized = _personalize(template, lead)
    to_number = _format_phone(lead.phone)

    client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
    twilio_msg = client.messages.create(
        from_=settings.TWILIO_WHATSAPP_FROM,
        to=to_number,
        body=personalized,
    )

    return Message(
        lead_id=lead.id,
        campaign_id=campaign_id,
        channel=MessageChannel.whatsapp,
        direction=MessageDirection.sent,
        content=personalized,
        status=MessageStatus.sent,
        external_id=twilio_msg.sid,
        sent_at=datetime.now(timezone.utc),
    )
