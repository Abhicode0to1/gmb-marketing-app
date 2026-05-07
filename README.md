# GMB Marketing Automation

A full-stack application that extracts leads from Google My Business in bulk and runs automated email + WhatsApp marketing campaigns to sell web design services.

## Architecture

| Layer | Technology |
|---|---|
| Backend API | FastAPI (Python 3.11) |
| Task Queue | Celery + Redis |
| Database | PostgreSQL 15 |
| Frontend | React 18 + Vite + Tailwind CSS |
| Email | SendGrid |
| WhatsApp | Twilio WhatsApp Business API |
| GMB Data | Google Places API |

## Features

- **GMB Bulk Extractor** — Enter a keyword + city and bulk-extract businesses from Google Maps with real-time progress
- **Lead Scoring** — Auto-scores each lead (0-100) based on website presence, ratings, review count, and category
- **Email Campaigns** — Personalized HTML emails via SendGrid with open/click/reply tracking
- **WhatsApp Campaigns** — Automated WhatsApp outreach via Twilio Business API
- **Multi-step Follow-ups** — Automatic follow-up messages on configurable days (e.g. day 1, 3, 7) if no reply
- **Kanban Pipeline** — Drag-and-drop lead pipeline: New → Contacted → Interested → Negotiating → Converted
- **Unified Inbox** — All email + WhatsApp replies in one place, sales team can reply directly
- **Analytics Dashboard** — Conversion funnel, email open rates, top cities/categories

## Quick Start

### 1. Copy environment config

```bash
cd backend
cp .env.example .env
# Edit .env and fill in your API keys
```

### 2. Start all services

```bash
docker-compose up --build
```

Services will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### 3. Run database migrations

```bash
docker-compose exec backend alembic upgrade head
```

### 4. Create your first user account

```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@yourcompany.com", "full_name": "Admin", "password": "yourpassword"}'
```

## API Keys Required

### Google Places API
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable **Places API**
3. Create an API key → set in `GOOGLE_PLACES_API_KEY`

### SendGrid
1. Sign up at [SendGrid](https://sendgrid.com) (free tier: 100 emails/day)
2. Create API key with **Mail Send** permissions → set in `SENDGRID_API_KEY`
3. Set `SENDGRID_FROM_EMAIL` to a verified sender email
4. Configure **Event Webhook** in SendGrid dashboard → point to `https://yourdomain.com/webhooks/sendgrid`

### Twilio WhatsApp
1. Sign up at [Twilio](https://www.twilio.com)
2. Get Account SID and Auth Token → set in `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`
3. For production: Apply for WhatsApp Business API and get a number
4. For testing: Use Twilio WhatsApp Sandbox at `+14155238886`
5. Configure webhook in Twilio console → `https://yourdomain.com/webhooks/whatsapp`

## How It Works

### Lead Extraction Flow
1. Open **GMB Extractor** page
2. Enter business keyword (e.g. "restaurant") + city (e.g. "Mumbai")
3. Click **Start Extraction** — watches real-time progress
4. Leads are auto-scored and saved to database
5. View + filter leads in the **Leads** page

### Outreach Flow
1. Go to **Campaigns** → create a new campaign using the wizard
2. Set target filters (city, category, min score, no-website-only)
3. Customize email and WhatsApp templates with `{business_name}`, `{city}` tokens
4. Configure follow-up schedule (e.g. day 1, 3, 7)
5. **Launch** the campaign
6. Celery worker sends messages to all matching leads
7. Every day at 9am, follow-ups are automatically sent to non-responders

### Sales Team Flow
1. When a lead replies (email or WhatsApp), webhook auto-detects it
2. Lead is moved to **Interested** status
3. Sales team sees it in the **Inbox**
4. Replies directly from the inbox
5. Moves lead through **Pipeline**: Interested → Negotiating → Converted

## Development (without Docker)

```bash
# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload

# Celery worker (separate terminal)
celery -A app.workers.celery_app worker --loglevel=info

# Frontend
cd frontend
npm install
npm run dev
```

## Personalization Tokens

Use these in email/WhatsApp templates:

| Token | Replaced With |
|---|---|
| `{business_name}` | Business name |
| `{city}` | City name |
| `{category}` | Business category |
| `{phone}` | Business phone |
| `{website}` | Website URL or "none" |
