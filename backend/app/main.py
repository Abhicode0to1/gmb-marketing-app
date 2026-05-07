from urllib.parse import urlparse

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import analytics, auth, campaigns, inbox, leads, templates, webhooks
from app.config import settings

app = FastAPI(title="GMB Marketing Automation", version="1.0.0", docs_url="/docs", redoc_url="/redoc")

_parsed = urlparse(settings.FRONTEND_URL)
_origins = [
    settings.FRONTEND_URL,
    f"{_parsed.scheme}://{_parsed.hostname}",       # port 80 (nginx)
    f"{_parsed.scheme}://{_parsed.hostname}:80",
    "http://localhost:3000",
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(leads.router)
app.include_router(campaigns.router)
app.include_router(inbox.router)
app.include_router(analytics.router)
app.include_router(templates.router)
app.include_router(webhooks.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
