"""
Detects whether a business uses a personal email (Gmail/Yahoo) vs corporate domain email.
Uses DNS MX record lookup when no email is directly available.
"""
import asyncio
from urllib.parse import urlparse

FREE_EMAIL_DOMAINS = {
    "gmail.com", "yahoo.com", "yahoo.in", "yahoo.co.in",
    "hotmail.com", "outlook.com", "live.com", "msn.com",
    "rediffmail.com", "ymail.com", "icloud.com", "aol.com",
    "protonmail.com", "pm.me",
}

_PERSONAL_MX_PATTERNS = [
    "google.com", "googlemail.com", "yahoo.com",
    "outlook.com", "hotmail.com", "live.com",
]


async def check_corporate_email(website_url: str | None, lead_email: str | None) -> bool | None:
    """
    Returns True=corporate domain email, False=personal/Gmail, None=unknown.
    Checks lead_email domain first; falls back to website domain MX lookup.
    """
    if lead_email and "@" in lead_email:
        domain = lead_email.split("@")[-1].lower().strip()
        return domain not in FREE_EMAIL_DOMAINS

    if not website_url:
        return False  # No website → almost certainly using personal email

    try:
        domain = urlparse(website_url).netloc.lower().lstrip("www.")
        if not domain:
            return None

        mx_records = await asyncio.to_thread(_resolve_mx, domain)
        if mx_records is None:
            return None

        for mx in mx_records:
            mx_lower = str(mx).lower()
            if any(p in mx_lower for p in _PERSONAL_MX_PATTERNS):
                return False  # Business routes email through Google/Yahoo → personal

        return True  # Custom MX records → corporate email setup

    except Exception:
        return None


def _resolve_mx(domain: str) -> list[str] | None:
    try:
        import dns.resolver
        answers = dns.resolver.resolve(domain, "MX", lifetime=5)
        return [str(r.exchange) for r in answers]
    except Exception:
        return None
