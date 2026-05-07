from celery import Celery
from celery.schedules import crontab

from app.config import settings

celery_app = Celery(
    "gmb_marketing",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.workers.extraction_tasks", "app.workers.outreach_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "process-followups-daily": {
            "task": "app.workers.outreach_tasks.process_followups_task",
            "schedule": crontab(hour=9, minute=0),  # Run every day at 9am UTC
        },
    },
)
