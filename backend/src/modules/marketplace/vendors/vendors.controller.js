// src/modules/marketplace/vendors/vendors.controller.js
import { vendorsService } from './vendors.service.js';

export const vendorsController = {

  // POST /vendors/register
  async register(request, reply) {
    const vendor = await vendorsService.register(request.user.sub, request.body);
    return reply.status(201).send({ success: true, vendor });
  },

  // GET /vendors/me
  async getMyProfile(request, reply) {
    const vendor = await vendorsService.getMyProfile(request.user.sub);
    return reply.send({ success: true, vendor });
  },

  // PATCH /vendors/me
  async updateProfile(request, reply) {
    const vendor = await vendorsService.updateProfile(request.user.sub, request.body);
    return reply.send({ success: true, vendor });
  },

  // GET /vendors/me/stats
  async getDashboardStats(request, reply) {
    const stats = await vendorsService.getDashboardStats(request.user.sub);
    return reply.send({ success: true, ...stats });
  },

  async getAnalytics(request, reply) {
    const analytics = await vendorsService.getAnalytics(request.user.sub);
    return reply.send({ success: true, analytics });
  },

  // GET /vendors/me/products
  async getMyProducts(request, reply) {
    const products = await vendorsService.getMyProducts(request.user.sub);
    return reply.send({ success: true, products });
  },

  // GET /vendors/me/products/:productId
  async getMyProduct(request, reply) {
    const product = await vendorsService.getMyProduct(request.user.sub, request.params.productId);
    return reply.send({ success: true, product });
  },

  // GET /vendors/:vendorId
  async getPublicProfile(request, reply) {
    const vendor = await vendorsService.getPublicProfile(request.params.vendorId);
    return reply.send({ success: true, vendor });
  },

  // GET /vendors/:vendorId/products  — delegated to productsService
  async getVendorProducts(request, reply) {
    const { productsService } = await import('../products/products.service.js');
    const result = await productsService.browseProducts({
      ...request.query,
      vendor_id: request.params.vendorId,
    });
    return reply.send({ success: true, ...result });
  },
};
