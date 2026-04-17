ALTER TYPE ai_task_enum ADD VALUE IF NOT EXISTS 'outfit_photo_rating';

CREATE TABLE IF NOT EXISTS public.outfit_photo_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_path TEXT,
  gender TEXT,
  occasion TEXT,
  weather TEXT,
  season TEXT,
  style_preference TEXT,
  mode_used TEXT,
  ai_result_id UUID NOT NULL REFERENCES public.ai_results(id) ON DELETE CASCADE,
  rating NUMERIC,
  color_score NUMERIC,
  proportion_score NUMERIC,
  style_score NUMERIC,
  compatibility_score NUMERIC,
  breakdown JSONB,
  feedback JSONB,
  strengths JSONB,
  improvements JSONB,
  dominant_aesthetic TEXT,
  color_harmony_type TEXT,
  items_analyzed JSONB,
  num_items INTEGER,
  warnings JSONB,
  latency_s JSONB,
  model_version TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_outfit_photo_ratings_ai_result_id
  ON public.outfit_photo_ratings(ai_result_id);

CREATE INDEX IF NOT EXISTS idx_outfit_photo_ratings_user_created
  ON public.outfit_photo_ratings(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_outfit_photo_ratings_created
  ON public.outfit_photo_ratings(created_at DESC);
