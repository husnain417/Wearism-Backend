// src/modules/marketplace/vendors/vendors.routes.js
import { authenticate }    from '../../../middleware/authenticate.js';
import { requireVendor }   from '../../../middleware/requireVendor.js';
import { vendorsController } from './vendors.controller.js';
import { registerVendorSchema, updateVendorSchema } from './vendors.schema.js';

export async function vendorsRoutes(fastify) {

  fastify.post('/register', {
    preHandler: [authenticate],
    schema: { ...registerVendorSchema, tags: ['Marketplace'], summary: 'Register as a vendor' },
  }, vendorsController.register);

  fastify.get('/me', {
    schema: { tags: ['Marketplace'], summary: 'Get own vendor profile' },
    preHandler: [authenticate],
  }, vendorsController.getMyProfile);

  fastify.patch('/me', {
    preHandler: [authenticate, requireVendor],
    schema: { ...updateVendorSchema, tags: ['Marketplace'], summary: 'Update own vendor profile' },
  }, vendorsController.updateProfile);

  fastify.get('/me/stats', {
    schema: { tags: ['Marketplace'], summary: 'Vendor dashboard stats' },
    preHandler: [authenticate, requireVendor],
  }, vendorsController.getDashboardStats);

  fastify.get('/me/products', {
    schema: { tags: ['Marketplace'], summary: 'Get own vendor products (inventory)' },
    preHandler: [authenticate, requireVendor],
  }, vendorsController.getMyProducts);

  fastify.get('/me/products/:productId', {
    schema: { tags: ['Marketplace'], summary: 'Get a single own vendor product (for editing)' },
    preHandler: [authenticate, requireVendor],
  }, vendorsController.getMyProduct);

  fastify.get('/:vendorId', {
    schema: { tags: ['Marketplace'], summary: 'Get public vendor storefront' },
  }, vendorsController.getPublicProfile);

  fastify.get('/:vendorId/products', {
    schema: { tags: ['Marketplace'], summary: 'Get all products by a vendor' },
  }, vendorsController.getVendorProducts);
}
