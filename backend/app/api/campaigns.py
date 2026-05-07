import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.database import get_db
from app.models.campaign import Campaign, CampaignStatus, CampaignType
from app.models.user import User

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


class CampaignCreate(BaseModel):
    name: str
    type: CampaignType = CampaignType.both
    email_subject: str | None = None
    email_template_html: str | None = None
    whatsapp_template: str | None = None
    follow_up_days: list[int] = [1, 3, 7]
    target_filters: dict = {}


class CampaignOut(BaseModel):
    id: uuid.UUID
    name: str
    type: str
    status: str
    email_subject: str | None
    whatsapp_template: str | None
    follow_up_days: list
    target_filters: dict
    launched_at: str | None

    class Config:
        from_attributes = True


@router.get("", response_model=list[CampaignOut])
async def list_campaigns(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(Campaign).order_by(Campaign.launched_at.desc().nullslast()))
    return [CampaignOut.model_validate(c) for c in result.scalars().all()]


@router.post("", response_model=CampaignOut, status_code=201)
async def create_campaign(body: CampaignCreate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    campaign = Campaign(**body.model_dump())
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return CampaignOut.model_validate(campaign)


@router.get("/{campaign_id}", response_model=CampaignOut)
async def get_campaign(campaign_id: uuid.UUID, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    campaign = await db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    return CampaignOut.model_validate(campaign)


@router.put("/{campaign_id}", response_model=CampaignOut)
async def update_campaign(
    campaign_id: uuid.UUID,
    body: CampaignCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    campaign = await db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    if campaign.status == CampaignStatus.active:
        raise HTTPException(400, "Cannot edit an active campaign")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(campaign, field, value)
    await db.commit()
    await db.refresh(campaign)
    return CampaignOut.model_validate(campaign)


@router.post("/{campaign_id}/launch")
async def launch_campaign(campaign_id: uuid.UUID, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    campaign = await db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    if campaign.status != CampaignStatus.draft:
        raise HTTPException(400, "Only draft campaigns can be launched")

    from app.workers.outreach_tasks import launch_campaign_task
    launch_campaign_task.delay(str(campaign_id))
    return {"message": f"Campaign '{campaign.name}' is being launched", "campaign_id": str(campaign_id)}


@router.post("/{campaign_id}/pause")
async def pause_campaign(campaign_id: uuid.UUID, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    campaign = await db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    campaign.status = CampaignStatus.paused
    await db.commit()
    return {"message": "Campaign paused"}


@router.get("/{campaign_id}/audience-count")
async def audience_count(campaign_id: uuid.UUID, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    """Preview how many leads a campaign will target before launching."""
    campaign = await db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    from app.services.campaign_manager import get_campaign_leads
    leads = await get_campaign_leads(db, campaign)
    return {"audience_count": len(leads)}
