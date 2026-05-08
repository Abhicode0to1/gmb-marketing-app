"""
Celery tasks for GMB bulk extraction.
Progress is stored in a Redis list so SSE clients can replay missed events.
"""
import asyncio
import json

import redis as redis_sync

from app.config import settings
from app.workers.celery_app import celery_app

EVENTS_TTL = 3600


def _get_redis():
    return redis_sync.from_url(settings.REDIS_URL)


def _push(r, list_key: str, payload: dict):
    r.rpush(list_key, json.dumps(payload))
    r.expire(list_key, EVENTS_TTL)


@celery_app.task(bind=True, name="app.workers.extraction_tasks.extract_leads_task")
def extract_leads_task(self, keyword: str, city: str, radius_km: int, max_results: int, job_id: str, no_website_only: bool = False):
    from app.database import AsyncSessionLocal
    from app.services.gmb_extractor import extract_leads

    r = _get_redis()
    list_key = f"extraction_events:{job_id}"

    async def _run():
        new_count = 0
        duplicate_count = 0
        actual_total = 0

        async with AsyncSessionLocal() as db:
            async for progress in extract_leads(db, keyword, city, radius_km, max_results, no_website_only):
                lead = progress.get("lead")
                actual_total = progress["total"]
                status = progress["status"]

                if status == "created":
                    new_count += 1
                elif status in ("duplicate", "skipped"):
                    duplicate_count += 1

                payload = {
                    "processed": progress["processed"],
                    "total": actual_total,
                    "status": status,
                    "lead_name": lead.business_name if lead else None,
                    "lead_score": lead.lead_score if lead else None,
                    "website_status": lead.website_status if lead else None,
                    "service_needs": lead.service_needs if lead else [],
                }
                _push(r, list_key, payload)

        _push(r, list_key, {
            "done": True,
            "processed": actual_total,
            "total": actual_total,
            "new_count": new_count,
            "duplicate_count": duplicate_count,
        })

    asyncio.run(_run())
    return {"job_id": job_id, "status": "completed"}
