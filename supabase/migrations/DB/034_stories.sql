-- Stories: one image per row, same storage bucket as posts (`posts` / path `{user_id}/stories/...`).
-- Visibility & 24h window enforced in API; rows older than 24h are ignored by queries.

CREATE TABLE IF NOT EXISTS public.stories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_stories_user_created
  ON public.stories (user_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_stories_active_window
  ON public.stories (created_at DESC)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.stories IS 'Ephemeral user stories; image_path is under Supabase storage bucket posts.';
