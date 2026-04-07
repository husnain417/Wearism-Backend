import { supabase } from '../../../config/supabase.js';
import { parsePagination, paginatedResult } from '../../../utils/pagination.js';

const MAX_IMAGES = 6;

export const productsService = {

  async createProduct(vendorId, body) {
    const { name, description, category, condition, price,
            original_price, stock_quantity, tags } = body;

    const { data, error } = await supabase.from('products').insert({
      vendor_id: vendorId, name, description: description||null,
      category, condition: condition||'new',
      price, original_price: original_price||null,
      stock_quantity: stock_quantity??1, tags: tags||[], status: 'draft',
    }).select().single();

    if (error) throw error;
    return data;
  },


  async browseProducts(query) {
    const { page, limit, from } = parsePagination(query);
    const { category, condition, min_price, max_price, vendor_id, is_resale, search, sort } = query;

    let q = supabase.from('products')
      .select(`id, name, category, condition, price, original_price,
        primary_image_url, stock_quantity, is_resale, created_at,
        vendor_profiles!vendor_id(id, shop_name)`, { count:'exact' })
      .eq('status','active').is('deleted_at',null).gt('stock_quantity',0)
      .range(from, from + limit - 1);

    if (category)  q = q.eq('category', category);
    if (condition) q = q.eq('condition', condition);
    if (vendor_id) q = q.eq('vendor_id', vendor_id);
    if (is_resale !== undefined) q = q.eq('is_resale', is_resale);
    if (min_price) q = q.gte('price', min_price);
    if (max_price) q = q.lte('price', max_price);
    if (search)    q = q.textSearch('name', search, { type: 'websearch' });

    const sortMap = {
      newest:     { col:'created_at', asc:false },
      price_asc:  { col:'price',      asc:true  },
      price_desc: { col:'price',      asc:false },
    };
    const { col, asc } = sortMap[sort] || sortMap.newest;
    q = q.order(col, { ascending: asc });

    const { data, error, count } = await q;
    if (error) throw error;

    return paginatedResult(data || [], count || 0, page, limit);
  },


  async getProduct(productId) {
    const { data, error } = await supabase.from('products')
      .select(`*, vendor_profiles!vendor_id(id,shop_name,avg_rating),
               product_images(id,image_url,is_primary,sort_order)`)
      .eq('id', productId).eq('status','active').is('deleted_at',null).single();
    if (error) throw { statusCode:404, message:'Product not found.' };
    return data;
  },


  async updateProduct(vendorId, productId, updates) {
    const allowed = ['name','description','category','condition',
                     'price','original_price','stock_quantity','tags','status'];
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([k,v]) => allowed.includes(k) && v !== undefined)
    );
    const { data, error } = await supabase.from('products')
      .update(filtered).eq('id',productId).eq('vendor_id',vendorId)
      .is('deleted_at',null).select().maybeSingle();
    if (error) throw error;
    if (!data) throw { statusCode:404, message:'Product not found.' };
    return data;
  },


  async deleteProduct(vendorId, productId) {
    const { error } = await supabase.from('products')
      .update({ deleted_at: new Date().toISOString(), status:'archived' })
      .eq('id',productId).eq('vendor_id',vendorId);
    if (error) throw { statusCode:404, message:'Product not found.' };
  },


  async addProductImage(userId, vendorId, productId, { image_path, is_primary=false }) {
    // Ownership check
    const { data: product } = await supabase.from('products')
      .select('id').eq('id',productId).eq('vendor_id',vendorId).single();
    if (!product) throw { statusCode:404, message:'Product not found.' };

    // Max image check
    const { count } = await supabase.from('product_images')
      .select('*',{count:'exact',head:true}).eq('product_id',productId);
    if (count >= MAX_IMAGES)
      throw { statusCode:400, message:`Maximum ${MAX_IMAGES} images per product.` };

    // Path ownership
    if (!image_path.startsWith(`${userId}/`))
      throw { statusCode:403, message:'Invalid image path.' };

    const { data: signed } = await supabase.storage
      .from('products').createSignedUrl(image_path, 60*60*24*365);

    if (is_primary) {
      await supabase.from('product_images')
        .update({ is_primary:false }).eq('product_id',productId);
    }

    const { data: img, error } = await supabase.from('product_images')
      .insert({ product_id:productId, image_url:signed.signedUrl,
                image_path, is_primary, sort_order:count })
      .select().single();
    if (error) throw error;

    if (is_primary) {
      await supabase.from('products')
        .update({ primary_image_url:signed.signedUrl }).eq('id',productId);
    }
    return img;
  },


  async createResaleListing(userId, vendorId, { wardrobe_item_id, price, description }) {
    const { data: item } = await supabase.from('wardrobe_items')
      .select(`id,name,wardrobe_slot,fashionclip_main_category,fashionclip_attributes,
               primary_image_url,is_sold,is_listed_for_sale`)
      .eq('id',wardrobe_item_id).eq('user_id',userId).single();

    if (!item)               throw { statusCode:404, message:'Wardrobe item not found.' };
    if (item.is_sold)        throw { statusCode:400, message:'Item already sold.' };
    if (item.is_listed_for_sale) throw { statusCode:400, message:'Already listed for sale.' };

    const slotToCategory = {
      upperwear:'tops', lowerwear:'bottoms', outerwear:'outerwear', accessories:'accessories'
    };
    const category = slotToCategory[item.wardrobe_slot] || 'other';

    const { data: product, error } = await supabase.from('products').insert({
      vendor_id:        vendorId,
      wardrobe_item_id: wardrobe_item_id,
      name:             item.name || item.fashionclip_main_category || 'Wardrobe Item',
      description:      description || null,
      category,
      condition:        'good',
      price,
      stock_quantity:   1,
      is_resale:        true,
      ai_attributes:    item.fashionclip_attributes || [],
      wardrobe_slot:    item.wardrobe_slot,
      primary_image_url: item.primary_image_url || null,
      status:           'active',
    }).select().single();

    if (error) throw error;

    await supabase.from('wardrobe_items')
      .update({ is_listed_for_sale:true }).eq('id',wardrobe_item_id);

    return product;
  },
};
