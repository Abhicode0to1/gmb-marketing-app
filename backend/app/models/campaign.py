import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, JSON, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CampaignType(str, Enum):
    email = "EMAIL"
    whatsapp = "WHATSAPP"
    both = "BOTH"


class CampaignStatus(str, Enum):
    draft = "draft"
    active = "active"
    paused = "paused"
    completed = "completed"


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[CampaignType] = mapped_column(String(20), default=CampaignType.both)
    status: Mapped[CampaignStatus] = mapped_column(String(20), default=CampaignStatus.draft, index=True)
    email_subject: Mapped[str | None] = mapped_column(String(500))
    email_template_html: Mapped[str | None] = mapped_column(Text)
    whatsapp_template: Mapped[str | None] = mapped_column(Text)
    # [1, 3, 7] — days after initial contact to send follow-ups
    follow_up_days: Mapped[list] = mapped_column(JSON, default=lambda: [1, 3, 7])
    # {"city": "Mumbai", "category": "restaurant", "min_score": 60, "no_website_only": true}
    target_filters: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    launched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    messages = relationship("Message", back_populates="campaign")
