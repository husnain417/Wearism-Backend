# Wardrobe Item Classification — Implementation Status (Laptop-side) (2026-04-16)

This document describes the **current, real implementation** of wardrobe item classification in the Wearism system from the perspective of the **laptop Node backend** (Fastify) and shared Supabase DB/storage contract.

It covers:
- The **exact request flow** from image upload to DB updates
- The **HTTP payloads** used between Node and the FastAPI AI service
- The **Supabase tables/columns** involved
- Where the **classification results land**
- How the **mobile app reads/polls** the state

> Note: model execution happens in the Python `ai-service` (running on the Models PC). The laptop backend only uploads the image, creates DB rows, and triggers the AI job via HTTP.

---

## 1) High-level flow (what happens today)

### Step A — Mobile → Node: upload item image

Endpoint (Node/Fastify):
- `POST /wardrobe/items` (multipart/form-data)

Implementation:
- `backend/src/modules/wardrobe/wardrobe.controller.js` → `wardrobeService.createItem(...)`

### Step B — Node → Supabase Storage: store image

Bucket:
- `wardrobe`

Path format:
- `image_path = "${userId}/${item_id}.jpg"`

Then Node generates a signed URL (1-year TTL) and stores it on the DB row as:
- `wardrobe_items.image_url = <signed url>`
- `wardrobe_items.image_path = <storage path>`

### Step C — Node → Supabase DB: create `wardrobe_items`

Table:
- `public.wardrobe_items`

At creation time, **AI fields are NULL** (classification hasn’t run yet), e.g.:
- `wardrobe_slot: null`
- `fashionclip_main_category: null`
- `fashionclip_sub_category: null`
- `fashionclip_attributes: null`

### Step D — Node → Supabase DB: create a pending `ai_results` job row

Table:
- `public.ai_results`

Inserted row fields:
- `user_id = <current user>`
- `wardrobe_item_id = <wardrobe_items.id>`
- `task_type = 'clothing_classification'`
- `status = 'pending'`

### Step E — Node → FastAPI (Models PC): enqueue Celery classification

Node calls the FastAPI queue bridge via `backend/src/services/aiQueue.js`.

HTTP call:
- `POST {AI_SERVICE_URL}/queue/classify/clothing`
- Header: `X-Internal-Secret: ${AI_SHARED_SECRET}`
- JSON body:

```json
{
  "item_id": "<wardrobe_item_id>",
  "image_url": "<signed_supabase_url>",
  "ai_result_id": "<ai_results_id>"
}
```

Node does **fire-and-forget** dispatch and retries once (2 seconds delay) if the first attempt fails.

### Step F — Celery (Models PC) → Supabase DB: write classification result

Celery task:
- `ai-service/tasks/clothing_tasks.py::classify_clothing(item_id, image_url, ai_result_id)`

It updates:

1) `ai_results.status` → `processing`
2) Calls the model function:
   - `ai-service/models/stubs.py::classify_clothing_model(image_url, item_id)` (currently stub unless replaced with real model)
3) Updates `wardrobe_items` with the classification output fields (see §3)
4) Updates `ai_results`:
   - `status = completed|failed`
   - `result = <full JSON>`
   - `processing_time_ms`
   - `model_version`
   - `error_message` if failed

---

## 2) Where the “classification state” is read in the app

### A) Mobile polls AI status (per item)

Node endpoint:
- `GET /wardrobe/items/:id/ai-status`

Implementation:
- `wardrobe.controller.js::getAiStatus`
- Reads latest row from `ai_results` for that wardrobe item:
  - `select status, result, error_message, processing_time_ms`
  - filters by:
    - `wardrobe_item_id = :id`
    - `task_type = 'clothing_classification'`
  - ordered by newest first

### B) Mobile reads the actual classified fields from `wardrobe_items`

Node endpoint:
- `GET /wardrobe/items` (list)
- `GET /wardrobe/items/:id` (single)

These return the `wardrobe_items` row which includes classification columns once the Celery task writes them.

---

## 3) Database schema — classification-related columns

### 3.1 `public.ai_results` (job tracking)

Defined in:
- `supabase/migrations/DB/011_ai_results.sql`

Important columns:
- `task_type` (`ai_task_enum`) → includes `clothing_classification`
- `status` (`ai_status_enum`) → `pending|processing|completed|failed`
- `wardrobe_item_id` → links job to the item
- `result` (`JSONB`) → stores full model response JSON
- `processing_time_ms`, `model_version`, `error_message`

### 3.2 `public.wardrobe_items` (classification output landing zone)

Base table defined in:
- `supabase/migrations/DB/007_wardrobe_items.sql`

Newer model-aligned columns added in:
- `supabase/migrations/DB/022_model_alignment.sql`

**Primary “new pipeline” columns written by classification** (the ones your UI is using):

- `wardrobe_slot` (4-slot system)
  - `upperwear | outerwear | lowerwear | accessories`
- `fashionclip_main_category` (string)
- `fashionclip_sub_category` (string)
- `fashionclip_attributes` (text[])
- `fashionclip_description` (text)
- `fashionclip_image_vector` (float[] optional)
- `color_dominant_rgb` (jsonb) e.g. `[[r,g,b],[r,g,b],[r,g,b]]`
- `pattern_strength` (float)
- `texture_score` (float)
- `formality_score` (float)
- `is_accessory` (boolean)
- `tag` (string) used by rating engine e.g. `shirt|pants|jacket/coat|shoes|accessories`
- `sam_label`, `sam_confidence` (optional; typically null for standalone wardrobe upload)

**Older/deprecated columns** still exist in the table:
- `category`, `subcategory`, `colors`, `pattern`, `fit`, `season` (now marked “DEPRECATED” by comments in `022_model_alignment.sql`)

The current Celery classification task writes mainly to the **newer fields** listed above.

---

## 4) Payload shape (what the model returns)

The FastAPI schema for classification is defined in:
- `ai-service/schemas/requests.py::ClassifyClothingResponse`

It returns:
- `wardrobe_slot`
- FashionCLIP fields (`fashionclip_*`)
- numeric features (`color_dominant_rgb`, `pattern_strength`, `texture_score`, `formality_score`)
- helper flags (`is_accessory`, `tag`)
- optional SAM outputs
- `confidence`, `model_version`

Celery stores the full response in:
- `ai_results.result` (JSONB)

And it maps fields into:
- `wardrobe_items` columns (as above)

---

## 5) Laptop-side “what runs where” summary

### On the laptop (Node backend)
- Handles `POST /wardrobe/items` upload
- Uploads bytes to Supabase Storage `wardrobe` bucket
- Inserts `wardrobe_items` row (AI fields null initially)
- Inserts `ai_results` row (pending)
- Calls FastAPI queue endpoint over HTTP:
  - `POST {AI_SERVICE_URL}/queue/classify/clothing`

### On the Models PC (Python)
- FastAPI receives `/queue/classify/clothing`
- Enqueues Celery task `tasks.clothing_tasks.classify_clothing`
- Celery runs the model function (stub or real) and writes to Supabase:
  - updates `wardrobe_items`
  - updates `ai_results`

---

## 6) Quick verification checklist (practical)

1) Upload item from mobile → Node returns 201 with `ai_status: pending`
2) In Supabase:
   - a new `wardrobe_items` row exists with `wardrobe_slot = null`
   - a new `ai_results` row exists with `status = pending` and `task_type = clothing_classification`
3) Models PC logs show `/queue/classify/clothing` request arrived
4) Celery updates `ai_results.status` → `processing` → `completed`
5) `wardrobe_items` row now contains:
   - `wardrobe_slot`
   - `fashionclip_attributes` (etc)
6) Mobile item detail should show:
   - category + attributes
   - and (if enabled in UI) raw AI JSON preview

