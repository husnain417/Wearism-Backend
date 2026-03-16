import { supabase } from '../../../config/supabase.js';

export const vendorsService = {

  async register(userId, body) {
    const { shop_name, shop_description, contact_email, contact_phone, business_address } = body;

    const { data: existing } = await supabase
      .from('vendor_profiles').select('id, status').eq('user_id', userId).single();

    if (existing) {
      throw { statusCode: 400, message: `Already registered as vendor. Status: ${existing.status}` };
    }

    const { data, error } = await supabase
      .from('vendor_profiles')
      .insert({ user_id: userId, shop_name, shop_description: shop_description||null,
                contact_email, contact_phone: contact_phone||null,
                business_address: business_address||null, status: 'pending' })
      .select().single();

    if (error) throw error;
    return data;
  },


  async getMyProfile(userId) {
    const { data, error } = await supabase
      .from('vendor_profiles').select('*').eq('user_id', userId).single();
    if (error) throw { statusCode: 404, message: 'Vendor profile not found.' };
    return data;
  },


  async updateProfile(userId, updates) {
    const allowed = ['shop_name','shop_description','contact_email','contact_phone','business_address'];
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([k,v]) => allowed.includes(k) && v !== undefined)
    );
    if (!Object.keys(filtered).length) throw { statusCode: 400, message: 'No valid fields.' };

    const { data, error } = await supabase
      .from('vendor_profiles').update(filtered).eq('user_id', userId).select().single();
    if (error) throw error;
    return data;
  },


  async getPublicProfile(vendorId) {
    const { data, error } = await supabase
      .from('vendor_profiles')
      .select(`id, shop_name, shop_description, shop_logo_url, shop_banner_url,
               avg_rating, rating_count, total_sales, products_count, created_at,
               profiles!user_id(username, avatar_url)`)
      .eq('id', vendorId).eq('status', 'approved').single();
    if (error) throw { statusCode: 404, message: 'Vendor not found.' };
    return data;
  },


  async getDashboardStats(userId) {
    const { data: vendor } = await supabase
      .from('vendor_profiles')
      .select('id, total_sales, total_revenue, products_count, avg_rating')
      .eq('user_id', userId).single();
    if (!vendor) throw { statusCode: 404, message: 'Not found.' };

    const [{ data: recentOrders }, { data: statusRows }] = await Promise.all([
      supabase.from('orders').select('id, status, total_amount, created_at')
        .eq('vendor_id', vendor.id).order('created_at',{ascending:false}).limit(5),
      supabase.from('orders').select('status').eq('vendor_id', vendor.id),
    ]);

    const byStatus = (statusRows||[]).reduce((acc,o)=>{ acc[o.status]=(acc[o.status]||0)+1; return acc; },{});

    return { summary: vendor, orders_by_status: byStatus, recent_orders: recentOrders||[] };
  },
};
