INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('products','products', false, 10485760,
        ARRAY['image/jpeg','image/png','image/webp']);

CREATE POLICY "Vendors upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id='products' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone reads product images"
  ON storage.objects FOR SELECT USING (bucket_id='products');

CREATE POLICY "Vendors delete own product images"
  ON storage.objects FOR DELETE
  USING (bucket_id='products' AND auth.uid()::text = (storage.foldername(name))[1]);
