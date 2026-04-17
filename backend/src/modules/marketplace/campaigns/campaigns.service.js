import { supabase } from '../../../config/supabase.js';

async function getVendorIdForUser(userId) {
  const { data: vendor } = await supabase
    .from('vendor_profiles')
    .select('id')
    .eq('user_id', userId)
    .single();
  if (!vendor) throw { statusCode: 404, message: 'Vendor profile not found.' };
  return vendor.id;
}

async function replaceCampaignProducts(campaignId, productIds) {
  // Remove all and insert new set (simple + deterministic).
  await supabase.from('campaign_products').delete().eq('campaign_id', campaignId);
  if (!productIds?.length) return;

  // Preserve order from input.
  const rows = productIds.map((pid, idx) => ({
    campaign_id: campaignId,
    product_id: pid,
    sort_order: idx,
    is_featured: idx === 0,
  }));

  await supabase.from('campaign_products').insert(rows);
}

export const campaignsService = {
  async listActiveCampaigns({ limit = 6 } = {}) {
    const nowIso = new Date().toISOString();
    const safeLimit = Math.max(1, Math.min(Number(limit) || 6, 30));

    let q = supabase
      .from('campaigns')
      .select(
        `id, vendor_id, type, status, motive, title, description,
         cover_image_url, start_at, end_at,
         impressions, opens, product_clicks, add_to_cart_count, purchases, revenue,
         created_at, updated_at,
         vendor_profiles!vendor_id(id, shop_name, shop_logo_url),
         campaign_products(product_id, sort_order,
           products(id, name, price, primary_image_url, stock_quantity, status)
         )`
      )
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(safeLimit);

    // Time-window filters (if set)
    // - start_at <= now OR NULL
    // - end_at   >  now OR NULL
    q = q.or(`start_at.is.null,start_at.lte.${nowIso}`);
    q = q.or(`end_at.is.null,end_at.gt.${nowIso}`);

    const { data, error } = await q;
    if (error) throw error;

    return (data || []).map((c) => ({
      ...c,
      products: (c.campaign_products || [])
        .slice()
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((cp) => cp.products)
        .filter(Boolean),
    }));
  },

  async getActiveCampaign(campaignId) {
    const { data, error } = await supabase
      .from('campaigns')
      .select(
        `id, vendor_id, type, status, motive, title, description,
         cover_image_url, start_at, end_at,
         impressions, opens, product_clicks, add_to_cart_count, purchases, revenue,
         created_at, updated_at,
         vendor_profiles!vendor_id(id, shop_name, shop_logo_url),
         campaign_products(product_id, sort_order, is_featured,
           products(id, name, price, primary_image_url, stock_quantity, status, category)
         )`
      )
      .eq('id', campaignId)
      .eq('status', 'active')
      .single();

    if (error || !data) throw { statusCode: 404, message: 'Campaign not found.' };

    const products = (data.campaign_products || [])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((cp) => cp.products)
      .filter(Boolean);

    return { ...data, products };
  },

  async createCampaign(userId, body) {
    const vendorId = await getVendorIdForUser(userId);
    const {
      type = 'custom',
      status = 'draft',
      motive,
      title,
      description,
      cover_image_url,
      cover_image_path,
      target_gender,
      min_age,
      max_age,
      start_at,
      end_at,
      product_ids = [],
    } = body;

    if (min_age != null && max_age != null && Number(min_age) > Number(max_age)) {
      throw { statusCode: 400, message: 'min_age cannot be greater than max_age.' };
    }

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert({
        vendor_id: vendorId,
        type,
        status,
        motive: motive || null,
        title,
        description: description || null,
        cover_image_url: cover_image_url || null,
        cover_image_path: cover_image_path || null,
        target_gender: target_gender || null,
        min_age: min_age ?? null,
        max_age: max_age ?? null,
        start_at: start_at || null,
        end_at: end_at || null,
      })
      .select('*')
      .single();

    if (error) throw error;

    // Ensure products belong to this vendor and are not deleted.
    if (product_ids?.length) {
      const { data: owned } = await supabase
        .from('products')
        .select('id')
        .eq('vendor_id', vendorId)
        .in('id', product_ids)
        .is('deleted_at', null);

      const ownedIds = new Set((owned || []).map((p) => p.id));
      const filtered = product_ids.filter((id) => ownedIds.has(id));

      await replaceCampaignProducts(campaign.id, filtered);
    }

    return campaign;
  },

  async listMyCampaigns(userId, query = {}) {
    const vendorId = await getVendorIdForUser(userId);
    const { status, type } = query;

    let q = supabase
      .from('campaigns')
      .select(
        `id, vendor_id, type, status, motive, title, description,
         cover_image_url, start_at, end_at,
         impressions, opens, product_clicks, add_to_cart_count, purchases, revenue,
         created_at, updated_at,
         campaign_products(product_id, sort_order,
           products(id, name, price, primary_image_url, stock_quantity, status)
         )`
      )
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false });

    if (status) q = q.eq('status', status);
    if (type) q = q.eq('type', type);

    const { data, error } = await q;
    if (error) throw error;

    const rows = data || [];
    const campaignIds = rows.map((c) => c.id);

    let kpiById = {};
    if (campaignIds.length) {
      const { data: kpiRows, error: kpiErr } = await supabase.rpc('campaign_kpi_totals', {
        p_campaign_ids: campaignIds,
      });
      if (!kpiErr && Array.isArray(kpiRows)) {
        kpiById = Object.fromEntries(kpiRows.map((r) => [r.campaign_id, r]));
      }
    }

    return rows.map((c) => {
      const k = kpiById[c.id];
      return {
        ...c,
        impressions: k ? Number(k.impressions) : Number(c.impressions ?? 0),
        opens: k ? Number(k.opens) : Number(c.opens ?? 0),
        product_clicks: k ? Number(k.product_clicks) : Number(c.product_clicks ?? 0),
        add_to_cart_count: k ? Number(k.add_to_cart_count) : Number(c.add_to_cart_count ?? 0),
        purchases: k ? Number(k.purchases) : Number(c.purchases ?? 0),
        products: (c.campaign_products || [])
          .slice()
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((cp) => cp.products)
          .filter(Boolean),
      };
    });
  },

  async getMyCampaign(userId, campaignId) {
    const vendorId = await getVendorIdForUser(userId);
    const { data, error } = await supabase
      .from('campaigns')
      .select(
        `*,
         campaign_products(product_id, sort_order, is_featured,
           products(id, name, price, primary_image_url, stock_quantity, status, category)
         )`
      )
      .eq('id', campaignId)
      .eq('vendor_id', vendorId)
      .single();

    if (error) throw { statusCode: 404, message: 'Campaign not found.' };

    const products = (data.campaign_products || [])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((cp) => cp.products)
      .filter(Boolean);

    let k;
    const { data: kpiRows } = await supabase.rpc('campaign_kpi_totals', {
      p_campaign_ids: [campaignId],
    });
    if (Array.isArray(kpiRows) && kpiRows[0]?.campaign_id === campaignId) k = kpiRows[0];

    return {
      ...data,
      impressions: k ? Number(k.impressions) : Number(data.impressions ?? 0),
      opens: k ? Number(k.opens) : Number(data.opens ?? 0),
      product_clicks: k ? Number(k.product_clicks) : Number(data.product_clicks ?? 0),
      add_to_cart_count: k ? Number(k.add_to_cart_count) : Number(data.add_to_cart_count ?? 0),
      purchases: k ? Number(k.purchases) : Number(data.purchases ?? 0),
      products,
    };
  },

  async updateCampaign(userId, campaignId, updates) {
    const vendorId = await getVendorIdForUser(userId);
    const { product_ids, min_age, max_age, ...rest } = updates || {};

    if (min_age != null && max_age != null && Number(min_age) > Number(max_age)) {
      throw { statusCode: 400, message: 'min_age cannot be greater than max_age.' };
    }

    const patch = Object.fromEntries(
      Object.entries({
        ...rest,
        min_age: min_age ?? undefined,
        max_age: max_age ?? undefined,
      }).filter(([_, v]) => v !== undefined)
    );

    const { data, error } = await supabase
      .from('campaigns')
      .update(patch)
      .eq('id', campaignId)
      .eq('vendor_id', vendorId)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (!data) throw { statusCode: 404, message: 'Campaign not found.' };

    if (Array.isArray(product_ids)) {
      const { data: owned } = await supabase
        .from('products')
        .select('id')
        .eq('vendor_id', vendorId)
        .in('id', product_ids)
        .is('deleted_at', null);
      const ownedIds = new Set((owned || []).map((p) => p.id));
      const filtered = product_ids.filter((id) => ownedIds.has(id));
      await replaceCampaignProducts(campaignId, filtered);
    }

    return data;
  },

  async setStatus(userId, campaignId, status) {
    return await this.updateCampaign(userId, campaignId, { status });
  },

  async getCampaignStats(userId, campaignId) {
    const vendorId = await getVendorIdForUser(userId);

    // Load campaign (ownership)
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, title, status, impressions, opens, product_clicks, add_to_cart_count, purchases, revenue, created_at')
      .eq('id', campaignId)
      .eq('vendor_id', vendorId)
      .single();

    if (!campaign) throw { statusCode: 404, message: 'Campaign not found.' };

    // Aggregate from events as source-of-truth (simple totals + per-type).
    const { data: events } = await supabase
      .from('campaign_events')
      .select('event_type')
      .eq('campaign_id', campaignId);

    const byType = (events || []).reduce((acc, e) => {
      acc[e.event_type] = (acc[e.event_type] || 0) + 1;
      return acc;
    }, {});

    const impressions = byType.impression || campaign.impressions || 0;
    const clicks = byType.product_click || campaign.product_clicks || 0;
    const opens = byType.open || campaign.opens || 0;
    const purchases = byType.purchase || campaign.purchases || 0;

    const ctr = impressions > 0 ? clicks / impressions : 0;
    const openRate = impressions > 0 ? opens / impressions : 0;
    const conversion = clicks > 0 ? purchases / clicks : 0;

    return {
      campaign,
      totals: {
        impressions,
        opens,
        clicks,
        add_to_cart: byType.add_to_cart || campaign.add_to_cart_count || 0,
        purchases,
        revenue: Number(campaign.revenue || 0),
        ctr,
        open_rate: openRate,
        conversion_rate: conversion,
      },
      by_type: byType,
    };
  },

  async trackEvent(userId, campaignId, body) {
    const { event_type, product_id, post_id, session_id, meta } = body;

    // Do not count the vendor's own interactions against their campaigns.
    const { data: owner } = await supabase
      .from('campaigns')
      .select('vendor_id, vendor_profiles!vendor_id(user_id)')
      .eq('id', campaignId)
      .single();
    const ownerUserId = owner?.vendor_profiles?.user_id;
    if (ownerUserId && ownerUserId === userId) {
      return { ignored: true };
    }

    // Basic de-dupe: ignore repeated events per user+campaign+type within the same session_id (if provided)
    if (session_id) {
      const { data: existing } = await supabase
        .from('campaign_events')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('user_id', userId)
        .eq('event_type', event_type)
        .eq('session_id', session_id)
        .maybeSingle();
      if (existing?.id) return { ignored: true };
    }

    // Insert raw event
    const { data, error } = await supabase.from('campaign_events').insert({
      campaign_id: campaignId,
      user_id: userId,
      event_type,
      product_id: product_id || null,
      post_id: post_id || null,
      session_id: session_id || null,
      meta: meta || null,
    }).select('id').single();

    if (error) throw error;

    // Increment denormalized KPI counters so vendor dashboard reflects changes immediately.
    try {
      await supabase.rpc('increment_campaign_kpi', {
        p_campaign_id: campaignId,
        p_event_type: event_type,
        p_revenue: meta?.revenue ?? 0,
      });
    } catch {
      // Ignore KPI increment failure; source of truth is campaign_events.
    }

    return { event_id: data?.id };
  },
};

