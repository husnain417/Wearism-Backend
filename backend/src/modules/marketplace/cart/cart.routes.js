// src/modules/marketplace/cart/cart.routes.js
import { authenticate }    from '../../../middleware/authenticate.js';
import { cartController }  from './cart.controller.js';
import { addToCartSchema, updateCartItemSchema } from './cart.schema.js';

export async function cartRoutes(fastify) {
  // All cart routes require authentication
  fastify.addHook('preHandler', authenticate);

  // GET /cart
  fastify.get('/', cartController.getCart);

  // POST /cart/items
  fastify.post('/items', {
    schema: addToCartSchema,
    config: { rateLimit: { max: 100, timeWindow: '1 hour' } },
  }, cartController.addItem);

  // PATCH /cart/items/:id
  fastify.patch('/items/:id', {
    schema: updateCartItemSchema,
  }, cartController.updateItem);

  // DELETE /cart/items/:id
  fastify.delete('/items/:id', cartController.removeItem);

  // DELETE /cart  — clear entire cart
  fastify.delete('/', cartController.clearCart);
}
