"""
Celery tasks for GMB bulk extraction.
Progress is published to Redis so the frontend can poll it via SSE.
"""
import asyncio
import json
import uuid

import redis as redis_sync

from app.config import settings
from app.workers.celery_app import celery_app


def _get_redis():
    return redis_sync.from_url(settings.REDIS_URL)


@celery_app.task(bind=True, name="app.workers.extraction_tasks.extract_leads_task")
def extract_leads_task(self, keyword: str, city: str, radius_km: int, max_results: int, job_id: str):
    """
    Runs the GMB extraction in an async event loop and publishes
    progress updates to Redis channel: extraction:{job_id}
    """
    from app.database import AsyncSessionLocal
    from app.services.gmb_extractor import extract_leads

    r = _get_redis()
    channel = f"extraction:{job_id}"

    async def _run():
        async with AsyncSessionLocal() as db:
            async for progress in extract_leads(db, keyword, city, radius_km, max_results):
                lead = progress.get("lead")
                payload = {
                    "processed": progress["processed"],
                    "total": progress["total"],
                    "status": progress["status"],
                    "lead_name": lead.business_name if lead else None,
                    "lead_score": lead.lead_score if lead else None,
                }
                r.publish(channel, json.dumps(payload))

        r.publish(channel, json.dumps({"done": True, "processed": max_results, "total": max_results}))

    asyncio.run(_run())
    return {"job_id": job_id, "status": "completed"}
