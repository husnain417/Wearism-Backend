# Wearism AI Integration — Implementation Status + Models-PC Handoff (2026-04-15)

This document is meant to be **pasted into the models PC codebase** (the machine that has the real checkpoints and GPU). It summarizes:

- What is **already implemented** in the current backend + `ai-service/`
- What is currently **stubbed / incomplete**
- The **runtime flow** today (Node backend → FastAPI bridge → Celery → Supabase)
- A **proposed integration plan** to swap the stubs with real models while keeping the backend stable
- Concrete **API contracts** and **implementation checklist** for the models PC

---

## 1) Current architecture (what exists right now)

### 1.1 Services

- **Node backend** (`Wearism-Backend/backend/`)
  - Main API server (Fastify) used by mobile + frontend.
  - Creates DB rows in Supabase and triggers AI jobs.

- **Python AI service** (`Wearism-Backend/ai-service/`)
  - FastAPI app that exposes:
    - **Synchronous model endpoints** (`/classify/clothing`, `/rate/outfit`, `/analyse/user`) — currently calling stubs.
    - **Queue bridge endpoints** (`/queue/...`) that enqueue Celery tasks and return immediately.
  - Celery workers execute tasks and **write results directly to Supabase** using the **service role key**.

### 1.2 Security constraints (important on models PC)

- FastAPI requires header **`X-Internal-Secret`** to match `AI_SHARED_SECRET`.
- FastAPI currently enables `TrustedHostMiddleware` with **allowed_hosts** set to `localhost`, `127.0.0.1`, `::1`.
  - That means **remote Node servers cannot call it over LAN** unless you change this.
  - Proposed solution is in §5.3 (reverse proxy / allowlist / mTLS-like shared secret).

---

## 2) “Model-related implementation status” (what is real vs stub)

### 2.1 Implemented and working plumbing (real)

#### Node backend → creates work + triggers AI

- **Wardrobe item upload**:
  - Route: `POST /wardrobe/items` (multipart)
  - Creates `wardrobe_items` row + uploads image to Supabase Storage.
  - Creates `ai_results` row with `task_type='clothing_classification'`.
  - Calls FastAPI queue endpoint via `backend/src/services/aiQueue.js`:
    - `POST {AI_SERVICE_URL}/queue/classify/clothing`

- **Outfit creation → AI rating queued**:
  - Route: `POST /wardrobe/outfits` (JSON)
  - Creates `outfits` row (+ `outfit_items` junction rows).
  - Creates `ai_results` row with `task_type='outfit_rating'`.
  - Calls FastAPI queue endpoint:
    - `POST {AI_SERVICE_URL}/queue/rate/outfit`

- **Recommendations generation → AI rating queued**:
  - Route: `POST /recommendations/generate`
  - Creates `recommendations` rows + `ai_results` rows.
  - Fetches wardrobe details and calls:
    - `POST {AI_SERVICE_URL}/queue/rate/recommendation`

#### FastAPI queue bridge → Celery → Supabase writes

FastAPI endpoints (real, used by Node):

- `POST /queue/classify/clothing` → Celery task: `tasks.clothing_tasks.classify_clothing`
- `POST /queue/rate/outfit` → Celery task: `tasks.outfit_tasks.rate_outfit`
- `POST /queue/rate/recommendation` → Celery task: `tasks.outfit_tasks.rate_recommendation`
- `POST /queue/analyse/user` → Celery task: `tasks.user_tasks.analyse_user`

Celery is configured (real):

- Uses Redis (`REDIS_URL`) as broker + backend
- Has reliability settings (`acks_late`, retry/backoff, time limits)
- Separate queues: `clothing`, `outfits`, `users`

Supabase writes (real):

- `ai-service/db/supabase_client.py` uses `SUPABASE_SERVICE_ROLE_KEY` to update:
  - `ai_results`
  - `wardrobe_items`
  - `outfits`
  - `recommendations` (directly inside `rate_recommendation`)

### 2.2 Stubbed / not-real-yet (models)

In `ai-service/models/stubs.py`, these are still fake:

- `classify_clothing_model(image_url, item_id)`  
  - Should become **FashionCLIP item classification + feature extraction** (dominant colors/pattern/texture/formality + slot/tag mapping).
- `rate_outfit_model(outfit_id, items, user_profile, season, occasion, weather)`  
  - Should become the **real rating engine call** (and optional Outfit Transformer compatibility).
- `analyse_user_model(image_url, user_id)`  
  - Should become the real CV pipeline (age/height) if you still want it.

**Good news**: the stubs were written with “replace body only” intent. The surrounding service architecture does not need to change for a first integration.

---

## 3) Current runtime flow (end-to-end)

### 3.1 Wardrobe item classification (current flow)

1) Mobile uploads image to Node endpoint `POST /wardrobe/items`.
2) Node stores image in Supabase Storage and writes `wardrobe_items` (AI fields null).
3) Node writes a pending `ai_results` row and calls FastAPI:
   - `POST /queue/classify/clothing` with `item_id`, `image_url`, `ai_result_id`.
4) Celery worker runs:
   - Calls `classify_clothing_model(...)` (currently stub)
   - Updates `wardrobe_items` with:
     - `wardrobe_slot`, `fashionclip_*`, `color_dominant_rgb`, `pattern_strength`, `texture_score`, `formality_score`, `is_accessory`, `tag`
   - Updates `ai_results` status/result/model_version.
5) Mobile polls:
   - `GET /wardrobe/items/:id/ai-status`

### 3.2 Recommendation rating (current flow)

1) Node generates item combinations from wardrobe.
2) Node inserts `recommendations` rows, inserts `ai_results` rows, then calls:
   - `POST /queue/rate/recommendation`
   - Payload includes `items[]` (Node maps wardrobe rows → simplified OutfitItem shape)
3) Celery task writes scores into `recommendations` table (`ai_rating`, `ai_feedback`, etc.) and completes `ai_results`.

### 3.3 Outfit rating (current flow)

1) Node creates an outfit row and outfit_items.
2) Node inserts `ai_results` and calls:
   - `POST /queue/rate/outfit`
3) Celery task fetches outfit items from Supabase then calls `rate_outfit_model(...)` (stub), writes scores to `outfits`.

---

## 4) Known gaps / mismatches you should be aware of

### 4.1 The “big docs pipeline” is not implemented in code yet

Backend docs in `docs/ai-integration/AI_MODELS_BACKEND_INTEGRATION.md` describe a **photo-based outfit rating** pipeline:

**SAM → FashionCLIP → Outfit Transformer (optional) → Rule-based rating engine**  

But the currently deployed backend flow for rating uses:

- **Outfit rating from wardrobe items** (DB-driven item lists) rather than “upload one outfit photo”.
- An **older, simplified outfit rating contract** (`items: [{item_id, category, colors, pattern?, fit?}]`) rather than the full breakdown.

This is OK for incremental integration: you can first swap in a “real-ish” rating engine using the item metadata and optionally pull image bytes.

### 4.2 Node has two AI call mechanisms; only one is actively used

- `backend/src/services/aiQueue.js` (active): calls FastAPI `/queue/...` endpoints (Celery).
- `backend/src/services/aiService.js` (mostly unused now): calls synchronous endpoints `/classify/clothing`, `/rate/outfit`, `/analyse/user`.

Recommendation generation uses `aiQueue`. Wardrobe upload uses `aiQueue`. Outfit rating uses `aiQueue`.

### 4.3 Outfit rating Celery task queries older wardrobe columns

`ai-service/tasks/outfit_tasks.py` (rate_outfit) currently queries:

- `wardrobe_items(id, category, colors, pattern, fit)`

But the newer classification pipeline writes fields like:

- `fashionclip_main_category`, `fashionclip_attributes`, `color_dominant_rgb`, `pattern_strength`, etc.

If your Supabase schema no longer includes `category/colors/pattern/fit` (or they’re empty), **rate_outfit may be operating on missing data**.

**Recommended fix on models PC**: update `rate_outfit` task to fetch and use the newer fields (see §5.2).

### 4.4 Current “clothing classification” is assumed to be per-item (no SAM)

Wardrobe item upload is a single item image. The current contract does not include SAM segmentation output.
That aligns with your docs: wardrobe upload should run FashionCLIP and feature extraction; SAM is only needed for “outfit photo rating”.

---

## 5) Proposed integration plan (practical, minimal breakage)

### 5.1 Phase A — Replace stubs with real models, keep existing endpoints/contracts

Goal: Make the system produce real outputs without changing Node endpoints.

Do on models PC (Python):

1) Implement real `classify_clothing_model(image_url, item_id)`:
   - Download the image bytes from `image_url`.
   - Run FashionCLIP on the image.
   - Compute:
     - `wardrobe_slot` mapping (main_category → 4-slot system)
     - `tag` / `is_accessory`
     - `color_dominant_rgb` (k-means or equivalent)
     - `pattern_strength` (Laplacian variance normalized)
     - `texture_score` (Sobel magnitude normalized)
     - `formality_score` (rule mapping from subcategory/attributes)
     - Optional `fashionclip_image_vector` (512-d embedding)
   - Return the exact `ClassifyClothingResponse` shape already defined.

2) Implement real `rate_outfit_model(...)` to produce **at least**:
   - `rating`, `color_score`, `proportion_score`, `style_score`, `feedback[]`
   - And preferably `breakdown` in a dict compatible with your docs
   - If you have Outfit Transformer checkpoint: include `compatibility_score`

3) (Optional) implement `analyse_user_model(...)` if used.

This phase will make:

- `wardrobe_items` get populated with meaningful data.
- `recommendations` get real `ai_rating` etc.
- `outfits` get real `ai_rating` etc.

### 5.2 Phase B — Align the DB-driven rating tasks with the newer FashionCLIP fields

Update `ai-service/tasks/outfit_tasks.py`:

- In `rate_outfit`, instead of selecting `category/colors/pattern/fit`, pull:
  - `fashionclip_main_category`
  - `fashionclip_sub_category`
  - `fashionclip_attributes`
  - `color_dominant_rgb` / or stored `colors` if you keep it
  - `pattern_strength` / `texture_score` / `formality_score`
  - `is_accessory`, `tag`

Then build the `items[]` you pass into `rate_outfit_model` using those fields.

Why: your Node code is already migrating toward FashionCLIP fields (recommendations pass FashionCLIP-derived data).

### 5.3 Phase C — Add the “full photo outfit rating” pipeline as a new feature (optional)

If you want the docs’ feature “upload one outfit photo and rate it”, implement new endpoints (FastAPI side):

- `POST /outfit/rate-photo` (multipart)
  - Runs SAM segmentation + FashionCLIP + optional transformer + rating engine.

Then add a new Node route:

- `POST /ai/outfit/rate-photo` that proxies upload to the models service (or stores image and passes URL).

This is separate from the wardrobe-driven outfit rating and can be added later.

---

## 6) Concrete API contracts (what Node sends today)

### 6.1 Queue clothing classification

Node calls:

- `POST {AI_SERVICE_URL}/queue/classify/clothing`
- Headers: `X-Internal-Secret: <AI_SHARED_SECRET>`
- JSON:

```json
{
  "image_url": "https://...signed-supabase-url...",
  "item_id": "uuid",
  "ai_result_id": "uuid"
}
```

Expected result on completion (written to Supabase):

- `wardrobe_items` updated with FashionCLIP-derived fields
- `ai_results` updated to `completed` with a JSON `result`

### 6.2 Queue recommendation rating

Node calls:

- `POST {AI_SERVICE_URL}/queue/rate/recommendation`
- Headers: `X-Internal-Secret: <AI_SHARED_SECRET>`
- JSON:

```json
{
  "recommendation_id": "uuid",
  "ai_result_id": "uuid",
  "user_id": "uuid",
  "season": "summer",
  "occasion": "casual",
  "weather": "warm",
  "items": [
    { "item_id": "uuid", "category": "tops", "colors": ["white","black"], "pattern": "solid", "fit": "regular" }
  ]
}
```

You can interpret `category/colors/pattern/fit` as “lightweight features”. If you have access to wardrobe item images on the models PC, you may enhance rating using image-based extractors, but keep the signature.

### 6.3 Queue outfit rating

Node calls:

- `POST {AI_SERVICE_URL}/queue/rate/outfit`
- Headers: `X-Internal-Secret: <AI_SHARED_SECRET>`
- JSON:

```json
{
  "outfit_id": "uuid",
  "ai_result_id": "uuid",
  "season": "summer",
  "occasion": "casual",
  "weather": "warm"
}
```

Celery task then fetches outfit items from Supabase and calls the model function.

---

## 7) Models-PC implementation checklist (copy/paste plan)

### 7.1 Environment variables required on models PC

Set these in `.env` for `ai-service/`:

- `AI_SHARED_SECRET` (must equal Node `AI_SHARED_SECRET`)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REDIS_URL`

Plus model paths (recommendation from docs; adjust to your real folders):

- `FASHIONCLIP_MODEL_PATH=/abs/path/to/fashion-clip/hf_model` (optional)
- `OT_CHECKPOINT_PATH=/abs/path/to/outfit-transformer/checkpoints/<file>.pth` (optional)
- `CUDA_VISIBLE_DEVICES=0` (if needed)

### 7.2 Implement real clothing classification (`classify_clothing_model`)

**Replace only the body** in `ai-service/models/stubs.py`:

- Download image bytes from `image_url` (signed Supabase URL).
- Load FashionCLIP once (singleton, cached).
- Run classification, produce:
  - `fashionclip_main_category`, `fashionclip_sub_category`, `fashionclip_attributes`
  - `wardrobe_slot` mapping (same mapping as docs)
  - `tag` mapping (upperwear→shirt, lowerwear→pants, outerwear→jacket/coat, shoes→shoes)
  - `is_accessory`
  - `color_dominant_rgb` via k-means on pixels
  - `pattern_strength` via Laplacian variance (normalize to 0–1)
  - `texture_score` via Sobel magnitude (normalize to 0–1)
  - `formality_score` rule-based from subcategory/attributes
  - optional `fashionclip_image_vector` embedding
  - `confidence` (use top-1 similarity)
  - `model_version` real version string (include commit hash/checkpoint name if possible)

### 7.3 Implement real outfit rating (`rate_outfit_model`)

Minimum: keep returning `RateOutfitResponse` (rating + 3 subscores + feedback).

Preferred: return richer fields:

- `breakdown` dict per your docs (color harmony, layering, texture, etc.)
- `compatibility_score` if OT checkpoint loaded

If your real rating engine needs images:

- Option A: use purely metadata-based heuristics for Phase A.
- Option B: for each item_id, fetch its image URL from Supabase inside the task, download, and run extractors.

### 7.4 Update Celery DB-fetch logic for outfit rating (recommended)

Update `ai-service/tasks/outfit_tasks.py` to select the fields you actually store:

- Use `fashionclip_*`, `color_dominant_rgb`, `pattern_strength`, `texture_score`, `formality_score`, `tag`, `is_accessory`.

Build the `OutfitItem` list passed to the rating function from these.

### 7.5 FastAPI network exposure strategy (models PC)

If the models PC is separate from the Node backend machine, you have three safe options:

- **Option 1 (recommended)**: Run FastAPI behind a reverse proxy (Nginx/Caddy) that:
  - Restricts IP allowlist to the Node backend machine(s)
  - Forwards `X-Internal-Secret`
  - Terminates TLS
  - Then expand `TrustedHostMiddleware` to include the proxy hostname/IP.

- **Option 2**: Expand `allowed_hosts` in `ai-service/main.py` to your LAN hostnames/IPs.
  - Keep `X-Internal-Secret` and also enforce an IP allowlist at OS firewall level.

- **Option 3**: Keep FastAPI local only and run Node and FastAPI on the same machine (not your case).

---

## 8) What I recommend you implement first (fastest path to “real models integrated”)

1) **FashionCLIP-only** wardrobe classification (real) + feature extraction.
2) **Rule-based rating engine** for recommendations and outfits using the FashionCLIP outputs (and optional image-based features if easy).
3) Add **Outfit Transformer** checkpoint support (optional but powerful).
4) Add **SAM-based outfit photo rating** as a new endpoint once the above is stable.

---

## 9) Quick “integration truth table”

- **Backend queueing & DB writing**: ✅ implemented (Node → FastAPI → Celery → Supabase)
- **Model execution**: ❌ stubbed (replace bodies in `ai-service/models/stubs.py`)
- **Docs “full photo pipeline”**: ❌ not wired into Node yet (optional Phase C)
- **Outfit rating task DB fields**: ⚠️ likely needs alignment (Phase B)

