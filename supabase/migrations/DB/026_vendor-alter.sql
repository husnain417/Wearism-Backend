-- Fix vendor_profiles — add missing Phase 7 columns
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS shop_name        TEXT,
  ADD COLUMN IF NOT EXISTS shop_description TEXT,
  ADD COLUMN IF NOT EXISTS shop_logo_path   TEXT,
  ADD COLUMN IF NOT EXISTS shop_banner_url  TEXT,
  ADD COLUMN IF NOT EXISTS shop_banner_path TEXT,
  ADD COLUMN IF NOT EXISTS contact_email    TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone    TEXT,
  ADD COLUMN IF NOT EXISTS business_address TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS approved_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_revenue    NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS products_count   INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_rating       NUMERIC(3,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count     INT DEFAULT 0;

UPDATE public.vendor_profiles SET shop_name = brand_name WHERE shop_name IS NULL;

ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.cart_items
  DROP COLUMN IF EXISTS size;

ALTER TABLE public.recommendations
  ADD COLUMN IF NOT EXISTS season clothing_season_enum;

ALTER TABLE public.order_items
  DROP COLUMN IF EXISTS product_price;

  DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cart_items_user_product_unique'
  ) THEN
    ALTER TABLE public.cart_items
      ADD CONSTRAINT cart_items_user_product_unique UNIQUE (user_id, product_id);
  END IF;
END $$;