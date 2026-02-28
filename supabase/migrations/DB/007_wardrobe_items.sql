-- 007_wardrobe_items.sql

CREATE TABLE public.wardrobe_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Core item data
  name          TEXT,                          -- optional user label e.g. 'Blue Work Shirt'
  image_url     TEXT,                          -- Supabase Storage signed URL
  image_path    TEXT,                          -- storage path for deletion

  -- AI-classified attributes (populated by Phase 4 AI module)
  category      clothing_category_enum,
  subcategory   TEXT,                          -- e.g. 't-shirt', 'jeans', 'blazer'
  colors        TEXT[],                        -- array e.g. ['navy', 'white']
  pattern       TEXT,                          -- e.g. 'solid', 'striped', 'floral'
  fit           clothing_fit_enum,
  fabric        TEXT,                          -- e.g. 'cotton', 'polyester'
  season        clothing_season_enum,
  occasion      outfit_occasion_enum[],        -- array — item can suit multiple occasions

  -- User-provided metadata
  brand         TEXT,
  purchase_price DECIMAL(10,2),
  condition     clothing_condition_enum DEFAULT 'good',
  is_favourite  BOOLEAN DEFAULT FALSE,
  times_worn    INTEGER DEFAULT 0,
  last_worn_at  DATE,

  -- Resale
  is_for_sale   BOOLEAN DEFAULT FALSE,
  resale_price  DECIMAL(10,2),

  -- Embeddings for similarity search (Phase 5)
  embedding     vector(512),                   -- clothing feature vector from AI

  -- Soft delete + timestamps
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
