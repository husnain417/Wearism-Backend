-- Posts
CREATE TABLE public.posts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  outfit_id   UUID REFERENCES public.outfits(id) ON DELETE SET NULL,
  caption     TEXT CHECK (char_length(caption) <= 2200),
  image_url   TEXT,
  image_path  TEXT,
  tags        TEXT[],
  status      post_status_enum DEFAULT 'published',
  like_count  INTEGER DEFAULT 0,    -- denormalised for performance
  comment_count INTEGER DEFAULT 0,  -- denormalised for performance
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Comments
CREATE TABLE public.comments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id     UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id   UUID REFERENCES public.comments(id) ON DELETE CASCADE,  -- for replies
  content     TEXT NOT NULL CHECK (char_length(content) <= 500),
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Likes — junction table (user + post must be unique)
CREATE TABLE public.post_likes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id     UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)  -- one like per user per post
);

-- Follows — junction table (follower + following must be unique)
CREATE TABLE public.follows (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id),         -- can't follow same person twice
  CHECK (follower_id != following_id)        -- can't follow yourself
);
