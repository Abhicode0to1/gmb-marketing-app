"""
Google Places API (New) bulk extractor.
Uses the Places API (New) which supports newer API keys.
"""
import asyncio
from typing import AsyncGenerator

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.lead import Lead, LeadStatus
from app.services.lead_scorer import score_lead

PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
PLACES_FIELD_MASK = (
    "places.id,places.displayName,places.formattedAddress,"
    "places.nationalPhoneNumber,places.internationalPhoneNumber,"
    "places.websiteUri,places.rating,places.userRatingCount,places.types"
)


async def fetch_places(
    client: httpx.AsyncClient, keyword: str, city: str, max_results: int
) -> list[dict]:
    """Return list of place dicts from Places API (New) text search."""
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
) -> AsyncGenerator[dict, None]:
    """
    Generator that yields progress dicts as leads are extracted.
    Each yield: {"processed": int, "total": int, "lead": Lead | None, "status": str}
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

            name = place.get("displayName", {}).get("text", "")
            phone = place.get("nationalPhoneNumber") or place.get("internationalPhoneNumber")
            website = place.get("websiteUri")
            has_website = bool(website)
            rating = place.get("rating")
            review_count = place.get("userRatingCount")
            types = place.get("types", [])
            category = types[0].replace("_", " ") if types else None
            formatted_address = place.get("formattedAddress")
            city_val, state_val = _extract_city_state(formatted_address)

            lead_score = score_lead(has_website, rating, review_count, category)

            lead = Lead(
                business_name=name,
                phone=phone,
                website=website,
                has_website=has_website,
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
            )
            db.add(lead)
            await db.commit()
            await db.refresh(lead)

            yield {"processed": idx + 1, "total": total, "lead": lead, "status": "created"}

            await asyncio.sleep(0.05)
