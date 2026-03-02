from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List


# Suppress Pydantic warning about 'model_version' conflicting with 'model_' namespace
_no_ns = ConfigDict(protected_namespaces=())


# ── CLOTHING CLASSIFICATION ─────────────────────────────

class ClassifyClothingRequest(BaseModel):
    image_url: str = Field(..., description='Signed Supabase Storage URL')
    item_id: str   = Field(..., description='UUID of the wardrobe item')


class ClassifyClothingResponse(BaseModel):
    model_config = _no_ns
    item_id:       str
    category:      str
    subcategory:   str
    colors:        List[str]
    pattern:       str
    fit:           str
    fabric:        str
    season:        str
    confidence:    float
    model_version: str
    # 512-dim vector — None until real model is wired in
    embedding:     Optional[List[float]] = None


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
    items:        List[OutfitItem]
    user_profile: Optional[UserProfile] = None


class RateOutfitResponse(BaseModel):
    model_config = _no_ns
    outfit_id:        str
    rating:           float  # 0.0 to 10.0
    color_score:      float
    proportion_score: float
    style_score:      float
    feedback:         str
    model_version:    str


# ── USER ANALYSIS (age + height estimation) ──────────────

class AnalyseUserRequest(BaseModel):
    image_url: str
    user_id:   str


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
