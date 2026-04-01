-- 025_final_cleanup.sql
-- Remove orphaned tables and dead columns from pre-Phase 7 schemas

-- 1. Drop test_users table
DROP TABLE IF EXISTS public.test_users;

-- 2. Drop orphaned 'comments' table (replaced by post_comments in Phase 6)
-- VERIFY it's empty first: SELECT COUNT(*) FROM public.comments;
DROP TABLE IF EXISTS public.comments;

-- 3. Remove old payment gateway columns from orders
-- (replaced by COD-only flow in Phase 7)
ALTER TABLE public.orders
  DROP COLUMN IF EXISTS shipping_name,
  DROP COLUMN IF EXISTS shipping_address,
  DROP COLUMN IF EXISTS shipping_city,
  DROP COLUMN IF EXISTS shipping_country,
  DROP COLUMN IF EXISTS shipping_postcode,
  DROP COLUMN IF EXISTS payment_intent_id;

-- 4. Remove duplicate columns from order_items
ALTER TABLE public.order_items
  DROP COLUMN IF EXISTS product_price,
  DROP COLUMN IF EXISTS size;

-- 5. Add FCM token columns to profiles (idempotent)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fcm_token              TEXT,
  ADD COLUMN IF NOT EXISTS fcm_token_updated_at   TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_fcm_token
  ON public.profiles(id) WHERE fcm_token IS NOT NULL;
