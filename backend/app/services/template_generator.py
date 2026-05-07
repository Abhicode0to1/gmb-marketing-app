"""
Uses Claude AI to generate personalized marketing email + WhatsApp templates
for web design sales outreach based on business type, city, and offer details.
"""
import anthropic

from app.config import settings

_SYSTEM_PROMPT = """You are a senior digital marketing copywriter specializing in B2B outreach for web design agencies in India.
Your job is to write compelling, personalized marketing messages that convince local business owners to invest in a professional website.
Always write in a friendly, professional tone. Messages should be specific to the business type, feel personal (not spammy), and have a clear call-to-action.
Use the exact personalization tokens {business_name} and {city} in your output — do NOT replace them with example names."""


def generate_templates(
    business_category: str,
    city: str,
    service_offered: str = "professional website design",
    tone: str = "friendly",
    language: str = "English",
    extra_offer: str = "",
) -> dict:
    """
    Generate email subject, email HTML body, and WhatsApp message using Claude.

    Returns:
        {
            "email_subject": str,
            "email_html": str,
            "whatsapp_message": str,
            "reasoning": str  # Claude's brief explanation of the approach
        }
    """
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    offer_note = f"\nSpecial offer to include: {extra_offer}" if extra_offer else ""

    prompt = f"""Generate marketing templates for web design outreach to a local business.

Business details:
- Category: {business_category}
- City: {city}
- Service we're selling: {service_offered}
- Tone: {tone}
- Language: {language}{offer_note}

Please generate all three of the following. Use {{business_name}} and {{city}} as personalization tokens — they will be auto-replaced before sending.

---

1. EMAIL SUBJECT LINE
Write one compelling subject line (max 60 chars). Make it curiosity-driven or benefit-focused. Not clickbait.

2. EMAIL HTML BODY
Write a full HTML email body. Requirements:
- Open with a personal hook specific to their business category
- Mention 3-4 specific pain points a {business_category} owner in India faces without a website
- Present web design as the solution with 3-4 concrete benefits
- Include a clear CTA (reply to this email / call / visit link)
- Friendly closing
- Use inline CSS for styling (bg colors, padding, clean font)
- Max 350 words in the body text
- Must contain {{business_name}} and {{city}}

3. WHATSAPP MESSAGE
Write a WhatsApp message. Requirements:
- Max 800 characters
- Conversational, not corporate
- Use 2-3 relevant emojis (not excessive)
- Mention their business type specifically
- One clear CTA at the end (reply YES / reply to learn more)
- Must contain {{business_name}} and {{city}}

---

Format your response EXACTLY as:
SUBJECT: <subject line here>
EMAIL_HTML: <full html here>
WHATSAPP: <whatsapp message here>
REASONING: <1-2 sentences on your copywriting approach>"""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text
    return _parse_response(raw)


def _parse_response(raw: str) -> dict:
    sections = {"email_subject": "", "email_html": "", "whatsapp_message": "", "reasoning": ""}
    markers = {
        "SUBJECT:": "email_subject",
        "EMAIL_HTML:": "email_html",
        "WHATSAPP:": "whatsapp_message",
        "REASONING:": "reasoning",
    }

    current_key = None
    current_lines = []

    for line in raw.splitlines():
        matched = False
        for marker, key in markers.items():
            if line.startswith(marker):
                if current_key:
                    sections[current_key] = "\n".join(current_lines).strip()
                current_key = key
                current_lines = [line[len(marker):].strip()]
                matched = True
                break
        if not matched and current_key:
            current_lines.append(line)

    if current_key:
        sections[current_key] = "\n".join(current_lines).strip()

    return sections
