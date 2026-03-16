-- Run this query to see what columns exist in the tables modified by the migration
SELECT 
  table_name, 
  column_name, 
  data_type 
FROM 
  information_schema.columns 
WHERE 
  table_schema = 'public' 
  AND table_name IN ('vendor_profiles', 'products', 'cart_items', 'orders', 'order_items')
ORDER BY 
  table_name, ordinal_position;
