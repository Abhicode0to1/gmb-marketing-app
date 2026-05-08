"""
Analyzes a business website to determine its quality and what services it needs.
Detects: broken sites, outdated/non-responsive sites, free site builders.
"""
import re
import asyncio
from dataclasses import dataclass, field
from datetime import datetime

import httpx

_CURRENT_YEAR = datetime.now().year
_OLD_YEAR_THRESHOLD = _CURRENT_YEAR - 3  # sites with copyright older than 3 years

_FREE_BUILDER_MARKERS = [
    "wix.com", "squarespace.com", "weebly.com", "jimdo.com",
    "site123.com", "strikingly.com", "webnode.com", "godaddy.com/website",
]


@dataclass
class WebsiteAnalysis:
    url: str
    status: str = "alive"  # 'alive' | 'broken' | 'old' | 'social_only'
    http_code: int | None = None
    has_ssl: bool = False
    copyright_year: int | None = None
    has_viewport: bool = True
    has_flash: bool = False
    is_free_builder: bool = False
    service_needs: list = field(default_factory=list)


async def analyze_website(url: str) -> WebsiteAnalysis:
    analysis = WebsiteAnalysis(url=url)
    analysis.has_ssl = url.lower().startswith("https")

    try:
        async with httpx.AsyncClient(
            timeout=5.0,
            verify=False,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; LeadBot/1.0)"},
        ) as client:
            resp = await client.get(url)
            analysis.http_code = resp.status_code

            if resp.status_code >= 400:
                analysis.status = "broken"
                analysis.service_needs = ["redesign"]
                return analysis

            html = resp.text.lower()

            # Copyright year detection
            year_match = re.search(r"©\s*(\d{4})|copyright\s+(\d{4})", html)
            if year_match:
                year_str = year_match.group(1) or year_match.group(2)
                analysis.copyright_year = int(year_str)

            # Mobile responsiveness
            analysis.has_viewport = 'name="viewport"' in html

            # Flash (obsolete technology)
            analysis.has_flash = ".swf" in html or ("<embed" in html and "flash" in html)

            # Free site builder
            analysis.is_free_builder = any(m in html for m in _FREE_BUILDER_MARKERS)

            is_old = (
                (analysis.copyright_year is not None and analysis.copyright_year <= _OLD_YEAR_THRESHOLD)
                or not analysis.has_viewport
                or analysis.has_flash
                or analysis.is_free_builder
            )

            if is_old:
                analysis.status = "old"
                analysis.service_needs = ["redesign"]
            else:
                analysis.status = "alive"
                analysis.service_needs = []

    except (httpx.ConnectError, httpx.TimeoutException, httpx.TooManyRedirects, httpx.InvalidURL):
        analysis.status = "broken"
        analysis.service_needs = ["redesign"]
    except Exception:
        analysis.status = "alive"
        analysis.service_needs = []

    return analysis
