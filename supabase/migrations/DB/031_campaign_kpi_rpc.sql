-- 031_campaign_kpi_rpc.sql
-- Atomic KPI increments for campaigns (used by backend on event tracking)

CREATE OR REPLACE FUNCTION public.increment_campaign_kpi(
  p_campaign_id UUID,
  p_event_type  TEXT,
  p_revenue     NUMERIC DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_event_type = 'impression' THEN
    UPDATE public.campaigns SET impressions = impressions + 1 WHERE id = p_campaign_id;
  ELSIF p_event_type = 'open' THEN
    UPDATE public.campaigns SET opens = opens + 1 WHERE id = p_campaign_id;
  ELSIF p_event_type = 'product_click' THEN
    UPDATE public.campaigns SET product_clicks = product_clicks + 1 WHERE id = p_campaign_id;
  ELSIF p_event_type = 'add_to_cart' THEN
    UPDATE public.campaigns SET add_to_cart_count = add_to_cart_count + 1 WHERE id = p_campaign_id;
  ELSIF p_event_type = 'purchase' THEN
    UPDATE public.campaigns
      SET purchases = purchases + 1,
          revenue   = revenue + COALESCE(p_revenue, 0)
    WHERE id = p_campaign_id;
  END IF;
END;
$$;

