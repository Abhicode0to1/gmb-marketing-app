#!/bin/sh
set -e

alembic upgrade head

celery -A app.workers.celery_app worker --loglevel=info --concurrency=2 --detach --pidfile=/tmp/celery-worker.pid --logfile=/tmp/celery-worker.log
celery -A app.workers.celery_app beat --loglevel=info --detach --pidfile=/tmp/celery-beat.pid --logfile=/tmp/celery-beat.log

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
