-- 029_fix_product_status_enum.sql
-- Ensure product_status_enum includes 'sold' (older schemas may not).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'product_status_enum'
      AND e.enumlabel = 'sold'
  ) THEN
    ALTER TYPE public.product_status_enum ADD VALUE 'sold';
  END IF;
END $$;

