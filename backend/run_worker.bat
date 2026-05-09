@echo off
set DATABASE_URL=postgresql+asyncpg://gmbapp:gmbpass@localhost:5432/gmbdb
set REDIS_URL=redis://localhost:6379/0
set SECRET_KEY=change-this-to-a-random-secret-key-at-least-32-chars
set ACCESS_TOKEN_EXPIRE_MINUTES=60
set GOOGLE_PLACES_API_KEY=
set ANTHROPIC_API_KEY=
set FRONTEND_URL=http://localhost:3000
cd /d C:\Users\parde\gmb-marketing-app\backend
python -m celery -A app.workers.celery_app worker --loglevel=info --pool=solo
