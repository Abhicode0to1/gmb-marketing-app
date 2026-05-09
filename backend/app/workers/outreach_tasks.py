"""
Celery tasks for campaign outreach + follow-up scheduling.
"""
import asyncio

from app.workers.celery_app import celery_app


@celery_app.task(name="app.workers.outreach_tasks.launch_campaign_task")
def launch_campaign_task(campaign_id: str):
    from app.database import AsyncSessionLocal
    from app.services.campaign_manager import launch_campaign
    from app.services.settings_service import refresh_cache

    async def _run():
        async with AsyncSessionLocal() as db:
            await refresh_cache(db)
            return await launch_campaign(db, campaign_id)

    return asyncio.run(_run())


@celery_app.task(name="app.workers.outreach_tasks.process_followups_task")
def process_followups_task():
    from app.database import AsyncSessionLocal
    from app.services.campaign_manager import process_followups
    from app.services.settings_service import refresh_cache

    async def _run():
        async with AsyncSessionLocal() as db:
            await refresh_cache(db)
            return await process_followups(db)

    return asyncio.run(_run())
