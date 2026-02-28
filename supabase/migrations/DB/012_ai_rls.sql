-- 012_ai_rls.sql

ALTER TABLE public.ai_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own AI results"
  ON public.ai_results
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert/update AI results
-- (your backend worker updates these, not the mobile app directly)
CREATE POLICY "Service role manages AI results"
  ON public.ai_results
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');