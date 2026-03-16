// src/modules/marketplace/products/products.controller.js
import { productsService } from './products.service.js';

export const productsController = {

  // POST /products
  async createProduct(request, reply) {
    const product = await productsService.createProduct(request.vendor.id, request.body);
    return reply.status(201).send({ success: true, product });
  },

  // GET /products
  async browseProducts(request, reply) {
    const result = await productsService.browseProducts(request.query);
    return reply.send({ success: true, ...result });
  },

  // GET /products/:id
  async getProduct(request, reply) {
    const product = await productsService.getProduct(request.params.id);
    return reply.send({ success: true, product });
  },

  // PATCH /products/:id
  async updateProduct(request, reply) {
    const product = await productsService.updateProduct(
      request.vendor.id, request.params.id, request.body,
    );
    return reply.send({ success: true, product });
  },

  // DELETE /products/:id
  async deleteProduct(request, reply) {
    await productsService.deleteProduct(request.vendor.id, request.params.id);
    return reply.send({ success: true, message: 'Product deleted.' });
  },

  // POST /products/:id/images
  async addImage(request, reply) {
    const image = await productsService.addProductImage(
      request.user.sub, request.vendor.id, request.params.id, request.body,
    );
    return reply.status(201).send({ success: true, image });
  },

  // DELETE /products/:id/images/:imageId
  async deleteImage(request, reply) {
    const { supabase } = await import('../../../config/supabase.js');
    // Ownership check via RLS
    const { error } = await supabase.from('product_images')
      .delete()
      .eq('id', request.params.imageId)
      .eq('product_id', request.params.id);
    if (error) throw { statusCode: 404, message: 'Image not found.' };
    return reply.send({ success: true, message: 'Image deleted.' });
  },

  // PATCH /products/:id/activate
  async activateProduct(request, reply) {
    const product = await productsService.updateProduct(
      request.vendor.id, request.params.id, { status: 'active' },
    );
    return reply.send({ success: true, product });
  },

  // POST /products/resale
  async createResaleListing(request, reply) {
    const product = await productsService.createResaleListing(
      request.user.sub, request.vendor.id, request.body,
    );
    return reply.status(201).send({ success: true, product });
  },
};
