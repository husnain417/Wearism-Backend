-- 014_social_rls.sql

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Posts: anyone authenticated can read published posts
CREATE POLICY "Authenticated users can read published posts"
  ON public.posts
  FOR SELECT
  USING (auth.role() = 'authenticated'
         AND status = 'published'
         AND deleted_at IS NULL);

CREATE POLICY "Users manage own posts"
  ON public.posts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Comments: readable by all authenticated, writable by owner
CREATE POLICY "Authenticated users can read comments"
  ON public.comments
  FOR SELECT
  USING (auth.role() = 'authenticated'
         AND deleted_at IS NULL);

CREATE POLICY "Users manage own comments"
  ON public.comments
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Likes: readable by all, insertable/deletable by owner
CREATE POLICY "Authenticated users can read likes"
  ON public.post_likes
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users manage own likes"
  ON public.post_likes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Follows: readable by all authenticated
CREATE POLICY "Authenticated users can read follows"
  ON public.follows
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users manage own follows"
  ON public.follows
  FOR ALL
  USING (auth.uid() = follower_id)
  WITH CHECK (auth.uid() = follower_id);