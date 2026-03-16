// src/modules/marketplace/vendors/vendors.routes.js
import { authenticate }    from '../../../middleware/authenticate.js';
import { requireVendor }   from '../../../middleware/requireVendor.js';
import { vendorsController } from './vendors.controller.js';
import { registerVendorSchema, updateVendorSchema } from './vendors.schema.js';

export async function vendorsRoutes(fastify) {

  // POST /vendors/register  — authenticated user registers as vendor
  fastify.post('/register', {
    preHandler: [authenticate],
    schema: registerVendorSchema,
  }, vendorsController.register);

  // GET /vendors/me  — own vendor profile (auth required, but NOT requireVendor — pending users need this)
  fastify.get('/me', {
    preHandler: [authenticate],
  }, vendorsController.getMyProfile);

  // PATCH /vendors/me  — update own profile (must be approved vendor)
  fastify.patch('/me', {
    preHandler: [authenticate, requireVendor],
    schema: updateVendorSchema,
  }, vendorsController.updateProfile);

  // GET /vendors/me/stats  — dashboard stats (must be approved vendor)
  fastify.get('/me/stats', {
    preHandler: [authenticate, requireVendor],
  }, vendorsController.getDashboardStats);

  // GET /vendors/:vendorId  — public storefront (no auth)
  fastify.get('/:vendorId', vendorsController.getPublicProfile);

  // GET /vendors/:vendorId/products  — products by vendor (no auth)
  fastify.get('/:vendorId/products', vendorsController.getVendorProducts);
}
