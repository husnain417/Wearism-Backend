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
