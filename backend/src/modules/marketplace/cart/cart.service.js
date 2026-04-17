import { supabase } from '../../../config/supabase.js';

export const cartService = {

  async getCart(userId) {
    const { data: items } = await supabase.from('cart_items')
      .select(`id, quantity,
        products!product_id(id, name, price, primary_image_url,
          stock_quantity, status, vendor_profiles!vendor_id(id, shop_name))`)
      .eq('user_id', userId).order('created_at', { ascending:false });

    const valid = (items||[]).filter(i =>
      i.products?.status === 'active' && i.products?.stock_quantity > 0
    );
    const subtotal = valid.reduce((s,i) => s + (i.products.price * i.quantity), 0);

    return {
      items: valid,
      subtotal: Number(subtotal.toFixed(2)),
      item_count: valid.length,
      unavailable_count: (items||[]).length - valid.length,
    };
  },


  async addItem(userId, { product_id, quantity=1, campaign_id }) {
    const { data: product } = await supabase.from('products')
      .select('id, stock_quantity, status, vendor_profiles!vendor_id(user_id)')
      .eq('id', product_id).eq('status','active').single();

    if (!product) throw { statusCode:404, message:'Product not found or unavailable.' };
    if (product.stock_quantity < quantity)
      throw { statusCode:400, message:`Only ${product.stock_quantity} in stock.` };
    if (product.vendor_profiles?.user_id === userId)
      throw { statusCode:400, message:'Cannot add your own products to cart.' };

    const { data, error } = await supabase.from('cart_items')
      .upsert({ user_id:userId, product_id, quantity, campaign_id: campaign_id || null },
               { onConflict:'user_id,product_id', ignoreDuplicates:false })
      .select().single();

    if (error) throw error;
    return data;
  },


  async updateItem(userId, cartItemId, quantity) {
    const { data, error } = await supabase.from('cart_items')
      .update({ quantity }).eq('id',cartItemId).eq('user_id',userId).select().single();
    if (error) throw { statusCode:404, message:'Cart item not found.' };
    return data;
  },


  async removeItem(userId, cartItemId) {
    await supabase.from('cart_items')
      .delete().eq('id',cartItemId).eq('user_id',userId);
  },

  async clearCart(userId) {
    await supabase.from('cart_items').delete().eq('user_id',userId);
  },
};
