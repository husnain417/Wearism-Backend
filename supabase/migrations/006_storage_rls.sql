-- 006_storage_rls.sql
-- Storage RLS for both avatars and wardrobe buckets

-- ── WARDROBE BUCKET POLICIES ────────────────────────────

CREATE POLICY 'Users can upload own wardrobe images'
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'wardrobe' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY 'Users can update own wardrobe images'
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'wardrobe' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY 'Users can read own wardrobe images'
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'wardrobe' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY 'Users can delete own wardrobe images'
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'wardrobe' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
