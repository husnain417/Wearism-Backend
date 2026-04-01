// src/modules/marketplace/products/products.routes.js
import { authenticate }        from '../../../middleware/authenticate.js';
import { requireVendor }       from '../../../middleware/requireVendor.js';
import { productsController }  from './products.controller.js';
import {
  createProductSchema,
  updateProductSchema,
  browseProductsSchema,
  addImageSchema,
  resaleSchema,
} from './products.schema.js';

export async function productsRoutes(fastify) {

  fastify.post('/', {
    preHandler: [authenticate, requireVendor],
    schema: { ...createProductSchema, tags: ['Marketplace'], summary: 'Create a product (vendor only)' },
    config: { rateLimit: { max: 50, timeWindow: '1 hour' } },
  }, productsController.createProduct);

  fastify.get('/', {
    schema: { ...browseProductsSchema, tags: ['Marketplace'], summary: 'Browse products with filters and search' },
  }, productsController.browseProducts);

  fastify.post('/resale', {
    preHandler: [authenticate, requireVendor],
    schema: { ...resaleSchema, tags: ['Marketplace'], summary: 'List a wardrobe item for resale' },
  }, productsController.createResaleListing);

  fastify.get('/:id', {
    schema: { tags: ['Marketplace'], summary: 'Get a single product' },
  }, productsController.getProduct);

  fastify.patch('/:id', {
    preHandler: [authenticate, requireVendor],
    schema: { ...updateProductSchema, tags: ['Marketplace'], summary: 'Update own product' },
  }, productsController.updateProduct);

  fastify.delete('/:id', {
    schema: { tags: ['Marketplace'], summary: 'Soft-delete own product' },
    preHandler: [authenticate, requireVendor],
  }, productsController.deleteProduct);

  fastify.patch('/:id/activate', {
    schema: { tags: ['Marketplace'], summary: 'Publish draft product' },
    preHandler: [authenticate, requireVendor],
  }, productsController.activateProduct);

  fastify.post('/:id/images', {
    preHandler: [authenticate, requireVendor],
    schema: { ...addImageSchema, tags: ['Marketplace'], summary: 'Add product image (max 6)' },
  }, productsController.addImage);

  fastify.delete('/:id/images/:imageId', {
    schema: { tags: ['Marketplace'], summary: 'Remove a product image' },
    preHandler: [authenticate, requireVendor],
  }, productsController.deleteImage);
}
