"""
Orchestrates multi-channel outreach sequences for campaigns.
Called by Celery workers.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign, CampaignStatus, CampaignType
from app.models.lead import Lead, LeadStatus
from app.models.message import Message, MessageChannel, MessageDirection, MessageStatus
from app.services.email_service import send_email
from app.services.whatsapp_service import send_whatsapp


async def get_campaign_leads(db: AsyncSession, campaign: Campaign) -> list[Lead]:
    """Return leads that match campaign target_filters and haven't been contacted by this campaign."""
    filters = campaign.target_filters or {}
    query = select(Lead)

    if filters.get("city"):
        query = query.where(Lead.city.ilike(f"%{filters['city']}%"))
    if filters.get("category"):
        query = query.where(Lead.category.ilike(f"%{filters['category']}%"))
    if filters.get("min_score"):
        query = query.where(Lead.lead_score >= int(filters["min_score"]))
    if filters.get("no_website_only"):
        query = query.where(Lead.has_website == False)  # noqa: E712

    result = await db.execute(query)
    leads = result.scalars().all()

    # Exclude leads already messaged by this campaign
    sent_lead_ids_result = await db.execute(
        select(Message.lead_id).where(
            and_(Message.campaign_id == campaign.id, Message.direction == MessageDirection.sent)
        )
    )
    already_sent = {row[0] for row in sent_lead_ids_result.fetchall()}

    return [lead for lead in leads if lead.id not in already_sent]


async def launch_campaign(db: AsyncSession, campaign_id: str) -> dict:
    """Send initial outreach messages to all matching leads for a campaign."""
    campaign = await db.get(Campaign, campaign_id)
    if not campaign or campaign.status != CampaignStatus.draft:
        return {"error": "Campaign not found or not in draft status"}

    campaign.status = CampaignStatus.active
    campaign.launched_at = datetime.now(timezone.utc)
    await db.commit()

    leads = await get_campaign_leads(db, campaign)
    sent_count = 0
    error_count = 0

    for lead in leads:
        try:
            if campaign.type in (CampaignType.email, CampaignType.both):
                if lead.email and campaign.email_template_html and campaign.email_subject:
                    msg = send_email(lead, campaign.email_subject, campaign.email_template_html, campaign.id)
                    db.add(msg)

            if campaign.type in (CampaignType.whatsapp, CampaignType.both):
                if lead.phone and campaign.whatsapp_template:
                    msg = send_whatsapp(lead, campaign.whatsapp_template, campaign.id)
                    db.add(msg)

            lead.status = LeadStatus.contacted
            lead.last_contacted_at = datetime.now(timezone.utc)
            sent_count += 1
        except Exception:
            error_count += 1

    await db.commit()
    return {"sent": sent_count, "errors": error_count, "total_leads": len(leads)}


async def process_followups(db: AsyncSession) -> dict:
    """
    Check active campaigns for leads that need follow-up messages.
    Called daily by Celery Beat.
    """
    result = await db.execute(select(Campaign).where(Campaign.status == CampaignStatus.active))
    campaigns = result.scalars().all()

    total_sent = 0
    now = datetime.now(timezone.utc)

    for campaign in campaigns:
        follow_up_days: list[int] = campaign.follow_up_days or [1, 3, 7]

        # Find leads in this campaign that were contacted but never replied
        contacted_result = await db.execute(
            select(Lead)
            .join(Message, and_(Message.lead_id == Lead.id, Message.campaign_id == campaign.id))
            .where(Lead.status == LeadStatus.contacted)
            .distinct()
        )
        contacted_leads = contacted_result.scalars().all()

        for lead in contacted_leads:
            if not lead.last_contacted_at:
                continue

            days_since = (now - lead.last_contacted_at).days

            # Find which follow-up step we're on
            next_followup_day = None
            for day in sorted(follow_up_days):
                if days_since >= day:
                    next_followup_day = day

            if next_followup_day is None:
                continue

            # Check if we already sent a follow-up at this step
            followup_sent = await db.scalar(
                select(Message).where(
                    and_(
                        Message.lead_id == lead.id,
                        Message.campaign_id == campaign.id,
                        Message.sent_at >= lead.last_contacted_at + timedelta(days=next_followup_day - 1),
                        Message.direction == MessageDirection.sent,
                    )
                ).limit(1)
            )
            if followup_sent:
                continue

            try:
                if campaign.type in (CampaignType.email, CampaignType.both):
                    if lead.email and campaign.email_template_html and campaign.email_subject:
                        subject = f"Follow-up: {campaign.email_subject}"
                        msg = send_email(lead, subject, campaign.email_template_html, campaign.id)
                        db.add(msg)

                if campaign.type in (CampaignType.whatsapp, CampaignType.both):
                    if lead.phone and campaign.whatsapp_template:
                        msg = send_whatsapp(lead, campaign.whatsapp_template, campaign.id)
                        db.add(msg)

                lead.last_contacted_at = now
                total_sent += 1
            except Exception:
                pass

    await db.commit()
    return {"followups_sent": total_sent}
