-- 021_recommendations.sql
-- Stores AI-generated outfit recommendations per user

CREATE TABLE public.recommendations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- The items that make up this recommendation
  -- Stored as an array of wardrobe item UUIDs
  item_ids      UUID[] NOT NULL,

  -- Occasion this recommendation is suited for
  occasion      outfit_occasion_enum,

  -- AI scores — populated by Celery rating job
  ai_rating           DECIMAL(3,1),
  ai_color_score      DECIMAL(3,1),
  ai_proportion_score DECIMAL(3,1),
  ai_style_score      DECIMAL(3,1),
  ai_feedback         TEXT,
  ai_status           ai_status_enum DEFAULT 'pending',

  -- Link to ai_results row for this recommendation
  ai_result_id  UUID REFERENCES public.ai_results(id) ON DELETE SET NULL,

  -- User interaction
  is_saved      BOOLEAN DEFAULT FALSE,
  is_dismissed  BOOLEAN DEFAULT FALSE,

  -- If user saves it, a full outfit record is created
  saved_outfit_id UUID REFERENCES public.outfits(id) ON DELETE SET NULL,

  -- Soft delete + timestamps
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

-- Users can manage their own recommendations
CREATE POLICY users_manage_own_recommendations
  ON public.recommendations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can insert/update (Celery worker writes scores)
CREATE POLICY service_role_manages_recommendations
  ON public.recommendations
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Indexes
CREATE INDEX idx_recommendations_user_id
  ON public.recommendations(user_id);

CREATE INDEX idx_recommendations_user_status
  ON public.recommendations(user_id, ai_status)
  WHERE deleted_at IS NULL AND is_dismissed = FALSE;

CREATE INDEX idx_recommendations_user_saved
  ON public.recommendations(user_id, is_saved)
  WHERE is_saved = TRUE;

-- updated_at trigger
CREATE TRIGGER trg_recommendations_updated_at
  BEFORE UPDATE ON public.recommendations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();