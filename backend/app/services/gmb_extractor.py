"""
Google My Business (Places API) bulk extractor.
Fetches businesses by keyword + city, scores them, and stores in DB.
"""
import asyncio
from typing import AsyncGenerator

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.lead import Lead, LeadStatus
from app.services.lead_scorer import score_lead

PLACES_TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
PLACES_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"

DETAIL_FIELDS = "name,formatted_phone_number,website,formatted_address,rating,user_ratings_total,types,place_id"


async def fetch_place_ids(client: httpx.AsyncClient, keyword: str, city: str, radius_m: int) -> list[dict]:
    """Return list of {place_id, name, rating, user_ratings_total, types} from text search."""
    results = []
    query = f"{keyword} in {city}"
    params = {
        "query": query,
        "radius": radius_m,
        "key": settings.GOOGLE_PLACES_API_KEY,
    }
    while True:
        resp = await client.get(PLACES_TEXT_SEARCH_URL, params=params)
        resp.raise_for_status()
        data = resp.json()
        results.extend(data.get("results", []))
        next_page = data.get("next_page_token")
        if not next_page:
            break
        params = {"pagetoken": next_page, "key": settings.GOOGLE_PLACES_API_KEY}
        await asyncio.sleep(2)  # Google requires a short delay before using next_page_token
    return results


async def fetch_place_details(client: httpx.AsyncClient, place_id: str) -> dict:
    """Fetch detailed info (phone, website, address) for a single place."""
    resp = await client.get(
        PLACES_DETAILS_URL,
        params={"place_id": place_id, "fields": DETAIL_FIELDS, "key": settings.GOOGLE_PLACES_API_KEY},
    )
    resp.raise_for_status()
    return resp.json().get("result", {})


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
    radius_m = radius_km * 1000

    async with httpx.AsyncClient(timeout=30) as client:
        raw_results = await fetch_place_ids(client, keyword, city, radius_m)
        raw_results = raw_results[:max_results]
        total = len(raw_results)

        for idx, result in enumerate(raw_results):
            place_id = result.get("place_id")
            if not place_id:
                continue

            # Skip if already in DB
            from sqlalchemy import select
            existing = await db.scalar(select(Lead).where(Lead.google_place_id == place_id))
            if existing:
                yield {"processed": idx + 1, "total": total, "lead": None, "status": "duplicate"}
                continue

            details = await fetch_place_details(client, place_id)
            website = details.get("website")
            has_website = bool(website)
            rating = details.get("rating") or result.get("rating")
            review_count = details.get("user_ratings_total") or result.get("user_ratings_total")
            types = details.get("types") or result.get("types", [])
            category = types[0].replace("_", " ") if types else None
            formatted_address = details.get("formatted_address")
            city_val, state_val = _extract_city_state(formatted_address)

            lead_score = score_lead(has_website, rating, review_count, category)

            lead = Lead(
                business_name=details.get("name") or result.get("name", ""),
                phone=details.get("formatted_phone_number"),
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

            # Respect Google API rate limits
            await asyncio.sleep(0.1)
