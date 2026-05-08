"""
In-memory cache of app settings backed by the app_settings DB table.
Cache is populated at startup and updated on every save.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.settings import AppSetting

_cache: dict[str, str] = {}

SETTING_KEYS = [
    "GMAIL_ADDRESS",
    "GMAIL_APP_PASSWORD",
    "GMAIL_FROM_NAME",
    "WA_PHONE_NUMBER_ID",
    "WA_ACCESS_TOKEN",
    "WA_VERIFY_TOKEN",
]


async def refresh_cache(db: AsyncSession) -> None:
    global _cache
    try:
        result = await db.execute(select(AppSetting))
        rows = result.scalars().all()
        _cache = {row.key: row.value for row in rows if row.value}
    except Exception:
        pass  # Table may not exist yet during first migration


def get_cached(key: str, default: str | None = None) -> str | None:
    return _cache.get(key, default)


async def save_settings(db: AsyncSession, data: dict[str, str | None]) -> None:
    for key, value in data.items():
        if key not in SETTING_KEYS:
            continue
        row = await db.get(AppSetting, key)
        if row:
            row.value = value if value else None
        else:
            db.add(AppSetting(key=key, value=value if value else None))
    await db.commit()
    for key, value in data.items():
        if value:
            _cache[key] = value
        elif key in _cache:
            del _cache[key]


def get_status() -> dict[str, bool]:
    """Returns configured/not-configured status for each integration."""
    return {
        "email": bool(_cache.get("GMAIL_ADDRESS") and _cache.get("GMAIL_APP_PASSWORD")),
        "whatsapp": bool(_cache.get("WA_PHONE_NUMBER_ID") and _cache.get("WA_ACCESS_TOKEN")),
    }
