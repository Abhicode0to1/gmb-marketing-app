import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.database import get_db
from app.models.lead import Lead, LeadStatus
from app.models.message import Message, MessageChannel, MessageDirection, MessageStatus
from app.models.user import User
from app.services.email_service import send_email
from app.services.whatsapp_service import send_whatsapp

router = APIRouter(prefix="/inbox", tags=["inbox"])


class MessageOut(BaseModel):
    id: uuid.UUID
    lead_id: uuid.UUID
    channel: str
    direction: str
    subject: str | None
    content: str
    status: str
    sent_at: str | None
    created_at: str

    class Config:
        from_attributes = True


class SendMessageRequest(BaseModel):
    lead_id: uuid.UUID
    channel: MessageChannel
    subject: str | None = None
    content: str


@router.get("/conversations")
async def list_conversations(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    """Return one item per lead that has received or sent a message, latest message first."""
    result = await db.execute(
        select(Lead)
        .join(Message, Message.lead_id == Lead.id)
        .where(Lead.status.in_([LeadStatus.interested, LeadStatus.contacted, LeadStatus.negotiating]))
        .distinct()
        .order_by(Lead.last_contacted_at.desc().nullslast())
        .limit(100)
    )
    leads = result.scalars().all()
    return [
        {
            "lead_id": str(l.id),
            "business_name": l.business_name,
            "phone": l.phone,
            "email": l.email,
            "status": l.status,
            "last_contacted_at": l.last_contacted_at.isoformat() if l.last_contacted_at else None,
        }
        for l in leads
    ]


@router.get("/thread/{lead_id}", response_model=list[MessageOut])
async def get_thread(lead_id: uuid.UUID, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(
        select(Message).where(Message.lead_id == lead_id).order_by(Message.created_at.asc())
    )
    return [MessageOut.model_validate(m) for m in result.scalars().all()]


@router.post("/send", status_code=201)
async def send_message(body: SendMessageRequest, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    lead = await db.get(Lead, body.lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")

    try:
        if body.channel == MessageChannel.email:
            if not lead.email:
                raise HTTPException(400, "Lead has no email")
            msg = send_email(lead, body.subject or "Following up", body.content)
        else:
            if not lead.phone:
                raise HTTPException(400, "Lead has no phone")
            msg = send_whatsapp(lead, body.content)

        db.add(msg)
        await db.commit()
        await db.refresh(msg)
        return {"message_id": str(msg.id), "status": msg.status}
    except Exception as e:
        raise HTTPException(500, str(e))
