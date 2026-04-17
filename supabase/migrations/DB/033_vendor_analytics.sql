-- Aggregated vendor analytics (orders + campaign_events). Backend only (service_role).

CREATE OR REPLACE FUNCTION public.vendor_analytics_data(p_vendor_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH vo AS (
    SELECT COALESCE(SUM(total_amount), 0)::numeric AS revenue_pkr,
           COUNT(*)::bigint AS orders_count
    FROM orders
    WHERE vendor_id = p_vendor_id
      AND status NOT IN ('cancelled', 'refunded')
  ),
  ce AS (
    SELECT e.event_type, e.product_id, e.campaign_id, c.type AS ctype
    FROM campaign_events e
    JOIN campaigns c ON c.id = e.campaign_id AND c.vendor_id = p_vendor_id
  ),
  ct AS (
    SELECT
      COUNT(*) FILTER (WHERE event_type = 'impression')::bigint AS impressions,
      COUNT(*) FILTER (WHERE event_type = 'product_click')::bigint AS clicks,
      COUNT(*) FILTER (WHERE event_type = 'open')::bigint AS opens,
      COUNT(*) FILTER (WHERE event_type = 'purchase')::bigint AS purchases
    FROM ce
  ),
  by_type AS (
    SELECT c.type::text AS type,
           COUNT(DISTINCT c.id)::bigint AS campaign_count,
           COALESCE(SUM(CASE WHEN e.event_type = 'impression' THEN 1 ELSE 0 END), 0)::bigint AS impressions,
           COALESCE(SUM(CASE WHEN e.event_type = 'product_click' THEN 1 ELSE 0 END), 0)::bigint AS clicks
    FROM campaigns c
    LEFT JOIN campaign_events e ON e.campaign_id = c.id
    WHERE c.vendor_id = p_vendor_id
    GROUP BY c.type
  ),
  po AS (
    SELECT oi.product_id, COUNT(*)::bigint AS order_count
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.vendor_id = p_vendor_id
      AND o.status NOT IN ('cancelled', 'refunded')
    GROUP BY oi.product_id
  ),
  pm AS (
    SELECT p.id, p.name,
      COALESCE(imp.n, 0)::bigint AS impressions,
      COALESCE(clk.n, 0)::bigint AS clicks
    FROM products p
    LEFT JOIN (
      SELECT e.product_id, COUNT(*)::bigint AS n
      FROM campaign_events e
      JOIN campaigns c ON c.id = e.campaign_id AND c.vendor_id = p_vendor_id
      WHERE e.product_id IS NOT NULL AND e.event_type = 'impression'
      GROUP BY e.product_id
    ) imp ON imp.product_id = p.id
    LEFT JOIN (
      SELECT e.product_id, COUNT(*)::bigint AS n
      FROM campaign_events e
      JOIN campaigns c ON c.id = e.campaign_id AND c.vendor_id = p_vendor_id
      WHERE e.product_id IS NOT NULL AND e.event_type = 'product_click'
      GROUP BY e.product_id
    ) clk ON clk.product_id = p.id
    WHERE p.vendor_id = p_vendor_id AND p.deleted_at IS NULL
  ),
  products_json AS (
    SELECT COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'name', s.name,
            'impressions', s.impressions,
            'clicks', s.clicks,
            'orders', s.orders
          )
          ORDER BY s.sort_key DESC, s.name ASC
        )
        FROM (
          SELECT
            r.id,
            r.name,
            r.impressions,
            r.clicks,
            COALESCE(po.order_count, 0)::bigint AS orders,
            (r.impressions + r.clicks) AS sort_key
          FROM pm r
          LEFT JOIN po ON po.product_id = r.id
          ORDER BY (r.impressions + r.clicks) DESC, r.name ASC
          LIMIT 30
        ) s
      ),
      '[]'::jsonb
    ) AS j
  ),
  by_type_json AS (
    SELECT COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'type', type,
            'campaign_count', campaign_count,
            'impressions', impressions,
            'clicks', clicks,
            'ctr', CASE WHEN impressions > 0 THEN round((clicks::numeric / impressions), 4) ELSE 0 END
          )
          ORDER BY type ASC
        )
        FROM by_type
      ),
      '[]'::jsonb
    ) AS j
  )
  SELECT jsonb_build_object(
    'overview', (
      SELECT jsonb_build_object(
        'revenue_pkr', vo.revenue_pkr,
        'orders_count', vo.orders_count,
        'campaign_impressions', ct.impressions,
        'campaign_clicks', ct.clicks,
        'campaign_opens', ct.opens,
        'campaign_purchases', ct.purchases,
        'ctr', CASE WHEN ct.impressions > 0 THEN round((ct.clicks::numeric / ct.impressions), 4) ELSE 0 END,
        'click_to_purchase_rate', CASE WHEN ct.clicks > 0 THEN round((ct.purchases::numeric / ct.clicks), 4) ELSE 0 END
      )
      FROM vo, ct
    ),
    'products', (SELECT j FROM products_json),
    'campaigns_by_type', (SELECT j FROM by_type_json)
  );
$$;

REVOKE ALL ON FUNCTION public.vendor_analytics_data(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_analytics_data(uuid) TO service_role;
