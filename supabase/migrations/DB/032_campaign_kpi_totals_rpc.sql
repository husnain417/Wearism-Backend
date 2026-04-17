-- Aggregated KPIs from campaign_events for vendor campaign lists (source of truth).

CREATE OR REPLACE FUNCTION public.campaign_kpi_totals(p_campaign_ids uuid[])
RETURNS TABLE (
  campaign_id         uuid,
  impressions         bigint,
  opens               bigint,
  product_clicks      bigint,
  add_to_cart_count   bigint,
  purchases           bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    e.campaign_id,
    COUNT(*) FILTER (WHERE e.event_type = 'impression')::bigint,
    COUNT(*) FILTER (WHERE e.event_type = 'open')::bigint,
    COUNT(*) FILTER (WHERE e.event_type = 'product_click')::bigint,
    COUNT(*) FILTER (WHERE e.event_type = 'add_to_cart')::bigint,
    COUNT(*) FILTER (WHERE e.event_type = 'purchase')::bigint
  FROM public.campaign_events e
  WHERE e.campaign_id = ANY(p_campaign_ids)
  GROUP BY e.campaign_id;
$$;

REVOKE ALL ON FUNCTION public.campaign_kpi_totals(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.campaign_kpi_totals(uuid[]) TO service_role;
