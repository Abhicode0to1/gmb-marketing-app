"""
WhatsApp messaging via Meta Cloud API (WhatsApp Business Platform).
Credentials are read from the app_settings table at send time.
"""
import httpx
from datetime import datetime, timezone

from app.models.lead import Lead
from app.models.message import Message, MessageChannel, MessageDirection, MessageStatus
from app.services.settings_service import get_cached

_META_API_BASE = "https://graph.facebook.com/v19.0"


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
    """Convert phone number to E.164 format (e.g. +919876543210)."""
    digits = "".join(c for c in phone if c.isdigit())
    if phone.startswith("+"):
        return "+" + digits
    if len(digits) == 10:
        return "+91" + digits   # default India
    if len(digits) == 12 and digits.startswith("91"):
        return "+" + digits
    return "+" + digits


async def send_whatsapp(lead: Lead, template: str, campaign_id=None) -> Message:
    """Send a WhatsApp message via Meta Cloud API. Returns an unsaved Message record."""
    phone_number_id = get_cached("WA_PHONE_NUMBER_ID")
    access_token = get_cached("WA_ACCESS_TOKEN")

    if not phone_number_id or not access_token:
        raise ValueError("WhatsApp not configured. Go to Settings → WhatsApp to add credentials.")
    if not lead.phone:
        raise ValueError(f"Lead {lead.id} has no phone number")

    personalized = _personalize(template, lead)
    to_number = _format_phone(lead.phone)

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{_META_API_BASE}/{phone_number_id}/messages",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            json={
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": to_number,
                "type": "text",
                "text": {"preview_url": False, "body": personalized},
            },
        )
        if not resp.is_success:
            error_body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else resp.text
            meta_msg = error_body.get("error", {}).get("message", resp.text) if isinstance(error_body, dict) else resp.text
            raise ValueError(f"WhatsApp error: {meta_msg}")
        data = resp.json()

    external_id = (data.get("messages") or [{}])[0].get("id")

    return Message(
        lead_id=lead.id,
        campaign_id=campaign_id,
        channel=MessageChannel.whatsapp,
        direction=MessageDirection.sent,
        content=personalized,
        status=MessageStatus.sent,
        external_id=external_id,
        sent_at=datetime.now(timezone.utc),
    )
