// src/modules/marketplace/orders/orders.routes.js
import { authenticate }     from '../../../middleware/authenticate.js';
import { requireVendor }    from '../../../middleware/requireVendor.js';
import { ordersController } from './orders.controller.js';
import { placeOrderSchema, listOrdersSchema, cancelOrderSchema } from './orders.schema.js';

export async function ordersRoutes(fastify) {
  // All order routes require authentication
  fastify.addHook('preHandler', authenticate);

  // POST /orders  — place order from cart (COD, splits by vendor)
  fastify.post('/', {
    schema: placeOrderSchema,
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
  }, ordersController.placeOrder);

  // GET /orders  — buyer's own orders
  fastify.get('/', {
    schema: listOrdersSchema,
  }, ordersController.listBuyerOrders);

  // GET /orders/vendor  — vendor incoming orders (must be before /:id to avoid conflict)
  fastify.get('/vendor', {
    preHandler: [authenticate, requireVendor],
    schema: listOrdersSchema,
  }, ordersController.listVendorOrders);

  // GET /orders/:id  — order detail (buyer or vendor)
  fastify.get('/:id', ordersController.getOrder);

  // PATCH /orders/:id/cancel  — buyer cancels (pending_confirmation only)
  fastify.patch('/:id/cancel', {
    schema: cancelOrderSchema,
  }, ordersController.cancelOrder);

  // PATCH /orders/:id/confirm  — vendor confirms
  fastify.patch('/:id/confirm', {
    preHandler: [authenticate, requireVendor],
  }, ordersController.confirmOrder);

  // PATCH /orders/:id/ship  — vendor marks shipped
  fastify.patch('/:id/ship', {
    preHandler: [authenticate, requireVendor],
  }, ordersController.shipOrder);

  // PATCH /orders/:id/deliver  — vendor marks delivered (auto-completes)
  fastify.patch('/:id/deliver', {
    preHandler: [authenticate, requireVendor],
  }, ordersController.deliverOrder);
}
