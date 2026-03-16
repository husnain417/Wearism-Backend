-- Section 13 — Verification Query
-- Run after migrations to confirm all tables, indexes, triggers, and enums exist.

SELECT 'TABLE' as type, table_name as name
FROM information_schema.tables WHERE table_schema='public'
  AND table_name IN ('vendor_profiles','products','product_images',
                     'cart_items','orders','order_items')
UNION ALL
SELECT 'INDEX', indexname FROM pg_indexes WHERE schemaname='public'
  AND indexname IN (
    'idx_vendor_profiles_user','idx_vendor_profiles_status',
    'idx_products_vendor','idx_products_category','idx_products_status',
    'idx_products_price','idx_products_resale','idx_products_tags','idx_products_fts',
    'idx_product_images_product','idx_cart_items_user',
    'idx_orders_buyer','idx_orders_vendor','idx_orders_status',
    'idx_order_items_order','idx_order_items_product'
  )
UNION ALL
SELECT 'TRIGGER', trigger_name FROM information_schema.triggers WHERE trigger_schema='public'
  AND trigger_name IN (
    'trg_vendor_profiles_updated_at','trg_products_updated_at',
    'trg_cart_items_updated_at','trg_orders_updated_at',
    'trg_vendor_products_count','trg_vendor_sales_stats','trg_sync_wardrobe_sold'
  )
UNION ALL
SELECT 'ENUM', typname FROM pg_type
  WHERE typname IN ('vendor_status_enum','product_condition_enum',
    'product_status_enum','order_status_enum','product_category_enum')
ORDER BY type, name;
