-- 011_ai_results.sql

CREATE TABLE public.ai_results (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- What type of analysis was requested
  task_type       ai_task_enum NOT NULL,
  status          ai_status_enum DEFAULT 'pending',

  -- Input references (nullable — depends on task type)
  wardrobe_item_id UUID REFERENCES public.wardrobe_items(id) ON DELETE SET NULL,
  outfit_id        UUID REFERENCES public.outfits(id) ON DELETE SET NULL,

  -- Raw result stored as JSONB — flexible for all AI output types
  result          JSONB,

  -- Example result structures:
  -- clothing_classification: {category, subcategory, colors, pattern, confidence}
  -- outfit_rating: {rating, color_score, proportion_score, style_score, feedback}
  -- age_estimation: {age_range, confidence}
  -- height_estimation: {height_cm, confidence}

  -- Performance tracking
  processing_time_ms INTEGER,
  model_version      TEXT,
  error_message      TEXT,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
