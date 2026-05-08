import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.database import get_db
from app.models.user import User
from app.services.settings_service import (
    SETTING_KEYS, get_cached, get_status, refresh_cache, save_settings,
)

router = APIRouter(prefix="/settings", tags=["settings"])

MASKED_KEYS = {"GMAIL_APP_PASSWORD", "WA_ACCESS_TOKEN"}


class SettingsUpdate(BaseModel):
    GMAIL_ADDRESS: str | None = None
    GMAIL_APP_PASSWORD: str | None = None
    GMAIL_FROM_NAME: str | None = None
    WA_PHONE_NUMBER_ID: str | None = None
    WA_ACCESS_TOKEN: str | None = None
    WA_VERIFY_TOKEN: str | None = None


def _mask(key: str, val: str | None) -> str:
    if not val:
        return ""
    if key in MASKED_KEYS:
        return "••••••••" + val[-4:] if len(val) > 4 else "configured"
    return val


@router.get("")
async def get_settings(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    await refresh_cache(db)
    return {
        "values": {k: _mask(k, get_cached(k)) for k in SETTING_KEYS},
        "status": get_status(),
    }


@router.put("")
async def update_settings(
    body: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    # Only update fields with actual new values (skip blanks — keeps existing masked values)
    data = {k: v for k, v in body.model_dump().items() if v}
    if not data:
        raise HTTPException(400, "No values to save")
    await save_settings(db, data)
    return {"message": "Settings saved", "updated": list(data.keys())}


@router.post("/test-email")
async def test_email_connection(_: User = Depends(get_current_user)):
    """Send a test email to the configured Gmail address."""
    import aiosmtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    gmail_user = get_cached("GMAIL_ADDRESS")
    gmail_pass = get_cached("GMAIL_APP_PASSWORD")
    from_name = get_cached("GMAIL_FROM_NAME") or "GMB Marketing"

    if not gmail_user or not gmail_pass:
        return {"success": False, "message": "Gmail credentials not configured yet"}

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "GMB Marketing — Email Connected ✅"
        msg["From"] = f"{from_name} <{gmail_user}>"
        msg["To"] = gmail_user
        msg.attach(MIMEText(
            "<p>Your Gmail SMTP is connected and working. You can now send campaigns!</p>",
            "html", "utf-8"
        ))
        await aiosmtplib.send(
            msg,
            hostname="smtp.gmail.com",
            port=587,
            username=gmail_user,
            password=gmail_pass,
            start_tls=True,
        )
        return {"success": True, "message": f"Test email sent to {gmail_user}"}
    except Exception as e:
        return {"success": False, "message": str(e)}


@router.post("/test-whatsapp")
async def test_whatsapp_connection(_: User = Depends(get_current_user)):
    """Verify WhatsApp credentials by calling the Meta Graph API."""
    phone_number_id = get_cached("WA_PHONE_NUMBER_ID")
    access_token = get_cached("WA_ACCESS_TOKEN")

    if not phone_number_id or not access_token:
        return {"success": False, "message": "WhatsApp credentials not configured yet"}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://graph.facebook.com/v19.0/{phone_number_id}",
                headers={"Authorization": f"Bearer {access_token}"},
            )
        data = resp.json()
        if resp.status_code == 200:
            phone = data.get("display_phone_number", "")
            name = data.get("verified_name", "")
            return {"success": True, "message": f"Connected: {name} ({phone})"}
        else:
            err = data.get("error", {}).get("message", "Unknown error")
            return {"success": False, "message": err}
    except Exception as e:
        return {"success": False, "message": str(e)}
