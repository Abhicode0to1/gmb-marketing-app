"""
Lead scoring logic: assigns 0-100 score to a business.
Higher score = more likely to need web design services.
"""


def score_lead(
    has_website: bool,
    rating: float | None,
    review_count: int | None,
    category: str | None,
) -> int:
    score = 0

    # No website → highest priority (needs web design the most)
    if not has_website:
        score += 40

    # Low rating → reputation management opportunity
    if rating is not None and rating < 3.5:
        score += 20
    elif rating is not None and rating < 4.0:
        score += 10

    # Few reviews → low online presence
    if review_count is not None:
        if review_count < 10:
            score += 20
        elif review_count < 50:
            score += 10

    # High-value service categories for web design sales
    HIGH_VALUE_CATEGORIES = {
        "restaurant", "cafe", "bakery", "salon", "spa", "gym", "fitness",
        "clinic", "doctor", "dentist", "hospital", "pharmacy", "lawyer",
        "attorney", "accountant", "real estate", "hotel", "lodging",
        "beauty", "barber", "plumber", "electrician", "contractor",
        "florist", "jeweler", "boutique", "retailer", "store", "shop",
    }
    if category:
        cat_lower = category.lower()
        if any(hv in cat_lower for hv in HIGH_VALUE_CATEGORIES):
            score += 20

    return min(score, 100)
