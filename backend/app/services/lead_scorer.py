"""
Lead scoring: higher score = better prospect for web design + corporate email services.
Primary targets: no real website, no corporate email (using Gmail/Yahoo).
"""

HIGH_VALUE_CATEGORIES = {
    "restaurant", "cafe", "bakery", "salon", "spa", "gym", "fitness",
    "clinic", "doctor", "dentist", "hospital", "pharmacy", "lawyer",
    "attorney", "accountant", "real estate", "hotel", "lodging",
    "beauty", "barber", "plumber", "electrician", "contractor",
    "florist", "jeweler", "boutique", "retailer", "store", "shop",
    "school", "tutor", "coaching", "institute", "agency", "studio",
}


def score_lead(
    has_real_website: bool,
    is_social_only: bool,
    rating: float | None,
    review_count: int | None,
    category: str | None,
    website_status: str | None = None,
) -> int:
    score = 0

    # ── Website / email signal (most important factor) ──────────────────────
    if not has_real_website and not is_social_only:
        # No online presence at all → definitely using personal email → top priority
        score += 60
    elif is_social_only:
        # Facebook/Instagram page only → likely using personal email → strong prospect
        score += 40
    elif website_status == "broken":
        # Dead website → urgent redesign need
        score += 30
    elif website_status == "old":
        # Outdated site → redesign opportunity
        score += 20

    # ── Review count: fewer reviews = lower online visibility ───────────────
    if review_count is not None:
        if review_count < 10:
            score += 20
        elif review_count < 50:
            score += 10

    # ── Rating: low rating = reputation needs work (upsell opportunity) ─────
    if rating is not None:
        if rating < 3.5:
            score += 15
        elif rating < 4.0:
            score += 5

    # ── Category: high-value service industries ──────────────────────────────
    if category:
        cat_lower = category.lower()
        if any(hv in cat_lower for hv in HIGH_VALUE_CATEGORIES):
            score += 15

    return min(score, 100)
