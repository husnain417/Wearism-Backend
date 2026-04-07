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
    return reply.send(result);
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
    const productId = request.params.id;

    // Supports:
    // - multipart/form-data: { file, is_primary }
    // - JSON: { image_path, is_primary }
    const isMultipart = request.isMultipart?.() === true;

    let payload = request.body || {};

    if (isMultipart) {
      // With attachFieldsToBody='keyValues', request.body may contain fields and file as objects.
      // But on some clients (notably React Native/axios), the file may not get attached to body.
      // Fall back to request.file() to reliably read the first uploaded file.
      let filePart = payload?.file;
      if (Array.isArray(filePart)) filePart = filePart[0];

      const isPrimaryRaw =
        payload?.is_primary ??
        filePart?.fields?.is_primary?.value ??
        filePart?.fields?.is_primary;

      let buffer = null;
      let filename = `image_${Date.now()}.jpg`;
      let contentType = 'image/jpeg';

      // Case A: file is already a Buffer (same as wardrobe module)
      if (filePart && Buffer.isBuffer(filePart)) {
        buffer = filePart;
      }

      // Case B: file is a multipart file object with toBuffer()
      if (!buffer && filePart && typeof filePart.toBuffer === 'function') {
        buffer = await filePart.toBuffer();
        filename = filePart.filename || filename;
        contentType = filePart.mimetype || contentType;
      }

      // Case C: not attached to body — parse stream
      if (!buffer) {
        try {
          filePart = await request.file();
        } catch {
          filePart = null;
        }
        if (filePart && typeof filePart.toBuffer === 'function') {
          buffer = await filePart.toBuffer();
          filename = filePart.filename || filename;
          contentType = filePart.mimetype || contentType;
        }
      }

      if (!buffer) {
        return reply.status(400).send({ success: false, error: 'Image file is required.' });
      }

      const image_path = `${request.user.sub}/${productId}/${Date.now()}_${filename}`;

      const { supabase } = await import('../../../config/supabase.js');
      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(image_path, buffer, { contentType, upsert: false });
      if (uploadError) throw uploadError;

      payload = {
        image_path,
        is_primary: String(isPrimaryRaw) === 'true',
      };
    }

    const image = await productsService.addProductImage(
      request.user.sub,
      request.vendor.id,
      productId,
      payload,
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
