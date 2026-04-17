"""
Stub model functions — async, returning realistic shaped data.

Every function signature and return type is IDENTICAL to what the real model
will use. To swap in the real model, replace ONLY the function body.
Nothing else in the architecture changes.
"""
import random
import asyncio
from schemas.requests import (
    ClassifyClothingResponse,
    RateOutfitResponse,
    AnalyseUserResponse,
)

MODEL_VERSION = '1.0.0-stub'


# Wardrobe slot mapping (mirrors real FashionCLIP logic)
SLOT_MAP = {
    'tops': 'upperwear', 'activewear': 'upperwear', 'intimates': 'upperwear',
    'outerwear': 'outerwear',
    'bottoms': 'lowerwear', 'dresses': 'lowerwear',
    'accessories': 'accessories', 'bags': 'accessories', 'jewelry': 'accessories',
    'eyewear': 'accessories', 'hats': 'accessories', 'scarves': 'accessories',
    'belts': 'accessories', 'shoes': 'accessories',
    # Support singular labels from Gemma/other models
    'top': 'upperwear',
    'bottom': 'lowerwear',
    'dress': 'lowerwear',
    'shoe': 'accessories',
    'accessory': 'accessories',
}

ACCESSORY_MAINS = {'accessories','bags','jewelry','eyewear','hats','scarves','belts'}

TAG_MAP = {
    'upperwear': 'shirt',
    'lowerwear': 'pants',
    'outerwear': 'jacket/coat',
    'accessories': 'accessories',  # shoes get overridden below
}

async def classify_clothing_model(image_url: str, item_id: str) -> ClassifyClothingResponse:
    """
    STUB: Returns realistic data matching real FashionCLIP output structure.
    REPLACE THIS BODY with real model calls when ready.
    Function signature and return type must NOT change.
    """
    await asyncio.sleep(random.uniform(0.5, 2.0))

    main_categories = ['tops', 'bottoms', 'outerwear', 'shoes', 'accessories']
    sub_map = {
        'tops':      ['t-shirt', 'shirt', 'blouse', 'hoodie', 'sweater'],
        'bottoms':   ['jeans', 'trousers', 'shorts', 'skirt', 'leggings'],
        'outerwear': ['jacket', 'coat', 'blazer', 'trench coat', 'bomber jacket'],
        'shoes':     ['sneakers', 'boots', 'sandals', 'heels', 'loafers'],
        'accessories': ['handbag', 'backpack', 'watch', 'sunglasses', 'hat'],
    }
    attr_pool = ['cotton', 'casual', 'fitted', 'solid', 'white', 'black',
                 'crew neck', 'short sleeve', 'regular fit', 'spring']

    main_cat  = random.choice(main_categories)
    sub_cat   = random.choice(sub_map[main_cat])
    slot      = SLOT_MAP.get(main_cat, 'accessories')
    attrs     = random.sample(attr_pool, k=random.randint(5, 8))
    is_acc    = main_cat in ACCESSORY_MAINS
    tag       = TAG_MAP.get(slot, 'accessories')
    if main_cat == 'shoes': tag = 'shoes'

    description = f'{main_cat}, {sub_cat}, ' + ', '.join(attrs[:3])

    # Stub dominant colours — real model uses K-Means on image pixels
    stub_colors = [
        [random.randint(0,255), random.randint(0,255), random.randint(0,255)]
        for _ in range(3)
    ]

    return ClassifyClothingResponse(
        item_id                   = item_id,
        wardrobe_slot             = slot,
        fashionclip_main_category = main_cat,
        fashionclip_sub_category  = sub_cat,
        fashionclip_attributes    = attrs,
        fashionclip_description   = description,
        fashionclip_image_vector  = None,  # [float * 512] from real model
        color_dominant_rgb        = stub_colors,
        pattern_strength          = round(random.uniform(0.0, 0.8), 2),
        texture_score             = round(random.uniform(0.1, 0.9), 2),
        formality_score           = round(random.uniform(0.1, 0.9), 2),
        is_accessory              = is_acc,
        tag                       = tag,
        sam_label                 = None,
        sam_confidence            = None,
        confidence                = round(random.uniform(0.75, 0.98), 2),
        model_version             = MODEL_VERSION,
    )


async def rate_outfit_model(
    outfit_id: str,
    items,
    user_profile,
    season: str | None = None,
    occasion: str | None = None,
    weather: str | None = None,
) -> RateOutfitResponse:
    """
    STUB: Returns realistic outfit rating.
    season/occasion/weather are used by real Rating Engine for contextual scoring.
    REPLACE THIS BODY with: rate_outfit(items, season, occasion, weather)
    from outfit-transformer/src/rating/overall_scorer.py
    """
    await asyncio.sleep(random.uniform(1.0, 3.0))

    rating   = round(random.uniform(4.0, 9.5), 1)
    c_score  = round(random.uniform(3.0, 10.0), 1)
    p_score  = round(random.uniform(3.0, 10.0), 1)
    s_score  = round(random.uniform(3.0, 10.0), 1)

    feedbacks = [
        '✅ Good colour harmony — neutral palette works well.',
        '✅ Formality consistent across all items.',
        '⚠️ Multiple patterned items can clash — limit to one statement pattern.',
        '💡 Adding a neutral outerwear layer would improve cohesion.',
    ]

    return RateOutfitResponse(
        outfit_id          = outfit_id,
        rating             = rating,
        color_score        = c_score,
        proportion_score   = p_score,
        style_score        = s_score,
        feedback           = random.sample(feedbacks, k=2),
        strengths          = ['color_harmony'],
        improvements       = ['pattern_coordination'],
        breakdown          = None,  # populated by real model
        compatibility_score = None,  # populated when OT checkpoint loaded
        model_version      = MODEL_VERSION,
    )


async def analyse_user_model(image_url: str, user_id: str) -> AnalyseUserResponse:
    """
    STUB: Returns fake age range and height estimation.
    REPLACE THIS BODY with your actual CV model when ready.
    """
    await asyncio.sleep(random.uniform(1.0, 2.5))

    return AnalyseUserResponse(
        user_id             = user_id,
        estimated_age_range = random.choice(['18-24', '25-34', '35-44']),
        estimated_height_cm = random.randint(155, 190),
        confidence          = round(random.uniform(0.65, 0.90), 2),
        model_version       = MODEL_VERSION,
    )
