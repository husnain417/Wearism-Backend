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

  // POST /products  — vendor creates product (starts as draft)
  fastify.post('/', {
    preHandler: [authenticate, requireVendor],
    schema: createProductSchema,
    config: { rateLimit: { max: 50, timeWindow: '1 hour' } },
  }, productsController.createProduct);

  // GET /products  — public browse with filters
  fastify.get('/', {
    schema: browseProductsSchema,
  }, productsController.browseProducts);

  // POST /products/resale — auth + vendor: list a wardrobe item for resale
  fastify.post('/resale', {
    preHandler: [authenticate, requireVendor],
    schema: resaleSchema,
  }, productsController.createResaleListing);

  // GET /products/:id  — public single product
  fastify.get('/:id', productsController.getProduct);

  // PATCH /products/:id  — vendor updates own product
  fastify.patch('/:id', {
    preHandler: [authenticate, requireVendor],
    schema: updateProductSchema,
  }, productsController.updateProduct);

  // DELETE /products/:id  — vendor soft-deletes own product
  fastify.delete('/:id', {
    preHandler: [authenticate, requireVendor],
  }, productsController.deleteProduct);

  // PATCH /products/:id/activate  — vendor publishes draft product
  fastify.patch('/:id/activate', {
    preHandler: [authenticate, requireVendor],
  }, productsController.activateProduct);

  // POST /products/:id/images  — vendor adds image (max 6)
  fastify.post('/:id/images', {
    preHandler: [authenticate, requireVendor],
    schema: addImageSchema,
  }, productsController.addImage);

  // DELETE /products/:id/images/:imageId  — vendor removes image
  fastify.delete('/:id/images/:imageId', {
    preHandler: [authenticate, requireVendor],
  }, productsController.deleteImage);
}
