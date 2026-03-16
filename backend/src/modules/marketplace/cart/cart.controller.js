// src/modules/marketplace/cart/cart.controller.js
import { cartService } from './cart.service.js';

export const cartController = {

  // GET /cart
  async getCart(request, reply) {
    const cart = await cartService.getCart(request.user.sub);
    return reply.send({ success: true, ...cart });
  },

  // POST /cart/items
  async addItem(request, reply) {
    const item = await cartService.addItem(request.user.sub, request.body);
    return reply.status(201).send({ success: true, item });
  },

  // PATCH /cart/items/:id
  async updateItem(request, reply) {
    const item = await cartService.updateItem(
      request.user.sub, request.params.id, request.body.quantity,
    );
    return reply.send({ success: true, item });
  },

  // DELETE /cart/items/:id
  async removeItem(request, reply) {
    await cartService.removeItem(request.user.sub, request.params.id);
    return reply.send({ success: true, message: 'Item removed from cart.' });
  },

  // DELETE /cart
  async clearCart(request, reply) {
    await cartService.clearCart(request.user.sub);
    return reply.send({ success: true, message: 'Cart cleared.' });
  },
};
