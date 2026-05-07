from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/templates", tags=["templates"])


class GenerateRequest(BaseModel):
    business_category: str
    city: str
    service_offered: str = "professional website design"
    tone: str = "friendly"
    language: str = "English"
    extra_offer: str = ""


@router.post("/generate")
async def generate_templates(body: GenerateRequest, _: User = Depends(get_current_user)):
    from app.config import settings

    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(400, "ANTHROPIC_API_KEY is not configured")

    try:
        from app.services.template_generator import generate_templates as _gen
        result = _gen(
            business_category=body.business_category,
            city=body.city,
            service_offered=body.service_offered,
            tone=body.tone,
            language=body.language,
            extra_offer=body.extra_offer,
        )
        return result
    except Exception as e:
        raise HTTPException(500, f"Template generation failed: {str(e)}")
