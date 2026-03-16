# AI Models — Backend Integration Guide

> **Purpose**: A single reference for backend engineers integrating the outfit-rating and wardrobe-generation AI pipeline. Covers model internals, every input/output shape, DB schema recommendations, and API design patterns.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Feature 1 — Outfit Rating](#2-feature-1--outfit-rating)
   - [2.1 Full Pipeline Flow](#21-full-pipeline-flow)
   - [2.2 Model 1: SAM (Segmentation)](#22-model-1-sam-grounding-dino--mobilesam)
   - [2.3 Model 2: FashionCLIP (Classification)](#23-model-2-fashionclip-classification)
   - [2.4 Model 3: Outfit Transformer (Compatibility)](#24-model-3-outfit-transformer-compatibility)
   - [2.5 Rating Engine (Rule-Based Scorers)](#25-rating-engine-rule-based-scorers)
   - [2.6 Rating Score Weights & Formula](#26-rating-score-weights--formula)
   - [2.7 Complete API Contract — Outfit Rating](#27-complete-api-contract--outfit-rating)
3. [Feature 2 — Wardrobe Outfit Generation](#3-feature-2--wardrobe-outfit-generation)
   - [3.1 Wardrobe Structure (4 Categories)](#31-wardrobe-structure-4-categories)
   - [3.2 Outfit Generation Flow](#32-outfit-generation-flow)
   - [3.3 Complete API Contract — Wardrobe Generation](#33-complete-api-contract--wardrobe-generation)
4. [FashionCLIP Label Taxonomy](#4-fashionclip-label-taxonomy)
5. [Database Schema Design](#5-database-schema-design)
6. [Backend Architecture — Detailed Integration](#6-backend-architecture--detailed-integration)
7. [Stub-to-Real Migration Map](#7-stub-to-real-migration-map)
8. [Model Checkpoint Paths & Loading](#8-model-checkpoint-paths--loading)

---

## 1. System Overview

Two user-facing AI features share the same underlying models:

| Feature | Entry Point | Models Used |
|---------|-------------|-------------|
| **Outfit Rating** | User uploads 1 outfit photo | SAM → FashionCLIP → Outfit Transformer → Rating Engine |
| **Wardrobe Outfit Generation** | User's wardrobe items (pre-classified) | FashionCLIP (already run) → Random outfit sampling → Rating Engine → Return top-k |

```
                     ┌──────────────────────────────────────────────────────┐
                     │               SHARED INFRASTRUCTURE                  │
  User Wardrobe ────►│  FashionCLIP (per item, run at upload time)          │
  (4 categories)     │  SAM (for new outfit photos only)                    │
                     │  Outfit Transformer  (compatibility)                  │
                     │  Rating Engine (rule-based scorers × 10 dimensions)  │
                     └──────────────────────────────────────────────────────┘
         ▲                        ▲
         │                        │
  Feature 2                  Feature 1
  Wardrobe Generation         Outfit Photo Rating
```

---

## 2. Feature 1 — Outfit Rating

### 2.1 Full Pipeline Flow

```
[Client uploads outfit image (JPEG/PNG)]
         │
         ▼
[Step 1] SAM  (Grounding DINO detection + MobileSAM mask)
         │  OUTPUT: list of segmented items
         │    Each item: { label, confidence, crop_image, mask }
         │  FILTER: drop items with confidence < 0.45
         │
         ▼
[Step 2] FashionCLIP  (per cropped item — batched)
         │  OUTPUT per item: { main_category, sub_category, top_attributes, description }
         │
         ▼
[Step 3] Outfit Transformer  (optional — requires trained checkpoint)
         │  INPUT:  list of (crop_image + description_text) per item
         │  OUTPUT: compatibility_score  ∈ [0.0, 1.0]
         │  NOTE:   skipped if no checkpoint; its weight is redistributed
         │
         ▼
[Step 4] Rating Engine  (extractors → scorers → weighted sum)
         │  EXTRACTORS: color k-means, Laplacian patterns, Sobel textures, layer count
         │  SCORERS:    10 dimensions, each 0–10
         │  INPUTS:     images + masks + attributes + tags + user context
         │  OUTPUT:     { overall_score, breakdown{}, feedback[], strengths[], improvements[] }
         │
         ▼
[Response to Client]
{
  "segmented_items": [...],
  "compatibility_score": 0.82,
  "rating": {
    "overall_score": 8.5,
    "breakdown": { ... },
    "feedback": [ ... ]
  },
  "num_items": 4,
  "layering_count": 3
}
```

---

### 2.2 Model 1: SAM (Grounding DINO + MobileSAM)

**What it does**: Detects and masks individual clothing items from a single outfit photo.

#### Inputs

| Parameter | Type | Description |
|-----------|------|-------------|
| `image` | `np.ndarray` (H×W×3, BGR) or file path | Full outfit photo |
| `confidence_threshold` | `float` (default: `0.45`) | Minimum detection confidence; items below are dropped |
| `text_prompts` | `list[str]` (internal) | Fixed: `["shirt", "pants", "jacket", "shoes", "accessories"]` |

#### Outputs

```python
# Per detected item (only confidence >= threshold are kept)
{
    "label":      str,          # e.g. "shirt", "pants", "shoes", "jacket/coat", "accessories"
    "confidence": float,        # Grounding DINO confidence score (0.0 – 1.0)
    "crop":       np.ndarray,   # Masked + center-padded square crop (BGR)
    "mask":       np.ndarray,   # Binary mask (H×W bool)
    "bbox":       [x, y, w, h]  # Bounding box in original image coordinates
}
```

#### Error Case

```python
# If no items detected or all below threshold:
{ "segments": [], "message": "No clothing items were detected..." }
# Pipeline stops here — FashionCLIP and Transformer are NOT called
```

#### Key Behaviour Notes

- Runs Grounding DINO with text prompts → gets bounding boxes → passes each box to MobileSAM for pixel mask
- Crops are center-padded to a square canvas (preserves aspect ratio, pads with black)
- Runs on **GPU if available**, else CPU
- Parallel image saving with `ThreadPoolExecutor(max_workers=4)`

---

### 2.3 Model 2: FashionCLIP (Classification)

**What it does**: Zero-shot classification of each clothing crop into category, sub-category, and visual attributes.

#### Inputs

| Parameter | Type | Description |
|-----------|------|-------------|
| `images` | `list[PIL.Image or str]` | Cropped item images (batch) |
| `top_k_categories` | `int` (default: `3`) | Top N main categories to return |
| `top_k_subcategories` | `int` (default: `5`) | Top N sub-categories to return |
| `top_k_attributes` | `int` (default: `10`) | Top N attributes to return |

#### Outputs (per item)

```python
{
    "main_category": [
        ("tops", 0.92),
        ("activewear", 0.43),
        ("outerwear", 0.21)
    ],
    "sub_category": [
        ("t-shirt", 0.88),
        ("polo shirt", 0.45),
        ("crop top", 0.31),
        ("tank top", 0.22),
        ("sweater", 0.18)
    ],
    "attributes": [
        ("cotton", 0.81),
        ("casual", 0.79),
        ("short sleeve", 0.76),
        ("fitted", 0.62),
        ("solid", 0.58),
        ("crew neck", 0.54),
        ("white", 0.51),
        ("regular fit", 0.48),
        ("spring", 0.43),
        ("plain", 0.41)
    ]
}
```

#### Text Embedding Dimensions

- Image vector: **512-dimensional** float32 (normalized cosine)
- Text vectors: **512-dimensional** float32 (normalized cosine, precomputed once at startup)
- Classification is dot-product similarity: `score = image_vec @ text_vec.T`

#### Wardrobe Use Case (4-Category Split)

When the user's wardrobe is pre-organized into 4 categories, FashionCLIP is run **at item-upload time** (not at outfit-generation time). The main_category from FashionCLIP maps to the wardrobe slot:

| Wardrobe Slot | FashionCLIP Main Categories |
|---------------|-----------------------------|
| **upperwear** | `tops`, `activewear` |
| **outerwear** | `outerwear` |
| **lowerwear** | `bottoms` |
| **accessories** | `accessories`, `bags`, `jewelry`, `eyewear`, `hats`, `scarves`, `belts`, `shoes` |

> **Note**: Shoes are grouped as accessories in the wardrobe model. For outfit generation the `is_accessory` flag is set based on the SAM label or wardrobe category — `accessories`, `jewelry`, `bags`, `hats` always get `is_accessory=True`; `shoes`, `tops`, `bottoms`, `outerwear` do not.

---

### 2.4 Model 3: Outfit Transformer (Compatibility)

**What it does**: Scores how well multiple clothing items "go together" as an outfit (compatibility prediction).

#### Inputs

```python
# List of FashionItem objects — one per clothing piece
items = [
    {
        "image": PIL.Image,     # Cropped item image
        "description": str      # Built from FashionCLIP: "shirt, t-shirt, cotton, casual, short sleeve"
    },
    # ... more items
]
```

**Description string format**: `"{sam_label}, {top_sub_category}, {attr1}, {attr2}, {attr3}"`

#### Internal Processing

1. Each item's image + description → CLIP-style encoder → 512-dim vector
2. All item vectors pooled → small "compatibility head" → single float
3. Output: `compatibility_score ∈ [0.0, 1.0]`

#### Outputs

```python
{
    "compatibility_score": 0.823,   # Raw model output 0–1
    "compatibility_score_10": 8.23  # Scaled to 0–10 for display
}
```

#### Conditional Use

```python
# The score is ONLY included in the overall rating when a trained checkpoint is loaded
# checkpoint path: outfit-transformer/checkpoints/<your_checkpoint>.pth

if checkpoint_loaded:
    weight_map["compatibility"] = 0.13
    # other weights adjusted proportionally
else:
    # compatibility excluded — overall score uses only the 10 rule-based dimensions
    # feedback includes: "⚠️ No trained checkpoint — compatibility score omitted"
```

---

### 2.5 Rating Engine (Rule-Based Scorers)

The rating engine takes the outputs of SAM + FashionCLIP and applies **5 extractors** and **10 scorers**.

#### Extractors (images → numeric features)

| Extractor | Algorithm | Output |
|-----------|-----------|--------|
| **Color Extractor** | K-Means clustering on masked pixels (k=3 per item) | `list[RGB tuples]` — dominant colors per item |
| **Pattern Detector** | Laplacian variance on grayscale crop | `float ∈ [0,1]` per item — `0`=no pattern, `1`=heavy pattern |
| **Texture Analyzer** | Sobel gradient magnitude on grayscale crop | `float ∈ [0,1]` per item — texture intensity |
| **Layer Detector** | Count items where `is_accessory == False` | `int` — number of clothing layers |
| **Category Detector** | Pass-through from SAM + FashionCLIP tags | `list[str]` — tags per item |

#### Scorers (features → 0–10 score)

Each scorer receives extractor outputs + user context parameters:

| Scorer | Inputs | Score Logic Summary |
|--------|--------|---------------------|
| **Color Harmony** | Colors (HSV), neutrals | Monochromatic=9.0, Analogous=8.5, Complementary=9.5, Triadic=8.5, Mixed=6.5; warm/cool temperature penalty ×0.7; >4 colors: −0.5 each |
| **Layering** | Layer count, color count | 3 layers=10.0; VIP=layers+colors, target 7; blend 60% layer score + 40% VIP score |
| **Proportions** | Item count | 1 item=6.0, 2 items=8.5, 3+ items=8.0 |
| **Pattern Coordination** | Pattern strengths per item | 0 patterns=8.5, 1=9.0, 2=7.5, 3+=5.5; strong multi-pattern penalty −1.0 |
| **Texture Balance** | Texture scores per item | 0 textured=6.0, 1=8.0, 2=9.0, 3+=8.0; adjusted by avg texture |
| **Formality Consistency** | Tags + sub_category + main_category + attributes | Variance-based: var<0.01→10.0, <0.04→8.0, <0.09→6.0, else→4.0 |
| **Seasonal Appropriateness** | User `season` + colors + attributes | Palette match → 8.0; unrecognized → 6.5 |
| **Weather Appropriateness** | User `weather` + user `season` | season in weather_map → 9.0; mismatch → 6.0; unspecified → 7.0 |
| **Accessory Balance** | Accessory count | 3 accessories=9.0; 0=6.0; 1–2=8.0; 4=7.0; 5+=4.5 |
| **Style Coherence** | Formality gap from occasion target + style keywords | 40% min(color, pattern) + 60% formality_alignment + style_keyword_bonus |
| **Compatibility** | Outfit Transformer score | Raw 0–1 scaled to 0–10 (only when checkpoint loaded) |

#### User Context Parameters (Required for Full Score)

| Parameter | Type | Accepted Values | Used By |
|-----------|------|-----------------|---------|
| `season` | `str` or `null` | `"spring"`, `"summer"`, `"fall"`, `"winter"` | Seasonal Appropriateness |
| `occasion` | `str` or `null` | `"formal"`, `"business"`, `"smart_casual"`, `"casual"`, `"streetwear"`, `"athleisure"`, `"old_money"`, `"party"`, `"black_tie"`, `"wedding"` | Occasion Matching, Style Coherence, Formality |
| `weather` | `str` or `null` | `"hot"`, `"warm"`, `"mild"`, `"cool"`, `"cold"` | Weather Appropriateness |
| `confidence_threshold` | `float` | `0.3`–`0.9` (default: `0.45`) | SAM detection filter |
| `use_outfit_transformer` | `bool` | `true` / `false` (default: `true`) | Whether to run Outfit Transformer |

---

### 2.6 Rating Score Weights & Formula

```
WEIGHTS (must sum to 1.0 when compatibility excluded):
  color_harmony:          0.20  (20%)
  layering:               0.15  (15%)
  proportions:            0.15  (15%)
  formality_consistency:  0.10  (10%)
  pattern_coordination:   0.10  (10%)
  texture_balance:        0.10  (10%)
  seasonal_appropriateness: 0.06  (6%)
  accessory_balance:      0.07  (7%)
  style_coherence:        0.05  (5%)
  weather_appropriateness: 0.04  (4%)

  [optional] compatibility: 0.13 — added when checkpoint available;
             other weights scaled proportionally to maintain sum = 1.0

FORMULA:
  overall_score = Σ (score[dimension] × weight[dimension])
  overall_score ∈ [0.0, 10.0]

TARGET: ~8.3/10 for a well-coordinated outfit
```

---

### 2.7 Complete API Contract — Outfit Rating

#### Request

```
POST /api/outfit/rate
Content-Type: multipart/form-data

Fields:
  image              (file, required)   - JPEG or PNG, max 10MB
  season             (string, optional) - "spring" | "summer" | "fall" | "winter"
  occasion           (string, optional) - "casual" | "formal" | "business" | ...
  weather            (string, optional) - "hot" | "warm" | "mild" | "cool" | "cold"
  confidence_threshold (float, optional, default: 0.45)
  use_outfit_transformer (bool, optional, default: true)
```

#### Response (200 OK)

```json
{
  "job_id": "uuid",
  "status": "completed",
  "processing_time_ms": 4200,

  "segmented_items": [
    {
      "index": 0,
      "sam_label": "shirt",
      "sam_confidence": 0.87,
      "main_category": "tops",
      "sub_category": "t-shirt",
      "top_attributes": ["cotton", "casual", "short sleeve", "fitted", "white"],
      "description": "shirt, t-shirt, cotton, casual, short sleeve",
      "image_feature_vector": [0.021, -0.043, ...],  // 512-dim, optional
      "wardrobe_slot": "upperwear"
    }
  ],
  "num_items": 4,
  "layering_count": 3,

  "compatibility_score": 0.823,
  "compatibility_score_10": 8.23,
  "compatibility_used": true,

  "rating": {
    "overall_score": 8.5,
    "breakdown": {
      "color_harmony":            { "score": 9.2, "harmony_type": "complementary", "detail": "Excellent complementary palette" },
      "layering":                 { "score": 8.0, "layer_count": 3, "vip": 7, "detail": "3 layers — perfect Rule of 7" },
      "proportions":              { "score": 8.5, "item_count": 4 },
      "formality_consistency":    { "score": 10.0, "variance": 0.005 },
      "pattern_coordination":     { "score": 4.5, "pattern_count": 3, "detail": "Multiple patterned items can clash" },
      "texture_balance":          { "score": 8.22, "textured_count": 2 },
      "seasonal_appropriateness": { "score": 6.5, "season": "summer" },
      "weather_appropriateness":  { "score": 7.0, "weather": null },
      "accessory_balance":        { "score": 8.0, "accessory_count": 2 },
      "style_coherence":          { "score": 7.8, "occasion": "casual" }
    },
    "feedback": [
      "✅ Excellent complementary color harmony",
      "✅ Rule of 7 satisfied — great layering",
      "⚠️ Multiple patterned items can clash",
      "💡 Try limiting strong patterns to 1 item"
    ],
    "strengths":    ["color_harmony", "layering", "formality_consistency"],
    "improvements": ["pattern_coordination"]
  }
}
```

#### Error Response

```json
// 422 — No clothing detected
{
  "error": "no_items_detected",
  "message": "No clothing items were detected. Try a clearer or closer outfit photo.",
  "confidence_threshold_used": 0.45
}

// 413 — Image too large
{ "error": "image_too_large", "message": "Maximum image size is 10MB" }
```

---

## 3. Feature 2 — Wardrobe Outfit Generation

### 3.1 Wardrobe Structure (4 Categories)

User wardrobe is organized into **4 slots**:

| Slot | Description | FashionCLIP Main Categories | Example Sub-categories |
|------|-------------|------------------------------|------------------------|
| **upperwear** | Tops, shirts, sweaters | `tops`, `activewear`, `intimates` | t-shirt, blouse, hoodie, cardigan, polo, vest |
| **outerwear** | Jackets, coats, blazers | `outerwear` | jacket, coat, blazer, trench coat, parka, bomber |
| **lowerwear** | Bottoms, pants, skirts | `bottoms`, `dresses` (optional) | jeans, trousers, shorts, skirt, leggings |
| **accessories** | Everything non-clothing | `accessories`, `bags`, `jewelry`, `eyewear`, `hats`, `scarves`, `belts`, `shoes` | sneakers, boots, necklace, handbag, watch, sunglasses |

> **Important for backend**: Wardrobe items are classified by FashionCLIP **once at upload time** and stored with their category, sub-category, and attribute metadata in the DB. The generation engine reads from the DB — it does NOT re-run FashionCLIP at generation time.

#### Wardrobe Item — DB Record Structure

```json
{
  "item_id": "uuid",
  "user_id": "uuid",
  "wardrobe_slot": "upperwear",           // upperwear | outerwear | lowerwear | accessories
  "image_url": "s3://bucket/path.jpg",
  "thumbnail_url": "s3://bucket/thumb.jpg",
  "fashionclip_main_category": "tops",
  "fashionclip_sub_category": "t-shirt",
  "fashionclip_attributes": ["cotton", "casual", "short sleeve", "white", "fitted"],
  "fashionclip_description": "tops, t-shirt, cotton, casual, short sleeve",
  "fashionclip_image_vector": [...],        // 512-dim float32 (for future similarity search)
  "is_accessory": false,
  "tag": "shirt",                           // SAM-style tag used by Rating Engine
  "color_dominant": [[255, 255, 255]],      // RGB dominant colors (pre-extracted)
  "pattern_strength": 0.12,               // Pre-extracted Laplacian value
  "texture_score": 0.34,                  // Pre-extracted Sobel value
  "formality_score": 0.4,                 // Derived from sub_category + attributes
  "created_at": "2024-01-01T00:00:00Z",
  "is_active": true
}
```

---

### 3.2 Outfit Generation Flow

```
[Client requests outfit generation]
  context: { season, occasion, weather, num_outfits=3, sample_size=25 }
         │
         ▼
[Backend] Load user wardrobe from DB
  → upperwear items list
  → outerwear items list  (optional)
  → lowerwear items list
  → accessories items list (optional)
         │
         ▼
[Sampling Loop] × sample_size (default 25)
  ├── Required pick: 1 item from upperwear
  ├── Required pick: 1 item from lowerwear
  ├── Optional pick (60% chance): 1 item from outerwear
  └── Optional pick (60% chance): 1–3 items from accessories
         │
         ▼
[Rating Engine] rate_outfit(items, season, occasion, weather)
  → Score each candidate outfit (0–10)
  → Store all (picks, score) tuples
         │
         ▼
[Sort by overall_score descending]
[Return top-k outfits]
         │
         ▼
[Response] top_outfits with full rating breakdowns
```

#### Item Conversion for Rating Engine

Each wardrobe DB item is converted to a `RatingItem` dict before passing to the engine:

```python
rating_item = {
    "image":        cv2.imread(item["local_path"]),  # BGR ndarray
    "tag":          item["tag"],                     # e.g. "shirt", "pants", "jacket/coat"
    "is_accessory": item["is_accessory"],
    "attributes":   item["fashionclip_attributes"],  # list of strings
    "sub_category": item["fashionclip_sub_category"],
    "main_category": item["fashionclip_main_category"],
}
```

> **Note on images**: The Rating Engine needs the actual image pixels (for color/texture/pattern extraction). Store wardrobe images locally (or download from object storage) before calling the engine, OR pre-extract and store the numeric features (colors, pattern_strength, texture_score) in the DB to avoid re-processing.

---

### 3.3 Complete API Contract — Wardrobe Generation

#### Request

```
POST /api/wardrobe/generate-outfit
Content-Type: application/json
Authorization: Bearer <token>

{
  "season":    "summer",       // optional
  "occasion":  "casual",       // optional
  "weather":   "warm",         // optional
  "num_outfits": 3,            // default: 3
  "sample_size": 25,           // default: 25 random combos to evaluate
  "include_outerwear": true,   // default: true — include outerwear slot
  "include_accessories": true  // default: true — include accessories
}
```

#### Response (200 OK)

```json
{
  "outfits": [
    {
      "rank": 1,
      "overall_score": 8.7,
      "items": [
        {
          "item_id": "uuid",
          "wardrobe_slot": "upperwear",
          "image_url": "https://cdn.../shirt.jpg",
          "fashionclip_sub_category": "t-shirt",
          "fashionclip_attributes": ["white", "cotton", "casual"]
        },
        {
          "item_id": "uuid",
          "wardrobe_slot": "lowerwear",
          "image_url": "https://cdn.../jeans.jpg",
          "fashionclip_sub_category": "jeans",
          "fashionclip_attributes": ["denim", "slim fit", "blue"]
        },
        {
          "item_id": "uuid",
          "wardrobe_slot": "accessories",
          "image_url": "https://cdn.../sneakers.jpg",
          "fashionclip_sub_category": "sneakers",
          "fashionclip_attributes": ["white", "canvas", "casual"]
        }
      ],
      "rating": {
        "overall_score": 8.7,
        "breakdown": {
          "color_harmony":         { "score": 9.5 },
          "layering":              { "score": 8.5 },
          "formality_consistency": { "score": 9.0 },
          "pattern_coordination":  { "score": 9.0 },
          "texture_balance":       { "score": 8.0 }
        },
        "feedback": [
          "✅ Excellent monochromatic color harmony",
          "✅ Casual style consistent throughout"
        ],
        "strengths": ["color_harmony", "formality_consistency"],
        "improvements": []
      }
    }
  ],
  "context": {
    "season": "summer",
    "occasion": "casual",
    "weather": "warm",
    "sample_size": 25,
    "num_outfits_returned": 3
  },
  "wardrobe_stats": {
    "upperwear_count": 12,
    "outerwear_count": 5,
    "lowerwear_count": 8,
    "accessories_count": 20
  }
}
```

---

## 4. FashionCLIP Label Taxonomy

These are the **fixed label sets** used for zero-shot classification. They must be stored in the DB and used to interpret FashionCLIP outputs.

### Main Categories (15)

```
tops, bottoms, dresses, outerwear, shoes, bags, accessories,
jewelry, eyewear, hats, scarves, belts, intimates, activewear, swimwear
```

### Sub-categories (78 total — grouped)

| Group | Sub-categories |
|-------|----------------|
| Tops | t-shirt, shirt, blouse, tank top, polo shirt, sweater, cardigan, hoodie, sweatshirt, crop top, tube top, camisole, vest, tunic |
| Bottoms | jeans, pants, trousers, shorts, skirt, leggings, joggers, chinos, cargo pants, capris, culottes |
| Dresses | dress, maxi dress, mini dress, midi dress, evening gown, cocktail dress, sundress, shirt dress, wrap dress, slip dress, jumpsuit, romper |
| Outerwear | jacket, coat, blazer, trench coat, parka, bomber jacket, denim jacket, leather jacket, windbreaker, puffer jacket, peacoat, overcoat |
| Shoes | sneakers, boots, sandals, heels, flats, loafers, oxfords, ankle boots, knee-high boots, pumps, wedges, mules, espadrilles, slippers |
| Bags | handbag, backpack, tote bag, crossbody bag, clutch, shoulder bag, messenger bag, satchel, wallet, purse |
| Accessories | sunglasses, hat, cap, beanie, scarf, belt, gloves, watch, tie, bow tie |
| Jewelry | necklace, bracelet, ring, earrings, brooch, anklet |
| Active/Swim | sports bra, yoga pants, athletic shorts, swimsuit, bikini, swim trunks |

### Attributes (130 total — grouped)

| Group | Attributes |
|-------|------------|
| Colors | black, white, gray, beige, brown, navy, blue, red, pink, purple, green, yellow, orange, multicolor, metallic, gold, silver |
| Patterns | solid, striped, polka dot, floral, plaid, checkered, leopard print, animal print, geometric, paisley, camouflage, tie-dye, abstract |
| Materials | cotton, denim, leather, suede, silk, satin, velvet, wool, knit, lace, mesh, chiffon, cashmere, polyester, nylon, canvas |
| Fit | fitted, loose, oversized, tight, relaxed, slim fit, regular fit, baggy, tailored, cropped |
| Length | long sleeve, short sleeve, sleeveless, three-quarter sleeve, maxi length, midi length, mini length, knee length, ankle length, floor length |
| Neckline | crew neck, v-neck, scoop neck, turtleneck, off-shoulder, strapless, halter neck, boat neck, square neck, high neck, low cut |
| Style | casual, formal, business, sporty, vintage, bohemian, preppy, minimalist, edgy, elegant, chic, streetwear, athletic, evening wear, workwear, loungewear |
| Details | embroidered, sequined, beaded, ruffled, pleated, buttoned, zippered, belted, pocketed, distressed, frayed, studded, printed, plain |
| Season | summer, winter, spring, fall, all-season |

---

## 5. Database Schema Design

### Tables

#### `wardrobe_items`

```sql
CREATE TABLE wardrobe_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id),
    
    -- Storage
    image_url               TEXT NOT NULL,
    thumbnail_url           TEXT,
    image_local_cache       TEXT,             -- local path for rating (temporary)
    
    -- Wardrobe slot (4-category system)
    wardrobe_slot           VARCHAR(20) NOT NULL
                            CHECK (wardrobe_slot IN ('upperwear','outerwear','lowerwear','accessories')),
    
    -- SAM outputs (if item was uploaded as part of outfit photo)
    sam_label               VARCHAR(50),      -- "shirt", "pants", "jacket/coat", "shoes", "accessories"
    sam_confidence          FLOAT,
    
    -- FashionCLIP outputs
    fashionclip_main_category   VARCHAR(50),  -- from MAIN_CATEGORIES
    fashionclip_sub_category    VARCHAR(50),  -- from SUB_CATEGORIES (top-1)
    fashionclip_attributes      TEXT[],       -- from ATTRIBUTES (top-10)
    fashionclip_description     TEXT,         -- "{label}, {sub}, {attr1}, {attr2}, ..."
    fashionclip_image_vector    FLOAT[],      -- 512-dim embedding (for similarity search)
    
    -- Pre-extracted numeric features (avoids re-processing at generation time)
    color_dominant_rgb      JSONB,            -- [[r,g,b], [r,g,b], [r,g,b]] (top-3 colors)
    pattern_strength        FLOAT,            -- Laplacian variance 0–1
    texture_score           FLOAT,            -- Sobel gradient 0–1
    formality_score         FLOAT,            -- 0.0 (very casual) – 1.0 (very formal)
    
    -- Rating helper flags
    is_accessory            BOOLEAN NOT NULL DEFAULT false,
    tag                     VARCHAR(50),      -- Rating engine tag: "shirt","pants","jacket/coat"
    
    -- Metadata
    created_at              TIMESTAMPTZ DEFAULT now(),
    updated_at              TIMESTAMPTZ DEFAULT now(),
    is_active               BOOLEAN DEFAULT true
);

CREATE INDEX idx_wardrobe_items_user_slot ON wardrobe_items(user_id, wardrobe_slot);
CREATE INDEX idx_wardrobe_items_user_active ON wardrobe_items(user_id, is_active);
```

#### `outfit_ratings`

```sql
CREATE TABLE outfit_ratings (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id),
    
    -- Source
    source                  VARCHAR(20) CHECK (source IN ('photo_upload', 'wardrobe_generation')),
    outfit_image_url        TEXT,             -- Original photo (nullable for wardrobe-generated)
    
    -- User context supplied at rating time
    season                  VARCHAR(10),      -- "spring" | "summer" | "fall" | "winter"
    occasion                VARCHAR(30),      -- "casual" | "formal" | ...
    weather                 VARCHAR(10),      -- "hot" | "warm" | "mild" | "cool" | "cold"
    confidence_threshold    FLOAT DEFAULT 0.45,
    
    -- Detected / selected items
    items                   JSONB NOT NULL,   -- array of segmented item metadata
    num_items               INT,
    layering_count          INT,
    
    -- AI model outputs
    compatibility_score     FLOAT,            -- Outfit Transformer (0–1), nullable if skipped
    compatibility_used      BOOLEAN DEFAULT false,
    
    -- Rating results
    overall_score           FLOAT NOT NULL,
    breakdown               JSONB NOT NULL,   -- { color_harmony: {score:.., detail:..}, ... }
    feedback                TEXT[],
    strengths               TEXT[],
    improvements            TEXT[],
    
    -- Wardrobe generation only
    wardrobe_item_ids       UUID[],           -- FK refs to wardrobe_items if generated
    
    -- Processing metadata
    processing_time_ms      INT,
    model_versions          JSONB,            -- { sam: "v1", fashionclip: "v2", ... }
    
    created_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_outfit_ratings_user ON outfit_ratings(user_id, created_at DESC);
```

#### `wardrobe_generation_jobs`

```sql
CREATE TABLE wardrobe_generation_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    
    -- Request params
    season          VARCHAR(10),
    occasion        VARCHAR(30),
    weather         VARCHAR(10),
    num_outfits     INT DEFAULT 3,
    sample_size     INT DEFAULT 25,
    
    -- Status
    status          VARCHAR(20) DEFAULT 'pending'
                    CHECK (status IN ('pending','processing','completed','failed')),
    
    -- Results (array of top-k outfit rating IDs)
    result_outfit_rating_ids  UUID[],
    error_message             TEXT,
    
    created_at      TIMESTAMPTZ DEFAULT now(),
    completed_at    TIMESTAMPTZ
);
```

---

## 6. Backend Architecture — Detailed Integration

### Service Decomposition

```
┌──────────────────────────────────────────────────────────────────┐
│                         API Gateway / Load Balancer              │
└──────────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────┐            ┌─────────────────┐
│  REST API        │            │  Worker Service  │
│  (FastAPI/Django)│            │  (Celery/RQ)     │
│                  │            │                  │
│ POST /rate       │──enqueue──►│ run_outfit_rating│
│ POST /generate   │──enqueue──►│ run_generation   │
│ POST /wardrobe/  │            │ classify_item    │
│       upload     │            │                  │
└─────────────────┘            └─────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────┐            ┌─────────────────┐
│  PostgreSQL DB  │            │  AI Model        │
│  (wardrobe_items│◄──────────│  Service (Python) │
│  outfit_ratings)│            │                  │
└─────────────────┘            │ SAM (GPU)        │
                               │ FashionCLIP (GPU)│
                               │ OutfitTransformer│
                               │ Rating Engine    │
                               └─────────────────┘
```

### AI Model Service Interface

The AI Model Service should expose a **Python callable interface** (or HTTP microservice):

```python
class AIModelService:

    def classify_wardrobe_item(self, image_bytes: bytes) -> dict:
        """
        Run at wardrobe item upload time.
        Returns FashionCLIP classification + pre-extracted features.
        
        Returns:
        {
            "wardrobe_slot":            "upperwear",
            "fashionclip_main_category": "tops",
            "fashionclip_sub_category":  "t-shirt",
            "fashionclip_attributes":    ["cotton", "casual", "short sleeve"],
            "fashionclip_description":   "tops, t-shirt, cotton, casual, short sleeve",
            "fashionclip_image_vector":  [0.01, -0.02, ...],  // 512 floats
            "color_dominant_rgb":        [[255,255,255],[...]],
            "pattern_strength":          0.12,
            "texture_score":             0.34,
            "formality_score":           0.40,
            "is_accessory":              false,
            "tag":                       "shirt"
        }
        """

    def rate_outfit_photo(
        self,
        image_bytes: bytes,
        season: str | None,
        occasion: str | None,
        weather: str | None,
        confidence_threshold: float = 0.45,
        use_outfit_transformer: bool = True,
    ) -> dict:
        """
        Full pipeline: SAM → FashionCLIP → OutfitTransformer → Rating.
        Returns the complete rating response dict (see API spec above).
        """

    def generate_wardrobe_outfits(
        self,
        wardrobe_items: list[dict],  # list of DB records (with local image paths)
        season: str | None,
        occasion: str | None,
        weather: str | None,
        sample_size: int = 25,
        top_k: int = 3,
    ) -> list[dict]:
        """
        Outfit generation from pre-classified wardrobe.
        Returns top-k rated outfits.
        NOTE: Does NOT re-run FashionCLIP — uses stored attributes from wardrobe DB.
        """
```

### Wardrobe Item Upload Flow (Detailed)

```
POST /api/wardrobe/items  (multipart: image file)
         │
         ▼
1. Validate image (size, format)
2. Upload to object storage (S3/GCS) → get image_url
3. Enqueue classify_wardrobe_item task
         │
         ▼ (worker)
4. Download image bytes
5. Run FashionCLIP:
   - Encode image → 512-dim vector
   - Compare to MAIN_CATEGORIES → top main category
   - Compare to SUB_CATEGORIES → top sub-category
   - Compare to ATTRIBUTES → top-10 attributes
6. Derive wardrobe_slot from main_category (see mapping table in §2.3)
7. Extract numeric features:
   - K-Means (k=3) on image pixels → dominant RGB colors
   - Laplacian variance → pattern_strength
   - Sobel magnitude → texture_score
8. Derive formality_score from sub_category + attributes
9. Set is_accessory flag and tag value
10. INSERT into wardrobe_items DB
11. Notify client (webhook or polling)
```

### Outfit Rating Flow (Detailed)

```
POST /api/outfit/rate  (multipart: image + params)
         │
         ▼
1. Validate request
2. Enqueue run_outfit_rating task with image bytes + params
         │
         ▼ (worker)
3. Load models (already loaded in worker process — singleton pattern)
4. SAM: detect + mask clothing items from image
   - If no items or all below threshold → 422 error
5. FashionCLIP: classify each crop in a single batched call
6. OutfitTransformer: compute compatibility score (if enabled + checkpoint)
7. Rating Engine:
   a. Run extractors on cropped images (batch where possible)
   b. Run all scorers with extractor outputs + user context
   c. Compute weighted sum → overall_score
   d. Generate feedback strings
8. INSERT into outfit_ratings DB
9. Return full result JSON
```

### Wardrobe Outfit Generation Flow (Detailed)

```
POST /api/wardrobe/generate-outfit  (JSON: context params)
         │
         ▼
1. Authenticate user
2. Load all user's active wardrobe items from DB
3. Validate: must have ≥1 upperwear AND ≥1 lowerwear item
4. Enqueue run_generation task
         │
         ▼ (worker)
5. Download images to local temp dir (or use cached)
6. Sample loop × sample_size:
   a. Pick 1 random upperwear item
   b. Pick 1 random lowerwear item
   c. Optionally (60% chance) pick 1 outerwear item
   d. Optionally (60% chance) pick 1-3 accessories
   e. Convert to RatingItems using stored attributes (no re-running FashionCLIP)
   f. Call rate_outfit(items, season, occasion, weather)
   g. Append (item_ids, score, rating) to results
7. Sort by overall_score descending, take top-k
8. INSERT top-k into outfit_ratings DB
9. Return formatted response
```

---

## 7. Stub-to-Real Migration Map

For each stub function in your backend, here is the real model call to replace it with:

| Stub Function | Real Replacement | Data Needed |
|---------------|-----------------|-------------|
| `classify_item_stub(image)` | `FashionClassifier.classify_images_batch([image])` | Raw image bytes or temp file path |
| `segment_outfit_stub(image)` | `ClothingSegmentationPipeline.detect_clothing_items(image_bgr)` + `.segment_items(image_bgr, boxes)` | BGR ndarray |
| `get_compatibility_stub(items)` | `OutfitTransformerModel(fashion_items)` | FashionItem list (image + description) |
| `rate_outfit_stub(items, ctx)` | `rate_outfit(items, season, occasion, weather)` from `outfit-transformer/src/rating/overall_scorer.py` | RatingItem list + context strings |
| `get_wardrobe_slot_stub(cat)` | Lookup table in §2.3 | FashionCLIP main_category string |
| `generate_outfit_stub(wardrobe)` | `build_random_outfit()` × N + `rate_outfit()` + sort | Wardrobe items from DB |

---

## 8. Model Checkpoint Paths & Loading

### File Locations

```
recomendation/
├── Segment_Model_SAM/
│   └── models/
│       ├── mobile_sam.pt                    # MobileSAM weights
│       ├── groundingdino_swint_ogc.pth      # Grounding DINO weights
│       └── GroundingDINO_SwinT_OGC.py       # Grounding DINO config
│
├── fashion-clip/
│   └── hf_model/                            # FashionCLIP local HuggingFace snapshot
│       └── config.json                      # (if present, loaded locally; else HF hub)
│
└── outfit-transformer/
    ├── checkpoints/
    │   └── <your_trained_checkpoint>.pth    # Outfit Transformer (optional)
    └── src/
        └── rating/
            └── overall_scorer.py            # Main rating entry point: rate_outfit()
```

### Model Loading — Singleton Pattern (Recommended)

```python
# In worker startup — load once, reuse across requests
from clothing_segmentation import ClothingSegmentationPipeline
from fashionclip_pipeline import FashionClassifier
from rating.overall_scorer import rate_outfit

class ModelSingleton:
    _instance = None

    @classmethod
    def get(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        self.sam = ClothingSegmentationPipeline(
            mobile_sam_checkpoint="Segment_Model_SAM/models/mobile_sam.pt",
            grounding_dino_checkpoint="Segment_Model_SAM/models/groundingdino_swint_ogc.pth",
            grounding_dino_config="Segment_Model_SAM/models/GroundingDINO_SwinT_OGC.py",
        )
        self.fashionclip = FashionClassifier(device=None)  # auto GPU/CPU
        # Text embeddings pre-computed in __init__ — do NOT reinitialize per request
        self.rate_outfit = rate_outfit

    # Optional: load outfit transformer checkpoint
        # from models.load import load_outfit_transformer
        # self.ot_model = load_outfit_transformer("outfit-transformer/checkpoints/...")
```

### Environment Variables

```bash
FASHIONCLIP_MODEL_PATH=/path/to/fashion-clip/hf_model  # Optional local override
CUDA_VISIBLE_DEVICES=0                                   # GPU selection
OT_CHECKPOINT_PATH=/path/to/outfit-transformer/checkpoints/model.pth  # Optional
```

---

*Document generated: 2026-03-05 | Source models: SAM v2 (MobileSAM + GroundingDINO), FashionCLIP (HuggingFace), Outfit Transformer (custom), Rating Engine (rule-based)*
