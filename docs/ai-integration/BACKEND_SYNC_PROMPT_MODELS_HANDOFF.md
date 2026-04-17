# Backend Sync Prompt — Models ↔ Backend (Updated Strategy)

Use this as a **single prompt / handoff doc** to get the backend and models PC fully synced. It is written for the laptop backend engineer(s) and the person deploying the Models PC services.

---

## Current reality (what is wired today)

### What runs where

- **Laptop (Node/Fastify backend)**:
  - Uploads wardrobe image to Supabase Storage.
  - Creates `wardrobe_items` row (AI fields initially null).
  - Creates `ai_results` row with `task_type='clothing_classification'`.
  - Calls Models PC over LAN: `POST {AI_SERVICE_URL}/queue/classify/clothing`.

- **Models PC (`ai-service` FastAPI + Celery + Redis local)**:
  - FastAPI receives `/queue/...` and enqueues Celery.
  - Celery runs classification/rating and writes results directly to Supabase.

### Which pipelines are truly integrated

- **Pipeline 1 (segment + extract)**: **Integrated** via `ai-service/models/real_models.py` calling:
  - `Updated_Model_Strategy/pipelines/pipeline_segment_and_extract.py`
  - which uses SAM subprocess (`Updated_Model_Strategy/utils/sam_subprocess.py`) + item crops + Gemma attribute extraction.

- **Pipeline 2 (outfit rating)**: **Integrated** via `ai-service/models/real_models.py` calling:
  - `Updated_Model_Strategy/modules/outfit_rater.py` when item payloads have the expected structure
  - otherwise it falls back to a simple numeric heuristic score.

- **Pipeline 3 (outfit generation / weekly plan)**: **Not integrated yet**.
  - There is no production pipeline module wired into `ai-service` yet; only design/docs + a Gradio tester exist.

---

## The #1 mismatch to fix: FashionCLIP fields vs Gemma attributes

Your Updated Strategy extraction prompt is in:

- `Updated_Model_Strategy/instructions/attribute_extraction.txt`

It returns JSON like:

- `category`, `subcategory`, `primary_color`, `pattern`, `fit`, `formality_score`, `occasion_tags`, `season_tags`, `style_keywords`, etc.

**But the backend DB columns are named `fashionclip_*`.**

Right now, Models PC maps these Gemma attributes into:

- `wardrobe_items.fashionclip_main_category`
- `wardrobe_items.fashionclip_sub_category`
- `wardrobe_items.fashionclip_attributes`
- etc.

This is confusing and will cause future bugs because the values are not actually FashionCLIP outputs.

### Choose one approach (backend decision)

**Option A (recommended short-term, minimal changes): keep DB columns but treat them as “AI attributes”, not FashionCLIP**

- Keep writing to `fashionclip_*` columns for now.
- Update backend/docs/UI naming so it is “AI category/subcategory/attributes” (model-agnostic), not “FashionCLIP”.

**Option B (clean long-term): add Gemma-native columns**

- Add new columns in `wardrobe_items`:
  - `gemma_category`, `gemma_subcategory`, `gemma_attributes_json` (JSONB)
- Keep `fashionclip_*` for the real FashionCLIP model later.
- Update backend to read from `gemma_*` columns.

Pick one, then we align everything consistently.

---

## Critical flow bug to fix: “fallback stub writes” should not look like success

Currently, if SAM fails (GPU OOM, 0 detections, etc.), `ai-service/models/stubs.py` catches the exception and returns a **stub/random** classification.

That means:

- `ai_results.status` becomes `completed`
- `wardrobe_items` gets populated with **fake** data

### Required backend sync change

The system must not silently store fake results.

**Required fix on Models PC (`ai-service`)**:

- If the real pipeline fails, set:
  - `ai_results.status='failed'`
  - `ai_results.error_message=<real error>`
  - do **not** overwrite `wardrobe_items` with stub output

If you still want “best-effort fallback”, then:

- write a flag to `ai_results.result`:
  - `"fallback_used": true`
  - `"fallback_reason": "..."`
- and set `ai_results.status='completed'` only when the fallback is deterministic and acceptable.

Backend/UI should show a clear “AI failed” state otherwise.

---

## Pipeline 1: Segment + Extract parameters (must be supported end-to-end)

The Updated Strategy pipeline supports tuning knobs:

- `box_threshold`
- `text_threshold`
- `conf_threshold`
- plus dedupe/fallback knobs (`dedupe_iou_threshold`, `enable_single_item_fallback`, etc.)

### Backend contract (what we should standardize)

Add a `params` object to the classification queue request:

```json
{
  "item_id": "uuid",
  "image_url": "signed_url",
  "ai_result_id": "uuid",
  "params": {
    "box_threshold": 0.25,
    "text_threshold": 0.20,
    "conf_threshold": 0.45,
    "enable_single_item_fallback": true
  }
}
```

Models PC should:

- store `params` into `ai_results.result.input_params` (or another JSON field)
- run the pipeline using those params

If backend doesn’t want to change payload yet, keep defaults on Models PC, but we should still define the desired contract now.

---

## Pipeline 2: Outfit rating parameters (must be forwarded)

Rating uses context parameters:

- `season`, `occasion`, `weather`
- plus (future) style preferences / strictness / user profile features

### Status

- Queue endpoint already passes these parameters into Celery.
- Sync endpoint (`POST /rate/outfit`) was missing forwarding; this is now fixed on Models PC.

### Backend contract (recommended)

Standardize the rating request as:

```json
{
  "outfit_id": "uuid",
  "ai_result_id": "uuid",
  "season": "summer",
  "occasion": "casual",
  "weather": "warm"
}
```

And/or for “rate arbitrary combination”:

```json
{
  "outfit_id": "uuid-or-temp",
  "items": [ ... ],
  "user_profile": { ... },
  "season": "summer",
  "occasion": "casual",
  "weather": "warm",
  "params": {
    "mode": "lightweight",
    "max_tokens": 800
  }
}
```

---

## Pipeline 3: Outfit generation (weekly/day-by-day) — what backend needs to implement next

Pipeline 3 is not wired yet. To get fully synced, backend and models must agree on:

### Inputs (must include day-level params)

- `user_id`
- `week_start_date`
- `day_preferences[]` (per-day):
  - `day_of_week`
  - `occasion`
  - `weather`
  - `season`
  - `style_note`
  - `locked_item_ids[]`
  - `excluded_item_ids[]`
- global defaults (if day prefs missing):
  - `default_occasion`, `default_weather`, `default_season`, `style_preference`

### Output (DB write contract)

Backend must specify exactly where this will be stored:

- Table name(s) (`weekly_outfit_plans` / `generation_jobs` / `recommendations` etc.)
- required columns per day:
  - chosen `item_ids[]`
  - explanation/tips
  - scores (optional)

Once backend confirms tables + shape, Models PC can implement:

- `Updated_Model_Strategy/pipelines/pipeline_3_weekly_generation.py`
- `ai-service/tasks/generation_tasks.py` (Celery)
- a queue endpoint `POST /queue/generate/weekly` (or reuse existing recommendations route)

---

## Current Models PC failure cause + required backend expectation

The recent “SAM did not produce results.json” error is caused by:

- **GroundingDINO CUDA out-of-memory** on large images (e.g. 2000×2000)
- which leads to 0 detections

Fixes already applied on Models PC:

- If 0 detections, SAM script now still writes `results.json` (empty) so the pipeline can proceed/fallback cleanly.
- If CUDA OOM occurs, GroundingDINO retries at downscaled 640px.

Backend should still expect:

- classification can be slower (segmentation can be 20–90s)
- and should treat it as async via `ai_results` status polling (already done).

Also backend should avoid uploading extremely large images if possible:

- recommended: resize uploads on client/backend to ~1024px max dimension (quality stays fine; GPU memory drops a lot)

---

## “Do this now” checklist for backend team

1) **Decide column naming strategy** (Option A vs Option B) for Gemma attribute JSON vs `fashionclip_*`.
2) **Stop treating fallback stub output as success** (prefer `ai_results.status='failed'` on real model failures).
3) **Add params passthrough**:
   - For classification: SAM thresholds + fallback flags
   - For rating: season/occasion/weather + future style parameters
4) **Define Pipeline 3 DB contract** (tables + columns + output JSON).
5) Optional but highly recommended:
   - Resize upload images to reduce GPU OOM.

---

## Reference: the exact attribute extraction schema we are using (Updated Strategy)

This is the output your backend should treat as the “source of truth” attributes for now:

- `Updated_Model_Strategy/instructions/attribute_extraction.txt`

Below is the **full prompt** (verbatim) so backend and models are aligned 1:1.

```text
SYSTEM:
You are a fashion item classifier. Your ONLY task is to analyze a single clothing item image and return a JSON object with its attributes. Always respond with valid JSON only. No preamble, no explanation, no markdown code fences.

USER:
Analyze this clothing item and return ONLY this JSON structure:
{
  "category": "<one of: top, bottom, outerwear, shoe, accessory, dress>",
  "subcategory": "<specific type, e.g. chinos, oxford shirt, bomber jacket>",
  "primary_color": {"name": "<color name>", "hex": "<hex code>"},
  "secondary_colors": ["<color name>", ...],
  "pattern": "<one of: solid, striped, checked, floral, printed, graphic, camouflage, tie-dye, abstract>",
  "pattern_scale": "<one of: none, micro, small, medium, large>",
  "pattern_contrast": "<one of: low, medium, high>",
  "material_estimate": "<e.g. cotton-blend, denim, leather, wool, synthetic>",
  "fabric_weight": "<one of: very_light, light, medium, heavy, very_heavy>",
  "texture_visual": "<one of: smooth, knit, ribbed, fuzzy, tweed, denim, leather_like, suede_like, shiny, matte>",
  "stretch": "<one of: none, low, medium, high>",
  "sheerness": "<one of: opaque, semi_sheer, sheer>",
  "fit": "<one of: slim, regular, relaxed, oversized, tailored, cropped>",
  "silhouette": "<one of: straight, a_line, boxy, draped, bodycon, flared, tapered>",
  "length": "<one of: cropped, hip, longline, mini, midi, maxi, ankle, floor>",
  "rise": "<one of: low, mid, high, n_a>",
  "sleeve_length": "<one of: sleeveless, short, elbow, long, n_a>",
  "neckline_or_collar": "<one of: crew, v_neck, scoop, turtleneck, collared, polo, hooded, strapless, halter, n_a>",
  "closure": "<one of: none, buttons, zipper, laces, buckle, slip_on, snap, velcro>",
  "toe_shape": "<one of: round, square, pointed, open_toe, n_a>",
  "heel_height": "<one of: flat, low, mid, high, n_a>",
  "layering_role": "<one of: base, mid, outer, n_a>",
  "formality_score": <integer 1-5, where 1=very casual, 5=very formal>,
  "occasion_tags": ["<from: casual, smart_casual, business_casual, business_formal, evening, athletic, outdoor>"],
  "season_tags": ["<from: spring, summer, autumn, winter, all_season>"],
  "color_family": "<one of: neutral, warm, cool, mixed>",
  "style_keywords": ["<short tags like: minimal, classic, preppy, streetwear, sporty, boho, edgy, feminine, masculine, vintage, workwear>"],
  "brand_visible": "<string or null>",
  "logo_visible": <true/false>,
  "condition_estimate": "<one of: new_like, good, worn, distressed>"
}
Return ONLY the JSON object. Nothing else.
```

