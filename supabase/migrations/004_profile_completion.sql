-- Migration: 004_profile_completion.sql
-- Postgres function that computes profile completion percentage
-- Called from the API on every GET /user/profile request

CREATE OR REPLACE FUNCTION public.get_profile_completion(profile_row public.profiles)
RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
  total INTEGER := 7;
BEGIN
  IF profile_row.full_name IS NOT NULL THEN score := score + 1; END IF;
  IF profile_row.avatar_url IS NOT NULL THEN score := score + 1; END IF;
  IF profile_row.gender IS NOT NULL THEN score := score + 1; END IF;
  IF profile_row.age_range IS NOT NULL THEN score := score + 1; END IF;
  IF profile_row.height_cm IS NOT NULL THEN score := score + 1; END IF;
  IF profile_row.body_type IS NOT NULL THEN score := score + 1; END IF;
  IF profile_row.skin_tone IS NOT NULL THEN score := score + 1; END IF;

  RETURN ROUND((score::DECIMAL / total) * 100);
END;
$$ LANGUAGE plpgsql IMMUTABLE;
