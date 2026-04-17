-- 028_campaigns.sql
-- Campaigns (custom + AI) + event tracking + attribution hooks.

-- ── ENUMS ────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE campaign_type_enum AS ENUM ('custom', 'ai');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE campaign_status_enum AS ENUM ('draft', 'active', 'paused', 'ended');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE campaign_event_type_enum AS ENUM (
    'impression',
    'open',
    'swipe',
    'product_click',
    'add_to_cart',
    'checkout',
    'purchase'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── CAMPAIGNS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaigns (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id         UUID NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,

  type              campaign_type_enum   NOT NULL DEFAULT 'custom',
  status            campaign_status_enum NOT NULL DEFAULT 'draft',

  motive            TEXT,
  title             TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
  description       TEXT,

  cover_image_url   TEXT,
  cover_image_path  TEXT,

  -- Optional targeting v1 (simple filters; embeddings later)
  target_gender     gender_enum,
  min_age           INT CHECK (min_age BETWEEN 13 AND 99),
  max_age           INT CHECK (max_age BETWEEN 13 AND 99),

  start_at          TIMESTAMPTZ,
  end_at            TIMESTAMPTZ,

  -- Denormalised KPI counters (fast dashboard; source of truth is campaign_events)
  impressions       BIGINT DEFAULT 0,
  opens             BIGINT DEFAULT 0,
  product_clicks    BIGINT DEFAULT 0,
  add_to_cart_count BIGINT DEFAULT 0,
  purchases         BIGINT DEFAULT 0,
  revenue           NUMERIC(12,2) DEFAULT 0,

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Read active campaigns"
    ON public.campaigns FOR SELECT
    USING (status = 'active');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Vendors manage own campaigns"
    ON public.campaigns FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.vendor_profiles v
        WHERE v.id = campaigns.vendor_id AND v.user_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.vendor_profiles v
        WHERE v.id = campaigns.vendor_id AND v.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS idx_campaigns_vendor ON public.campaigns(vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status, start_at, end_at);

DROP TRIGGER IF EXISTS trg_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── CAMPAIGN_PRODUCTS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaign_products (
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES public.products(id)  ON DELETE RESTRICT,
  sort_order  INT  DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (campaign_id, product_id)
);

ALTER TABLE public.campaign_products ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Read campaign products"
    ON public.campaign_products FOR SELECT USING (TRUE);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Vendors manage own campaign products"
    ON public.campaign_products FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.campaigns c
        JOIN public.vendor_profiles v ON v.id = c.vendor_id
        WHERE c.id = campaign_products.campaign_id AND v.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS idx_campaign_products_campaign ON public.campaign_products(campaign_id, sort_order);

-- ── CAMPAIGN_EVENTS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaign_events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id  UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  event_type   campaign_event_type_enum NOT NULL,
  product_id   UUID REFERENCES public.products(id) ON DELETE SET NULL,
  post_id      UUID REFERENCES public.posts(id)    ON DELETE SET NULL,
  session_id   TEXT,
  meta         JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.campaign_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users insert own campaign events"
    ON public.campaign_events FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Vendors read events for own campaigns"
    ON public.campaign_events FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.campaigns c
        JOIN public.vendor_profiles v ON v.id = c.vendor_id
        WHERE c.id = campaign_events.campaign_id AND v.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS idx_campaign_events_campaign_time ON public.campaign_events(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_events_user_time     ON public.campaign_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_events_type_time     ON public.campaign_events(event_type, created_at DESC);

-- ── ATTRIBUTION HOOKS (optional fields; safe adds) ───────────────────────
ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL;

