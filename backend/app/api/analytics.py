from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.database import get_db
from app.models.lead import Lead, LeadStatus
from app.models.message import Message, MessageChannel, MessageStatus
from app.models.user import User

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview")
async def overview(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    total_leads = await db.scalar(select(func.count(Lead.id)))
    contacted = await db.scalar(select(func.count(Lead.id)).where(Lead.status == LeadStatus.contacted))
    interested = await db.scalar(select(func.count(Lead.id)).where(Lead.status == LeadStatus.interested))
    converted = await db.scalar(select(func.count(Lead.id)).where(Lead.status == LeadStatus.converted))
    total_emails = await db.scalar(select(func.count(Message.id)).where(Message.channel == MessageChannel.email))
    emails_opened = await db.scalar(
        select(func.count(Message.id)).where(
            Message.channel == MessageChannel.email, Message.status == MessageStatus.opened
        )
    )
    total_wa = await db.scalar(select(func.count(Message.id)).where(Message.channel == MessageChannel.whatsapp))

    conversion_rate = round((converted / total_leads * 100), 1) if total_leads else 0
    email_open_rate = round((emails_opened / total_emails * 100), 1) if total_emails else 0

    return {
        "total_leads": total_leads,
        "contacted": contacted,
        "interested": interested,
        "converted": converted,
        "conversion_rate": conversion_rate,
        "total_emails_sent": total_emails,
        "email_open_rate": email_open_rate,
        "total_whatsapp_sent": total_wa,
    }


@router.get("/pipeline")
async def pipeline_stats(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    """Count of leads per pipeline stage."""
    result = await db.execute(
        select(Lead.status, func.count(Lead.id).label("count")).group_by(Lead.status)
    )
    return {row.status: row.count for row in result.fetchall()}


@router.get("/top-cities")
async def top_cities(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(
        select(Lead.city, func.count(Lead.id).label("count"))
        .where(Lead.city.isnot(None))
        .group_by(Lead.city)
        .order_by(func.count(Lead.id).desc())
        .limit(10)
    )
    return [{"city": row.city, "count": row.count} for row in result.fetchall()]


@router.get("/top-categories")
async def top_categories(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(
        select(Lead.category, func.count(Lead.id).label("count"))
        .where(Lead.category.isnot(None))
        .group_by(Lead.category)
        .order_by(func.count(Lead.id).desc())
        .limit(10)
    )
    return [{"category": row.category, "count": row.count} for row in result.fetchall()]
