-- 030_campaign_bucket.sql
-- Storage bucket + policies for campaign cover images

-- Bucket (private; clients use signed URLs stored in DB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('campaigns','campaigns', false, 10485760,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- RLS policies on storage.objects
-- Vendors upload campaign images under their own user folder: {userId}/{campaignId}/...
DO $$ BEGIN
  CREATE POLICY "Vendors upload campaign images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id='campaigns' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Anyone reads campaign images"
    ON storage.objects FOR SELECT
    USING (bucket_id='campaigns');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Vendors delete own campaign images"
    ON storage.objects FOR DELETE
    USING (bucket_id='campaigns' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN null; END $$;

