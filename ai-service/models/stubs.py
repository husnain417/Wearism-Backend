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


async def classify_clothing_model(image_url: str, item_id: str) -> ClassifyClothingResponse:
    """
    STUB: Returns realistic fake classification data.
    REPLACE THIS BODY with your actual model inference when ready.
    """
    # Simulate model processing time
    await asyncio.sleep(random.uniform(0.5, 2.0))

    categories  = ['tops', 'bottoms', 'outerwear', 'footwear', 'accessories']
    subcats     = {
        'tops':        ['t-shirt', 'shirt', 'blouse'],
        'bottoms':     ['jeans', 'trousers', 'skirt'],
        'outerwear':   ['jacket', 'coat', 'hoodie'],
        'footwear':    ['sneakers', 'boots', 'heels'],
        'accessories': ['bag', 'belt', 'scarf'],
    }
    colors_pool = ['black', 'white', 'navy', 'grey', 'beige', 'red', 'blue', 'green']
    category    = random.choice(categories)

    return ClassifyClothingResponse(
        item_id       = item_id,
        category      = category,
        subcategory   = random.choice(subcats[category]),
        colors        = random.sample(colors_pool, k=random.randint(1, 2)),
        pattern       = random.choice(['solid', 'striped', 'checked', 'floral']),
        fit           = random.choice(['slim', 'regular', 'relaxed', 'oversized']),
        fabric        = random.choice(['cotton', 'polyester', 'wool', 'denim', 'silk']),
        season        = random.choice(['spring', 'summer', 'autumn', 'winter', 'all_season']),
        confidence    = round(random.uniform(0.75, 0.98), 2),
        model_version = MODEL_VERSION,
        embedding     = None,  # will be [float * 512] from real model
    )


async def rate_outfit_model(outfit_id: str, items, user_profile) -> RateOutfitResponse:
    """
    STUB: Returns realistic fake outfit rating.
    REPLACE THIS BODY with your actual outfit rating model when ready.
    """
    await asyncio.sleep(random.uniform(1.0, 3.0))

    feedbacks = [
        'The colour palette works well together. Consider adding a statement accessory.',
        'Good proportions. The mix of fitted and relaxed pieces creates visual interest.',
        'Solid classic combination. The neutral tones make this very versatile.',
        'The layering adds depth. Watch the colour clash between the top and jacket.',
    ]

    return RateOutfitResponse(
        outfit_id        = outfit_id,
        rating           = round(random.uniform(4.0, 9.5), 1),
        color_score      = round(random.uniform(3.0, 10.0), 1),
        proportion_score = round(random.uniform(3.0, 10.0), 1),
        style_score      = round(random.uniform(3.0, 10.0), 1),
        feedback         = random.choice(feedbacks),
        model_version    = MODEL_VERSION,
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
