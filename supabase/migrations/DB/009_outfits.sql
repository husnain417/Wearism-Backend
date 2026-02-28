-- 009_outfits.sql

-- Outfits table — a named collection of wardrobe items
CREATE TABLE public.outfits (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  name          TEXT,
  occasion      outfit_occasion_enum,
  status        outfit_status_enum DEFAULT 'draft',
  cover_image_url TEXT,                        -- generated preview image

  -- AI rating results
  ai_rating         DECIMAL(3,1),              -- e.g. 7.8 out of 10
  ai_color_score    DECIMAL(3,1),
  ai_proportion_score DECIMAL(3,1),
  ai_style_score    DECIMAL(3,1),
  ai_feedback       TEXT,                      -- human-readable AI suggestions

  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table — which items are in which outfit
CREATE TABLE public.outfit_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  outfit_id     UUID NOT NULL REFERENCES public.outfits(id) ON DELETE CASCADE,
  item_id       UUID NOT NULL REFERENCES public.wardrobe_items(id) ON DELETE CASCADE,
    position      INTEGER,                       -- ordering within outfit (top, bottom, shoes etc)
  created_at    TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent same item appearing twice in one outfit
  UNIQUE(outfit_id, item_id)
);
