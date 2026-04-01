// src/modules/marketplace/orders/orders.routes.js
import { authenticate }     from '../../../middleware/authenticate.js';
import { requireVendor }    from '../../../middleware/requireVendor.js';
import { ordersController } from './orders.controller.js';
import { placeOrderSchema, listOrdersSchema, cancelOrderSchema } from './orders.schema.js';

export async function ordersRoutes(fastify) {
  fastify.addHook('preHandler', authenticate);

  fastify.post('/', {
    schema: { ...placeOrderSchema, tags: ['Marketplace'], summary: 'Place order from cart (COD, splits by vendor)' },
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
  }, ordersController.placeOrder);

  fastify.get('/', {
    schema: { ...listOrdersSchema, tags: ['Marketplace'], summary: 'List buyer orders' },
  }, ordersController.listBuyerOrders);

  fastify.get('/vendor', {
    preHandler: [authenticate, requireVendor],
    schema: { ...listOrdersSchema, tags: ['Marketplace'], summary: 'List vendor incoming orders' },
  }, ordersController.listVendorOrders);

  fastify.get('/:id', {
    schema: { tags: ['Marketplace'], summary: 'Get order detail' },
  }, ordersController.getOrder);

  fastify.patch('/:id/cancel', {
    schema: { ...cancelOrderSchema, tags: ['Marketplace'], summary: 'Buyer cancels pending order' },
  }, ordersController.cancelOrder);

  fastify.patch('/:id/confirm', {
    schema: { tags: ['Marketplace'], summary: 'Vendor confirms order' },
    preHandler: [authenticate, requireVendor],
  }, ordersController.confirmOrder);

  fastify.patch('/:id/ship', {
    schema: { tags: ['Marketplace'], summary: 'Vendor marks order shipped' },
    preHandler: [authenticate, requireVendor],
  }, ordersController.shipOrder);

  fastify.patch('/:id/deliver', {
    schema: { tags: ['Marketplace'], summary: 'Vendor marks order delivered' },
    preHandler: [authenticate, requireVendor],
  }, ordersController.deliverOrder);
}
