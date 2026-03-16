-- 023_social_hub.sql  PART 1 — enums only (commit before running Part 2)

CREATE TYPE post_visibility_enum AS ENUM ('public', 'followers_only', 'private');
CREATE TYPE report_reason_enum   AS ENUM (
  'nsfw', 'spam', 'harassment', 'misinformation', 'other'
);

-- 023_social_hub.sql  PART 2 — all tables
 
-- ═══════════════════════════════════════════════════
-- follows
-- ═══════════════════════════════════════════════════
CREATE TABLE public.follows (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ,
  UNIQUE (follower_id, following_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own follows"
  ON public.follows FOR ALL
  USING  (auth.uid() = follower_id)
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Anyone can read follow relationships"
  ON public.follows FOR SELECT USING (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_follows_follower  ON public.follows(follower_id)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id) WHERE deleted_at IS NULL;


-- ═══════════════════════════════════════════════════
-- posts
-- ═══════════════════════════════════════════════════
CREATE TABLE public.posts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Content
  caption       TEXT,
  image_url     TEXT,
  image_path    TEXT,

  -- Optional outfit tag — links to an outfit in the wardrobe module
  outfit_id     UUID REFERENCES public.outfits(id) ON DELETE SET NULL,

  -- Context
  occasion      outfit_occasion_enum,
  season        clothing_season_enum,
  weather       weather_enum,
  tags          TEXT[],

  -- Visibility
  visibility    post_visibility_enum DEFAULT 'public',

  -- Engagement counters (denormalised for fast reads — maintained by triggers)
  likes_count   INT DEFAULT 0,
  comments_count INT DEFAULT 0,

  -- Engagement score for trending (updated periodically)
  trending_score FLOAT DEFAULT 0,

  -- Moderation
  is_nsfw_flagged BOOLEAN DEFAULT FALSE,
  is_hidden       BOOLEAN DEFAULT FALSE,
  report_count    INT DEFAULT 0,

  -- Soft delete + timestamps
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Users can read public posts and own posts
CREATE POLICY "Read public posts"
  ON public.posts FOR SELECT
  USING (
    deleted_at IS NULL AND is_hidden = FALSE AND (
      visibility = 'public'
      OR auth.uid() = user_id
      OR (
        visibility = 'followers_only' AND
        EXISTS (SELECT 1 FROM public.follows
                WHERE follower_id = auth.uid()
                  AND following_id = posts.user_id
                  AND deleted_at IS NULL)
      )
    )
  );

-- Users manage their own posts
CREATE POLICY "Users manage own posts"
  ON public.posts FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_posts_user_id    ON public.posts(user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_posts_trending   ON public.posts(trending_score DESC, created_at DESC) WHERE deleted_at IS NULL AND is_hidden = FALSE;
CREATE INDEX IF NOT EXISTS idx_posts_visibility ON public.posts(visibility, created_at DESC) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ═══════════════════════════════════════════════════
-- post_likes
-- ═══════════════════════════════════════════════════
CREATE TABLE public.post_likes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id    UUID NOT NULL REFERENCES public.posts(id)    ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (post_id, user_id)   -- one like per user per post
);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own likes"
  ON public.post_likes FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can read likes count"
  ON public.post_likes FOR SELECT USING (TRUE);

CREATE INDEX IF NOT EXISTS idx_post_likes_post ON public.post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user ON public.post_likes(user_id);


-- ═══════════════════════════════════════════════════
-- post_comments
-- ═══════════════════════════════════════════════════
CREATE TABLE public.post_comments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id    UUID NOT NULL REFERENCES public.posts(id)    ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id  UUID REFERENCES public.post_comments(id)    ON DELETE CASCADE,
  body       TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  is_hidden  BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read visible comments"
  ON public.post_comments FOR SELECT
  USING (deleted_at IS NULL AND is_hidden = FALSE);

CREATE POLICY "Users manage own comments"
  ON public.post_comments FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.post_comments(post_id, created_at ASC)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.post_comments(user_id)                  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_comments_parent  ON public.post_comments(parent_id)                WHERE parent_id IS NOT NULL;

-- ═══════════════════════════════════════════════════
-- post_reports  (NSFW + abuse reporting)
-- ═══════════════════════════════════════════════════
CREATE TABLE public.post_reports (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id    UUID NOT NULL REFERENCES public.posts(id)    ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason     report_reason_enum NOT NULL,
  detail     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (post_id, user_id)   -- one report per user per post
);

ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users submit own reports"
  ON public.post_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own reports"
  ON public.post_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_reports_post ON public.post_reports(post_id);


-- ═══════════════════════════════════════════════════
-- TRIGGERS: maintain denormalised counts
-- ═══════════════════════════════════════════════════

-- likes_count on posts
CREATE OR REPLACE FUNCTION public.update_post_likes_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_post_likes_count
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_post_likes_count();


-- comments_count on posts
CREATE OR REPLACE FUNCTION public.update_post_comments_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.deleted_at IS NULL THEN
    UPDATE public.posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_post_comments_count
  AFTER INSERT OR UPDATE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_post_comments_count();


-- report_count + auto-hide on posts
CREATE OR REPLACE FUNCTION public.update_post_report_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.posts
  SET
    report_count   = report_count + 1,
    -- Auto-hide post when it receives 5+ reports
    is_hidden      = CASE WHEN report_count + 1 >= 5 THEN TRUE ELSE is_hidden END,
    is_nsfw_flagged = CASE WHEN NEW.reason = 'nsfw' AND report_count + 1 >= 3 THEN TRUE ELSE is_nsfw_flagged END
  WHERE id = NEW.post_id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_post_report_count
  AFTER INSERT ON public.post_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_post_report_count();


-- follower/following counts on profiles
CREATE OR REPLACE FUNCTION public.update_follow_counts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET following_count = COALESCE(following_count,0) + 1 WHERE id = NEW.follower_id;
    UPDATE public.profiles SET followers_count = COALESCE(followers_count,0) + 1 WHERE id = NEW.following_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.profiles SET following_count = GREATEST(COALESCE(following_count,0) - 1, 0) WHERE id = OLD.follower_id;
    UPDATE public.profiles SET followers_count = GREATEST(COALESCE(followers_count,0) - 1, 0) WHERE id = OLD.following_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_follow_counts
  AFTER INSERT OR UPDATE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.update_follow_counts();


-- Add follower/following count columns to profiles if not present
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS followers_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS following_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS posts_count     INT DEFAULT 0;



  -- 023_social_hub_fixes.sql

-- 1. posts_count trigger on profiles
CREATE OR REPLACE FUNCTION public.update_profile_posts_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.deleted_at IS NULL THEN
    UPDATE public.profiles SET posts_count = COALESCE(posts_count,0) + 1 WHERE id = NEW.user_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.profiles SET posts_count = GREATEST(COALESCE(posts_count,0) - 1, 0) WHERE id = OLD.user_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_profile_posts_count
  AFTER INSERT OR UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_profile_posts_count();


-- 2. Fix comments trigger to handle hard DELETE
DROP TRIGGER IF EXISTS trg_post_comments_count ON public.post_comments;

CREATE OR REPLACE FUNCTION public.update_post_comments_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.deleted_at IS NULL THEN
    UPDATE public.posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_post_comments_count
  AFTER INSERT OR UPDATE OR DELETE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_post_comments_count();


-- 3. Self-follow constraint
ALTER TABLE public.follows
  ADD CONSTRAINT no_self_follow CHECK (follower_id <> following_id);


-- 4. Feed index
CREATE INDEX IF NOT EXISTS idx_posts_feed
  ON public.posts(user_id, created_at DESC)
  WHERE deleted_at IS NULL AND is_hidden = FALSE;


-- 5. GIN index for tag search
CREATE INDEX IF NOT EXISTS idx_posts_tags
  ON public.posts USING GIN(tags);


-- 6. Composite comment thread index
CREATE INDEX IF NOT EXISTS idx_comments_thread
  ON public.post_comments(post_id, parent_id);