-- Add fcm_token for Push Notifications
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fcm_token TEXT,
  ADD COLUMN IF NOT EXISTS fcm_token_updated_at TIMESTAMPTZ;

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_profiles_fcm_token
  ON public.profiles(id)
  WHERE fcm_token IS NOT NULL;
