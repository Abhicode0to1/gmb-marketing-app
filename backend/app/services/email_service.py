"""
Email sending via Gmail SMTP using aiosmtplib.
Credentials are read from the app_settings table at send time.
"""
import aiosmtplib
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.models.lead import Lead
from app.models.message import Message, MessageChannel, MessageDirection, MessageStatus
from app.services.settings_service import get_cached


def _personalize(template: str, lead: Lead) -> str:
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


async def send_email(lead: Lead, subject: str, html_template: str, campaign_id=None) -> Message:
    """Send a personalized email to a lead via Gmail SMTP. Returns an unsaved Message record."""
    gmail_user = get_cached("GMAIL_ADDRESS")
    gmail_pass = get_cached("GMAIL_APP_PASSWORD")
    from_name = get_cached("GMAIL_FROM_NAME") or "Web Design Team"

    if not gmail_user or not gmail_pass:
        raise ValueError("Gmail SMTP not configured. Go to Settings → Email to add credentials.")
    if not lead.email:
        raise ValueError(f"Lead {lead.id} has no email address")

    personalized_subject = _personalize(subject, lead)
    personalized_html = _personalize(html_template, lead)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = personalized_subject
    msg["From"] = f"{from_name} <{gmail_user}>"
    msg["To"] = lead.email

    msg.attach(MIMEText(personalized_html, "html", "utf-8"))

    await aiosmtplib.send(
        msg,
        hostname="smtp.gmail.com",
        port=587,
        username=gmail_user,
        password=gmail_pass,
        start_tls=True,
    )

    return Message(
        lead_id=lead.id,
        campaign_id=campaign_id,
        channel=MessageChannel.email,
        direction=MessageDirection.sent,
        subject=personalized_subject,
        content=personalized_html,
        status=MessageStatus.sent,
        sent_at=datetime.now(timezone.utc),
    )
