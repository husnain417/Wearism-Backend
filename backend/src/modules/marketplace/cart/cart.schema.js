// src/modules/marketplace/cart/cart.schema.js

export const addToCartSchema = {
  body: {
    type: 'object',
    required: ['product_id'],
    properties: {
      product_id: { type: 'string', format: 'uuid' },
      quantity:   { type: 'integer', minimum: 1, maximum: 99, default: 1 },
      // Optional campaign attribution (passed when user clicks product from a campaign)
      campaign_id:{ type: 'string', format: 'uuid' },
    },
    additionalProperties: false,
  },
};

export const updateCartItemSchema = {
  body: {
    type: 'object',
    required: ['quantity'],
    properties: {
      quantity: { type: 'integer', minimum: 1, maximum: 99 },
    },
    additionalProperties: false,
  },
};
