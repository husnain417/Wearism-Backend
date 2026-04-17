import { supabase } from '../../../config/supabase.js';
import { parsePagination, paginatedResult } from '../../../utils/pagination.js';
import { sendToUser } from '../../../services/notifications.js';

const TRANSITIONS = {
  // Keep in sync with DB enum `order_status_enum` (see `supabase/migrations/DB/002_enums.sql`).
  // Current DB enum values: pending, confirmed, processing, shipped, delivered, cancelled, refunded
  pending:   ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing:['shipped', 'cancelled'],
  shipped:   ['delivered'],
};

export const ordersService = {

  async placeOrder(userId, { delivery_address, delivery_city, delivery_phone, delivery_notes }) {
    const { data: cartItems } = await supabase.from('cart_items')
      .select(`quantity, products!product_id(
        id, name, price, primary_image_url, stock_quantity, status, vendor_id),
        campaign_id`)
      .eq('user_id', userId);

    if (!cartItems?.length) throw { statusCode:400, message:'Cart is empty.' };

    for (const item of cartItems) {
      const p = item.products;
      if (p.status !== 'active')
        throw { statusCode:400, message:`${p.name} is no longer available.` };
      if (p.stock_quantity < item.quantity)
        throw { statusCode:400, message:`Insufficient stock for ${p.name}.` };
    }

    const byVendor = cartItems.reduce((acc, item) => {
      const vid = item.products.vendor_id;
      (acc[vid] = acc[vid]||[]).push(item);
      return acc;
    }, {});

    const createdOrders = [];

    for (const [vendorId, items] of Object.entries(byVendor)) {
      const total = Number(items.reduce((s,i) => s+(i.products.price*i.quantity), 0).toFixed(2));

      // Attribution: last-touch campaign within this vendor's split (if any)
      const firstCampaignId = (items.find((i) => i.campaign_id)?.campaign_id) || null;

      const { data: order, error: oErr } = await supabase.from('orders').insert({
        buyer_id: userId, vendor_id: vendorId,
        delivery_address, delivery_city, delivery_phone,
        delivery_notes: delivery_notes||null,
        subtotal: total, total_amount: total,
        payment_method: 'cash_on_delivery', status: 'pending',
        campaign_id: firstCampaignId,
      }).select().single();

      if (oErr) throw oErr;

      await supabase.from('order_items').insert(
        items.map(i => ({
          order_id:      order.id,
          product_id:    i.products.id,
          product_name:  i.products.name,
          product_image: i.products.primary_image_url,
          unit_price:    i.products.price,
          quantity:      i.quantity,
          line_total:    Number((i.products.price * i.quantity).toFixed(2)),
          campaign_id:   i.campaign_id || null,
        }))
      );

      // Decrement stock
      for (const item of items) {
        await supabase.from('products')
          .update({ stock_quantity: item.products.stock_quantity - item.quantity })
          .eq('id', item.products.id);
      }

      // Notify vendor
      sendToUser(vendorId, {
          title: 'New Order Received',
          body: `You have received a new order for PKR ${order.total_amount}`,
          data: { type: 'order_received', orderId: order.id },
      }).catch(() => {});

      createdOrders.push(order);
    }

    // Clear cart
    await supabase.from('cart_items').delete().eq('user_id', userId);

    return { orders: createdOrders, count: createdOrders.length };
  },


  async listBuyerOrders(userId, query) {
    const { page, limit, from } = parsePagination(query);
    const { data, count, error } = await supabase.from('orders')
      .select(`*, order_items(*), vendor_profiles!vendor_id(shop_name)`,
               { count:'exact' })
      .eq('buyer_id', userId).order('created_at',{ascending:false})
      .range(from, from+limit-1);
    if (error) throw error;
    return paginatedResult(data || [], count || 0, page, limit);
  },


  async listVendorOrders(vendorId, query) {
    const { page, limit, from } = parsePagination(query);
    const { status } = query;
    let q = supabase.from('orders')
      // `profiles` table stores `full_name` (not `username`) per `supabase/migrations/DB/001_create_profiles.sql`
      .select(`*, order_items(*), profiles!buyer_id(id, full_name, avatar_url)`,{count:'exact'})
      .eq('vendor_id', vendorId).order('created_at',{ascending:false})
      .range(from, from + limit - 1);
    if (status) q = q.eq('status', status);
    const { data, count, error } = await q;
    if (error) throw error;
    return paginatedResult(data || [], count || 0, page, limit);
  },


  async updateOrderStatus(vendorId, orderId, newStatus, cancelledReason) {
    const { data: order } = await supabase.from('orders')
      .select('id, status').eq('id',orderId).eq('vendor_id',vendorId).single();

    if (!order) throw { statusCode:404, message:'Order not found.' };

    const allowed = TRANSITIONS[order.status]||[];
    if (!allowed.includes(newStatus))
      throw { statusCode:400, message:`Cannot transition from ${order.status} to ${newStatus}.` };

    const now = new Date().toISOString();
    const tsMap = {
      confirmed: { confirmed_at:now },
      processing:{ processed_at:now },
      shipped:   { shipped_at:now   },
      delivered: { delivered_at:now },
      cancelled: { cancelled_at:now, cancelled_reason:cancelledReason||null },
    };

    const patch = { status: newStatus, ...(tsMap[newStatus] || {}) };

    const { data, error } = await supabase.from('orders')
      .update(patch).eq('id',orderId).select().single();
    if (error) throw error;

    // Mark resale products as sold when delivered
    if (patch.status === 'delivered') {
      const { data: oi } = await supabase.from('order_items')
        .select('product_id').eq('order_id',orderId);
      for (const item of oi||[]) {
        await supabase.from('products')
          .update({ status:'sold' })
          .eq('id',item.product_id).eq('is_resale',true);
      }
    }

    // Notify buyer of status change
    if (data) {
        let title = '';
        let body = '';
        if (patch.status === 'confirmed') {
            title = 'Order Confirmed';
            body = 'Your order has been confirmed by the vendor';
        } else if (patch.status === 'shipped') {
            title = 'Order Shipped';
            body = 'Your order is on the way';
        } else if (patch.status === 'delivered') {
            title = 'Order Delivered';
            body = 'Your order has been delivered';
        }
        
        if (title) {
            sendToUser(data.buyer_id, {
                title,
                body,
                data: { type: 'order_status', orderId: orderId, status: patch.status },
            }).catch(() => {});
        }
    }

    return data;
  },


  async cancelOrder(userId, orderId) {
    const { data: order } = await supabase.from('orders')
      .select('id, status').eq('id',orderId).eq('buyer_id',userId).single();
    if (!order) throw { statusCode:404, message:'Order not found.' };
    if (order.status !== 'pending')
      throw { statusCode:400, message:'Only pending orders can be cancelled.' };

    // Restore stock
    const { data: items } = await supabase.from('order_items')
      .select('product_id, quantity').eq('order_id',orderId);
    for (const item of items||[]) {
      await supabase.rpc('increment_stock', { p_product_id:item.product_id, p_qty:item.quantity });
    }

    await supabase.from('orders')
      .update({ status:'cancelled', cancelled_at:new Date().toISOString() })
      .eq('id',orderId);
  },
};
