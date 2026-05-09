"""
Google Places API (New) bulk extractor.
Targets businesses with no real website (primary) and social-media-only presence (secondary).
"""
import asyncio
from typing import AsyncGenerator
from urllib.parse import urlparse

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.lead import Lead, LeadStatus
from app.services.lead_scorer import score_lead
from app.services.website_analyzer import WebsiteAnalysis, analyze_website
from app.services.email_checker import check_corporate_email
from app.services.email_scraper import scrape_website_email

PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
PLACES_FIELD_MASK = (
    "places.id,places.displayName,places.formattedAddress,"
    "places.nationalPhoneNumber,places.internationalPhoneNumber,"
    "places.websiteUri,places.rating,places.userRatingCount,places.types,"
    "nextPageToken"
)

# Businesses using these as their "website" don't have a real web presence
SOCIAL_DOMAINS = {
    "facebook.com", "fb.com", "instagram.com", "twitter.com", "x.com",
    "linkedin.com", "youtube.com", "tiktok.com", "snapchat.com",
    "wa.me", "whatsapp.com", "linktr.ee", "linktree.com",
    "g.co", "goo.gl", "maps.google.com",
}


def classify_website(url: str | None) -> tuple[bool, bool]:
    """
    Returns (has_real_website, is_social_only).
    has_real_website = True  → they have a proper domain
    is_social_only   = True  → their only online presence is a social media link
    """
    if not url:
        return False, False
    try:
        domain = urlparse(url).netloc.lower().lstrip("www.")
        if any(sd in domain for sd in SOCIAL_DOMAINS):
            return False, True   # social link counts as no real website
        return True, False
    except Exception:
        return False, False


def build_notes(has_real_website: bool, is_social_only: bool, website: str | None) -> str | None:
    if not has_real_website and not is_social_only:
        return "No website — almost certainly using a personal email (Gmail/Yahoo). High-value web design prospect."
    if is_social_only:
        return f"No real website (only {website}) — likely using personal email. Good redesign prospect."
    return None


async def fetch_places(
    client: httpx.AsyncClient, keyword: str, city: str, max_results: int
) -> list[dict]:
    results = []
    query = f"{keyword} in {city}"
    headers = {
        "X-Goog-Api-Key": settings.GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": PLACES_FIELD_MASK,
        "Content-Type": "application/json",
    }

    page_token = None
    while len(results) < max_results:
        batch = min(20, max_results - len(results))
        body: dict = {"textQuery": query, "maxResultCount": batch}
        if page_token:
            body["pageToken"] = page_token

        resp = await client.post(PLACES_SEARCH_URL, headers=headers, json=body)
        resp.raise_for_status()
        data = resp.json()

        places = data.get("places", [])
        results.extend(places)

        page_token = data.get("nextPageToken")
        if not page_token or not places:
            break

        await asyncio.sleep(1)

    return results[:max_results]


def _extract_city_state(formatted_address: str | None) -> tuple[str | None, str | None]:
    if not formatted_address:
        return None, None
    parts = [p.strip() for p in formatted_address.split(",")]
    city = parts[-3] if len(parts) >= 3 else (parts[0] if parts else None)
    state = parts[-2].split()[0] if len(parts) >= 2 else None
    return city, state


async def extract_leads(
    db: AsyncSession,
    keyword: str,
    city: str,
    radius_km: int = 10,
    max_results: int = 100,
    no_website_only: bool = False,
) -> AsyncGenerator[dict, None]:
    """
    Yields progress dicts as leads are extracted.
    When no_website_only=True, skips businesses that have a real website.
    """
    from sqlalchemy import select

    async with httpx.AsyncClient(timeout=30) as client:
        raw_results = await fetch_places(client, keyword, city, max_results)
        total = len(raw_results)

        for idx, place in enumerate(raw_results):
            place_id = place.get("id")
            if not place_id:
                continue

            existing = await db.scalar(select(Lead).where(Lead.google_place_id == place_id))
            if existing:
                yield {"processed": idx + 1, "total": total, "lead": None, "status": "duplicate"}
                continue

            raw_website = place.get("websiteUri")
            has_real_website, is_social_only = classify_website(raw_website)

            # Skip businesses with real websites when filter is active
            if no_website_only and has_real_website:
                yield {"processed": idx + 1, "total": total, "lead": None, "status": "skipped"}
                continue

            name = place.get("displayName", {}).get("text", "")
            phone = place.get("nationalPhoneNumber") or place.get("internationalPhoneNumber")
            rating = place.get("rating")
            review_count = place.get("userRatingCount")
            types = place.get("types", [])
            category = types[0].replace("_", " ") if types else None
            formatted_address = place.get("formattedAddress")
            city_val, state_val = _extract_city_state(formatted_address)
            notes = build_notes(has_real_website, is_social_only, raw_website)

            # Concurrent: analyze website quality + detect corporate email + scrape email
            if has_real_website and raw_website:
                site_analysis, has_corp_email, scraped_email = await asyncio.gather(
                    analyze_website(raw_website),
                    check_corporate_email(raw_website, None),
                    scrape_website_email(raw_website),
                )
                website_status = site_analysis.status
                service_needs = list(site_analysis.service_needs)
                if not has_corp_email:
                    service_needs.append("corporate_email")
            else:
                website_status = "social_only" if is_social_only else "none"
                service_needs = ["new_website", "corporate_email"]
                has_corp_email = False
                scraped_email = None

            lead_score = score_lead(has_real_website, is_social_only, rating, review_count, category, website_status)

            lead = Lead(
                business_name=name,
                phone=phone,
                email=scraped_email,
                website=raw_website if has_real_website else None,
                has_website=has_real_website,
                address=formatted_address,
                city=city_val or city,
                state=state_val,
                country="IN",
                category=category,
                google_place_id=place_id,
                rating=rating,
                review_count=review_count,
                lead_score=lead_score,
                status=LeadStatus.new,
                notes=notes,
                website_status=website_status,
                service_needs=service_needs,
                has_corporate_email=has_corp_email,
            )
            db.add(lead)
            await db.commit()
            await db.refresh(lead)

            yield {"processed": idx + 1, "total": total, "lead": lead, "status": "created"}

            await asyncio.sleep(0.05)
