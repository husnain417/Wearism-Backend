-- Run in Supabase SQL Editor

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'posts',
  'posts',
  false,               -- private bucket, signed URLs only
  10485760,            -- 10MB limit
  ARRAY['image/jpeg','image/png','image/webp']
);

-- RLS policies for posts bucket
CREATE POLICY "Users upload own post images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own post images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own post images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);
