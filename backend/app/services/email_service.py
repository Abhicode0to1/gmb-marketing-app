"""
Email sending via SendGrid with personalization and tracking.
"""
import re
from datetime import datetime, timezone

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, To

from app.config import settings
from app.models.lead import Lead
from app.models.message import Message, MessageChannel, MessageDirection, MessageStatus


def _personalize(template: str, lead: Lead) -> str:
    """Replace {business_name}, {city}, {phone} tokens in template."""
    replacements = {
        "{business_name}": lead.business_name or "",
        "{city}": lead.city or "",
        "{phone}": lead.phone or "",
        "{website}": lead.website or "none",
        "{category}": lead.category or "business",
    }
    result = template
    for token, value in replacements.items():
        result = result.replace(token, value)
    return result


def send_email(lead: Lead, subject: str, html_template: str, campaign_id=None) -> Message:
    """Send a personalized email to a lead. Returns a Message record (unsaved)."""
    if not lead.email:
        raise ValueError(f"Lead {lead.id} has no email address")

    personalized_subject = _personalize(subject, lead)
    personalized_html = _personalize(html_template, lead)

    message = Mail(
        from_email=(settings.SENDGRID_FROM_EMAIL, settings.SENDGRID_FROM_NAME),
        to_emails=To(lead.email, lead.business_name),
        subject=personalized_subject,
        html_content=personalized_html,
    )
    # Enable open and click tracking
    message.tracking_settings = {
        "click_tracking": {"enable": True},
        "open_tracking": {"enable": True},
    }

    sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
    response = sg.send(message)

    external_id = None
    if response.headers:
        external_id = response.headers.get("X-Message-Id")

    return Message(
        lead_id=lead.id,
        campaign_id=campaign_id,
        channel=MessageChannel.email,
        direction=MessageDirection.sent,
        subject=personalized_subject,
        content=personalized_html,
        status=MessageStatus.sent,
        external_id=external_id,
        sent_at=datetime.now(timezone.utc),
    )
