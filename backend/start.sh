#!/bin/sh
set -e

echo "=== Running alembic migrations ==="
alembic upgrade head

echo "=== Starting Celery worker ==="
celery -A app.workers.celery_app worker --loglevel=info --concurrency=2 &
WORKER_PID=$!

echo "=== Starting Celery beat ==="
celery -A app.workers.celery_app beat --loglevel=info &
BEAT_PID=$!

echo "=== Starting uvicorn (PID will be main process) ==="
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
