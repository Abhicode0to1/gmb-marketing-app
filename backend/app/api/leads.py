import asyncio
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.database import get_db
from app.models.lead import Lead, LeadStatus
from app.models.user import User

router = APIRouter(prefix="/leads", tags=["leads"])


class LeadUpdate(BaseModel):
    status: LeadStatus | None = None
    notes: str | None = None
    assigned_to: uuid.UUID | None = None


class LeadOut(BaseModel):
    id: uuid.UUID
    business_name: str
    phone: str | None
    email: str | None
    website: str | None
    has_website: bool
    city: str | None
    state: str | None
    category: str | None
    rating: float | None
    review_count: int | None
    lead_score: int
    status: str
    notes: str | None
    assigned_to: uuid.UUID | None

    class Config:
        from_attributes = True


@router.get("", response_model=dict)
async def list_leads(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = None,
    city: str | None = None,
    category: str | None = None,
    min_score: int | None = None,
    no_website_only: bool = False,
    search: str | None = None,
):
    query = select(Lead)

    if status:
        query = query.where(Lead.status == status)
    if city:
        query = query.where(Lead.city.ilike(f"%{city}%"))
    if category:
        query = query.where(Lead.category.ilike(f"%{category}%"))
    if min_score is not None:
        query = query.where(Lead.lead_score >= min_score)
    if no_website_only:
        query = query.where(Lead.has_website == False)  # noqa: E712
    if search:
        query = query.where(Lead.business_name.ilike(f"%{search}%"))

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()

    query = query.order_by(Lead.lead_score.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    leads = result.scalars().all()

    return {"total": total, "page": page, "page_size": page_size, "leads": [LeadOut.model_validate(l) for l in leads]}


@router.get("/{lead_id}", response_model=LeadOut)
async def get_lead(lead_id: uuid.UUID, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    lead = await db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    return LeadOut.model_validate(lead)


@router.patch("/{lead_id}", response_model=LeadOut)
async def update_lead(
    lead_id: uuid.UUID,
    body: LeadUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    lead = await db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    if body.status is not None:
        lead.status = body.status
    if body.notes is not None:
        lead.notes = body.notes
    if body.assigned_to is not None:
        lead.assigned_to = body.assigned_to
    await db.commit()
    await db.refresh(lead)
    return LeadOut.model_validate(lead)


@router.post("/extract")
async def start_extraction(
    keyword: str,
    city: str,
    radius_km: int = 10,
    max_results: int = 100,
    _: User = Depends(get_current_user),
):
    import uuid as _uuid
    from app.workers.extraction_tasks import extract_leads_task

    job_id = str(_uuid.uuid4())
    extract_leads_task.delay(keyword, city, radius_km, min(max_results, 500), job_id)
    return {"job_id": job_id, "message": f"Extraction started for '{keyword}' in {city}"}


@router.get("/extract/progress/{job_id}")
async def extraction_progress(
    job_id: str,
    token: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Server-Sent Events stream for extraction progress.
    Accepts token via query param because EventSource cannot send headers.
    """
    import json
    from fastapi.responses import StreamingResponse
    import redis.asyncio as aioredis
    from app.config import settings
    from app.services.auth_service import decode_token

    if not token:
        raise HTTPException(status_code=401, detail="Token required")
    payload = decode_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")

    async def event_stream():
        r = aioredis.from_url(settings.REDIS_URL)
        list_key = f"extraction_events:{job_id}"
        idx = 0
        timeout = 300  # 5 min max
        waited = 0
        try:
            while waited < timeout:
                items = await r.lrange(list_key, idx, -1)
                if items:
                    for item in items:
                        data = item.decode()
                        yield f"data: {data}\n\n"
                        idx += 1
                        if json.loads(data).get("done"):
                            return
                else:
                    await asyncio.sleep(0.5)
                    waited += 0.5
        finally:
            await r.aclose()

    return StreamingResponse(event_stream(), media_type="text/event-stream")
