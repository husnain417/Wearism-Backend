ALTER TYPE clothing_season_enum ADD VALUE IF NOT EXISTS 'fall';
ALTER TYPE outfit_occasion_enum ADD VALUE IF NOT EXISTS 'business';
ALTER TYPE outfit_occasion_enum ADD VALUE IF NOT EXISTS 'smart_casual';
ALTER TYPE outfit_occasion_enum ADD VALUE IF NOT EXISTS 'streetwear';
ALTER TYPE outfit_occasion_enum ADD VALUE IF NOT EXISTS 'athleisure';
ALTER TYPE outfit_occasion_enum ADD VALUE IF NOT EXISTS 'old_money';
ALTER TYPE outfit_occasion_enum ADD VALUE IF NOT EXISTS 'party';
ALTER TYPE outfit_occasion_enum ADD VALUE IF NOT EXISTS 'black_tie';
ALTER TYPE outfit_occasion_enum ADD VALUE IF NOT EXISTS 'wedding';
CREATE TYPE weather_enum AS ENUM ('hot', 'warm', 'mild', 'cool', 'cold');

-- ═══════════════════════════════════════════════════════
-- PART 1: Migrate season data
-- ═══════════════════════════════════════════════════════

UPDATE public.wardrobe_items
SET season = 'fall'
WHERE season = 'autumn';


-- ═══════════════════════════════════════════════════════
-- PART 2: Migrate occasion data
-- ═══════════════════════════════════════════════════════

UPDATE public.outfits SET occasion = 'business'     WHERE occasion = 'business_casual';
UPDATE public.outfits SET occasion = 'athleisure'   WHERE occasion = 'athletic';
UPDATE public.outfits SET occasion = 'party'        WHERE occasion = 'evening';
UPDATE public.outfits SET occasion = 'smart_casual' WHERE occasion = 'date_night';

UPDATE public.recommendations SET occasion = 'business'   WHERE occasion = 'business_casual';
UPDATE public.recommendations SET occasion = 'athleisure' WHERE occasion = 'athletic';


-- ═══════════════════════════════════════════════════════
-- PART 4: Add new model columns to wardrobe_items
-- ═══════════════════════════════════════════════════════

ALTER TABLE public.wardrobe_items
  ADD COLUMN IF NOT EXISTS wardrobe_slot            VARCHAR(20)
    CHECK (wardrobe_slot IN ('upperwear','outerwear','lowerwear','accessories')),
  ADD COLUMN IF NOT EXISTS fashionclip_main_category VARCHAR(50),
  ADD COLUMN IF NOT EXISTS fashionclip_sub_category  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS fashionclip_attributes    TEXT[],
  ADD COLUMN IF NOT EXISTS fashionclip_description   TEXT,
  ADD COLUMN IF NOT EXISTS fashionclip_image_vector  FLOAT[],
  ADD COLUMN IF NOT EXISTS color_dominant_rgb        JSONB,
  ADD COLUMN IF NOT EXISTS pattern_strength          FLOAT,
  ADD COLUMN IF NOT EXISTS texture_score             FLOAT,
  ADD COLUMN IF NOT EXISTS formality_score           FLOAT,
  ADD COLUMN IF NOT EXISTS is_accessory              BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tag                       VARCHAR(50),
  ADD COLUMN IF NOT EXISTS sam_label                 VARCHAR(50),
  ADD COLUMN IF NOT EXISTS sam_confidence            FLOAT;

COMMENT ON COLUMN public.wardrobe_items.category IS 'DEPRECATED — use wardrobe_slot + fashionclip_main_category';
COMMENT ON COLUMN public.wardrobe_items.colors   IS 'DEPRECATED — use color_dominant_rgb';
COMMENT ON COLUMN public.wardrobe_items.pattern  IS 'DEPRECATED — use pattern_strength';
COMMENT ON COLUMN public.wardrobe_items.fit      IS 'DEPRECATED — use fashionclip_attributes';
COMMENT ON COLUMN public.wardrobe_items.season   IS 'DEPRECATED — use fashionclip_attributes';


-- ═══════════════════════════════════════════════════════
-- PART 5: Add weather column to outfits + recommendations
-- ═══════════════════════════════════════════════════════

ALTER TABLE public.outfits
  ADD COLUMN IF NOT EXISTS weather weather_enum;

ALTER TABLE public.recommendations
  ADD COLUMN IF NOT EXISTS weather       weather_enum,
  ADD COLUMN IF NOT EXISTS sample_size   INT DEFAULT 25,
  ADD COLUMN IF NOT EXISTS overall_score FLOAT;


-- ═══════════════════════════════════════════════════════
-- PART 6: Indexes
-- ═══════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_wardrobe_items_user_slot
  ON public.wardrobe_items(user_id, wardrobe_slot)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_wardrobe_items_user_active
  ON public.wardrobe_items(user_id, is_accessory)
  WHERE deleted_at IS NULL;


-- ═══════════════════════════════════════════════════════
-- PART 7: wardrobe_generation_jobs
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.wardrobe_generation_jobs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  season       clothing_season_enum,
  occasion     outfit_occasion_enum,
  weather      weather_enum,
  num_outfits  INT DEFAULT 3,
  sample_size  INT DEFAULT 25,
  status       VARCHAR(20) DEFAULT 'pending'
               CHECK (status IN ('pending','processing','completed','failed')),
  error_message TEXT,
  result_recommendation_ids UUID[],
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.wardrobe_generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_manage_own_generation_jobs
  ON public.wardrobe_generation_jobs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_generation_jobs_user
  ON public.wardrobe_generation_jobs(user_id, created_at DESC);