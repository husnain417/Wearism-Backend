-- 020_functions.sql

-- ── UPDATED_AT TRIGGER (applied to all tables) ──────────
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- Apply to every table that has updated_at
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_wardrobe_updated_at
  BEFORE UPDATE ON public.wardrobe_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_outfits_updated_at
  BEFORE UPDATE ON public.outfits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── LIKE COUNT TRIGGER ───────────────────────────────────
-- Keeps posts.like_count in sync automatically
CREATE OR REPLACE FUNCTION public.update_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_like_count
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_like_count();

-- ── COMMENT COUNT TRIGGER ────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_comment_count
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_comment_count();

-- ── PROFILE COMPLETION SCORE ─────────────────────────────
CREATE OR REPLACE FUNCTION public.get_profile_completion(profile_row public.profiles)
RETURNS INTEGER AS $$
DECLARE score INTEGER := 0; total INTEGER := 7;
BEGIN
  IF profile_row.full_name   IS NOT NULL THEN score := score + 1; END IF;
  IF profile_row.avatar_url  IS NOT NULL THEN score := score + 1; END IF;
  IF profile_row.gender      IS NOT NULL THEN score := score + 1; END IF;
  IF profile_row.age_range   IS NOT NULL THEN score := score + 1; END IF;
  IF profile_row.height_cm   IS NOT NULL THEN score := score + 1; END IF;
  IF profile_row.body_type   IS NOT NULL THEN score := score + 1; END IF;
  IF profile_row.skin_tone   IS NOT NULL THEN score := score + 1; END IF;
  RETURN ROUND((score::DECIMAL / total) * 100);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ── ANONYMISE USER ON ACCOUNT DELETION ───────────────────
-- Called from backend deleteAccount — preserves order history
CREATE OR REPLACE FUNCTION public.anonymise_user_orders(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.orders SET
    shipping_name     = '[DELETED]',
    shipping_address  = '[DELETED]',
    shipping_city     = '[DELETED]',
    shipping_country  = '[DELETED]',
    shipping_postcode = '[DELETED]'
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
