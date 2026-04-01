from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List


# Suppress Pydantic warning about 'model_version' conflicting with 'model_' namespace
_no_ns = ConfigDict(protected_namespaces=())


# ── CLOTHING CLASSIFICATION ─────────────────────────────

class ClassifyClothingRequest(BaseModel):
    image_url: str = Field(..., description='Signed Supabase Storage URL')
    item_id: str   = Field(..., description='UUID of the wardrobe item')
    ai_result_id: str = Field(..., description='UUID of the ai_results row')


class ClassifyClothingResponse(BaseModel):
    model_config = _no_ns
    item_id:                    str

    # 4-slot system
    wardrobe_slot:              str   # upperwear | outerwear | lowerwear | accessories

    # FashionCLIP outputs
    fashionclip_main_category:  str
    fashionclip_sub_category:   str
    fashionclip_attributes:     List[str]   # top-10 attributes
    fashionclip_description:    str         # 'tops, t-shirt, cotton, casual...'
    fashionclip_image_vector:   Optional[List[float]] = None  # 512-dim

    # Pre-extracted numeric features
    color_dominant_rgb:         List[List[int]]  # [[r,g,b],[r,g,b],[r,g,b]]
    pattern_strength:           float
    texture_score:              float
    formality_score:            float

    # Rating Engine helpers
    is_accessory:               bool
    tag:                        str   # 'shirt','pants','jacket/coat','shoes','accessories'

    # SAM outputs (None when item classified from standalone image, not outfit photo)
    sam_label:                  Optional[str]   = None
    sam_confidence:             Optional[float] = None

    confidence:                 float
    model_version:              str


# ── OUTFIT RATING ────────────────────────────────────────

class OutfitItem(BaseModel):
    item_id:  str
    category: str
    colors:   List[str]
    pattern:  Optional[str] = None
    fit:      Optional[str] = None


class UserProfile(BaseModel):
    body_type: Optional[str] = None
    skin_tone: Optional[str] = None
    age_range: Optional[str] = None
    height_cm: Optional[int] = None


class RateOutfitRequest(BaseModel):
    outfit_id:    str
    ai_result_id: str
    items:        List[OutfitItem]
    user_profile: Optional[UserProfile] = None
    # Context fields needed by Rating Engine
    season:       Optional[str] = None  # 'spring'|'summer'|'fall'|'winter'
    occasion:     Optional[str] = None  # 'casual'|'formal'|'business'|...
    weather:      Optional[str] = None  # 'hot'|'warm'|'mild'|'cool'|'cold'

# ── QUEUE ENDPOINT REQUESTS ──────────────────────────────

class QueueRateOutfitRequest(BaseModel):
    outfit_id:    str
    ai_result_id: str
    season:       Optional[str] = None
    occasion:     Optional[str] = None
    weather:      Optional[str] = None

class QueueRateRecommendationRequest(BaseModel):
    recommendation_id: str
    items:        List[OutfitItem]
    ai_result_id: str
    user_id:      str
    season:       Optional[str] = None
    occasion:     Optional[str] = None
    weather:      Optional[str] = None


class RatingBreakdown(BaseModel):
    score:  float
    detail: Optional[str] = None

class RateOutfitResponse(BaseModel):
    model_config = _no_ns
    outfit_id:          str
    rating:             float   # 0.0 – 10.0 overall
    color_score:        float
    proportion_score:   float
    style_score:        float
    feedback:           List[str]
    strengths:          List[str]
    improvements:       List[str]
    # Full breakdown per dimension — optional
    breakdown:          Optional[dict] = None
    compatibility_score: Optional[float] = None
    model_version:      str


# ── USER ANALYSIS (age + height estimation) ──────────────

class AnalyseUserRequest(BaseModel):
    image_url: str
    user_id:   str
    ai_result_id: str


class AnalyseUserResponse(BaseModel):
    model_config = _no_ns
    user_id:              str
    estimated_age_range:  str   # e.g. '18-24'
    estimated_height_cm:  int
    confidence:           float
    model_version:        str


# ── JOB RESPONSE (returned immediately for async tasks) ──

class JobAcceptedResponse(BaseModel):
    job_id:  str
    status:  str = 'queued'
    message: str
