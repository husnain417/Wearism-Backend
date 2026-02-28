-- 019_indexes.sql
-- Performance indexes for all tables

-- ── PROFILES ────────────────────────────────────────────
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_deleted_at ON public.profiles(deleted_at) WHERE deleted_at IS NULL;

-- ── WARDROBE ITEMS ───────────────────────────────────────
CREATE INDEX idx_wardrobe_user_id ON public.wardrobe_items(user_id);
CREATE INDEX idx_wardrobe_category ON public.wardrobe_items(category);
CREATE INDEX idx_wardrobe_user_category ON public.wardrobe_items(user_id, category);
CREATE INDEX idx_wardrobe_deleted ON public.wardrobe_items(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_wardrobe_for_sale ON public.wardrobe_items(user_id) WHERE is_for_sale = TRUE;
-- Vector index for similarity search (Phase 5)
CREATE INDEX idx_wardrobe_embedding ON public.wardrobe_items USING ivfflat (embedding vector_cosine_ops);

-- ── OUTFITS ─────────────────────────────────────────────
CREATE INDEX idx_outfits_user_id ON public.outfits(user_id);
CREATE INDEX idx_outfits_user_status ON public.outfits(user_id, status);
CREATE INDEX idx_outfit_items_outfit_id ON public.outfit_items(outfit_id);
CREATE INDEX idx_outfit_items_item_id ON public.outfit_items(item_id);

-- ── AI RESULTS ──────────────────────────────────────────
CREATE INDEX idx_ai_results_user_id ON public.ai_results(user_id);
CREATE INDEX idx_ai_results_status ON public.ai_results(status) WHERE status = 'pending';
CREATE INDEX idx_ai_results_wardrobe_item ON public.ai_results(wardrobe_item_id);

-- ── POSTS ───────────────────────────────────────────────
CREATE INDEX idx_posts_user_id ON public.posts(user_id);
CREATE INDEX idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX idx_posts_status ON public.posts(status) WHERE status = 'published';
CREATE INDEX idx_posts_tags ON public.posts USING GIN(tags);

-- ── COMMENTS ────────────────────────────────────────────
CREATE INDEX idx_comments_post_id ON public.comments(post_id);
CREATE INDEX idx_comments_user_id ON public.comments(user_id);
CREATE INDEX idx_comments_parent_id ON public.comments(parent_id);

-- ── LIKES ───────────────────────────────────────────────
CREATE INDEX idx_post_likes_post_id ON public.post_likes(post_id);
CREATE INDEX idx_post_likes_user_id ON public.post_likes(user_id);

-- ── FOLLOWS ─────────────────────────────────────────────
CREATE INDEX idx_follows_follower ON public.follows(follower_id);
CREATE INDEX idx_follows_following ON public.follows(following_id);

-- ── PRODUCTS ────────────────────────────────────────────
CREATE INDEX idx_products_vendor_id ON public.products(vendor_id);
CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_products_status ON public.products(status) WHERE status = 'active';
-- Trigram index for name search
CREATE INDEX idx_products_name_trgm ON public.products USING GIN(name gin_trgm_ops);
-- Vector index for recommendation engine
CREATE INDEX idx_products_embedding ON public.products USING ivfflat (embedding vector_cosine_ops);

-- ── CART + ORDERS ───────────────────────────────────────
CREATE INDEX idx_cart_user_id ON public.cart_items(user_id);
CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
