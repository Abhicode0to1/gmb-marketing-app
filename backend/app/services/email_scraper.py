"""
Scrapes contact email addresses from business websites.
Checks the main page + common contact pages for mailto links and email patterns.
"""
import re
from urllib.parse import urlparse

import httpx

_EMAIL_RE = re.compile(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}')
_MAILTO_RE = re.compile(r'mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})', re.IGNORECASE)

_SKIP_PATTERNS = [
    "example.com", "yoursite", "domain.com", "wixpress.com",
    "squarespace.com", "wordpress.com", "sentry.io", "schema.org",
    "w3.org", "googleapis.com", "gstatic.com",
]

_FREE_DOMAINS = {
    "gmail.com", "yahoo.com", "yahoo.in", "hotmail.com",
    "outlook.com", "rediffmail.com", "ymail.com", "icloud.com",
}

_CONTACT_PATHS = ["/contact", "/contact-us", "/about", "/about-us", "/reach-us", "/get-in-touch"]

_PRIORITY_PREFIXES = ["info", "contact", "hello", "enquiry", "enquiries", "sales", "support", "admin"]


def _extract_emails(html: str) -> list[str]:
    emails: set[str] = set()

    for m in _MAILTO_RE.findall(html):
        emails.add(m.lower())

    for m in _EMAIL_RE.findall(html):
        emails.add(m.lower())

    clean = []
    for e in emails:
        if any(p in e for p in _SKIP_PATTERNS):
            continue
        parts = e.split("@")
        if len(parts) == 2 and "." in parts[1] and len(parts[1]) > 3:
            clean.append(e)
    return clean


def _best_email(emails: list[str]) -> str | None:
    if not emails:
        return None
    corporate = [e for e in emails if e.split("@")[1] not in _FREE_DOMAINS]
    free_pool = [e for e in emails if e.split("@")[1] in _FREE_DOMAINS]
    for pool in (corporate, free_pool):
        for prefix in _PRIORITY_PREFIXES:
            for e in pool:
                if e.split("@")[0].startswith(prefix):
                    return e
        if pool:
            return pool[0]
    return emails[0]


async def _fetch_emails(client: httpx.AsyncClient, url: str) -> list[str]:
    try:
        resp = await client.get(url, timeout=6)
        if resp.is_success:
            return _extract_emails(resp.text)
    except Exception:
        pass
    return []


async def scrape_website_email(url: str) -> str | None:
    """
    Scrapes the website for a contact email. Returns None if none found.
    Tries the homepage first, then common contact/about pages.
    """
    try:
        parsed = urlparse(url)
        base = f"{parsed.scheme}://{parsed.netloc}"

        async with httpx.AsyncClient(
            timeout=8,
            follow_redirects=True,
            verify=False,
            headers={"User-Agent": "Mozilla/5.0 (compatible; ContactScraper/1.0)"},
        ) as client:
            # Homepage first
            emails = await _fetch_emails(client, url)
            if emails:
                return _best_email(emails)

            # Try contact/about pages
            for path in _CONTACT_PATHS:
                emails = await _fetch_emails(client, base + path)
                if emails:
                    return _best_email(emails)

    except Exception:
        pass
    return None
