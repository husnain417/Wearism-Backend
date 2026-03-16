// src/modules/marketplace/orders/orders.controller.js
import { ordersService } from './orders.service.js';

export const ordersController = {

  // POST /orders  — place order from cart
  async placeOrder(request, reply) {
    const result = await ordersService.placeOrder(request.user.sub, request.body);
    return reply.status(201).send({ success: true, ...result });
  },

  // GET /orders  — buyer's own orders
  async listBuyerOrders(request, reply) {
    const result = await ordersService.listBuyerOrders(request.user.sub, {
      page:  request.query.page  ?? 1,
      limit: request.query.limit ?? 20,
    });
    return reply.send({ success: true, ...result });
  },

  // GET /orders/:id  — single order (buyer or vendor)
  async getOrder(request, reply) {
    const { supabase } = await import('../../../config/supabase.js');
    const userId = request.user.sub;

    const { data: order, error } = await supabase
      .from('orders')
      .select(`*, order_items(*), vendor_profiles!vendor_id(shop_name, shop_logo_url)`)
      .eq('id', request.params.id)
      .single();

    if (error || !order) throw { statusCode: 404, message: 'Order not found.' };

    // Allow only buyer or the vendor
    const isVendorOwner = await supabase
      .from('vendor_profiles')
      .select('id')
      .eq('id', order.vendor_id)
      .eq('user_id', userId)
      .single()
      .then(({ data }) => !!data);

    if (order.buyer_id !== userId && !isVendorOwner) {
      throw { statusCode: 403, message: 'Forbidden.' };
    }

    return reply.send({ success: true, order });
  },

  // PATCH /orders/:id/cancel  — buyer cancels (pending only)
  async cancelOrder(request, reply) {
    await ordersService.cancelOrder(request.user.sub, request.params.id);
    return reply.send({ success: true, message: 'Order cancelled.' });
  },

  // GET /orders/vendor  — vendor incoming orders
  async listVendorOrders(request, reply) {
    const result = await ordersService.listVendorOrders(request.vendor.id, {
      page:   request.query.page   ?? 1,
      limit:  request.query.limit  ?? 20,
      status: request.query.status,
    });
    return reply.send({ success: true, ...result });
  },

  // PATCH /orders/:id/confirm
  async confirmOrder(request, reply) {
    const order = await ordersService.updateOrderStatus(
      request.vendor.id, request.params.id, 'confirmed',
    );
    return reply.send({ success: true, order });
  },

  // PATCH /orders/:id/ship
  async shipOrder(request, reply) {
    const order = await ordersService.updateOrderStatus(
      request.vendor.id, request.params.id, 'shipped',
    );
    return reply.send({ success: true, order });
  },

  // PATCH /orders/:id/deliver
  async deliverOrder(request, reply) {
    const order = await ordersService.updateOrderStatus(
      request.vendor.id, request.params.id, 'delivered',
    );
    return reply.send({ success: true, order });
  },
};
