// src/modules/marketplace/orders/orders.schema.js
import { paginationQuery } from '../../../utils/validate.js';

export const placeOrderSchema = {
  body: {
    type: 'object',
    required: ['delivery_address', 'delivery_city', 'delivery_phone'],
    properties: {
      delivery_address: { type: 'string', minLength: 5, maxLength: 300 },
      delivery_city:    { type: 'string', minLength: 2, maxLength: 100 },
      delivery_phone:   { type: 'string', minLength: 7, maxLength: 30  },
      delivery_notes:   { type: 'string', maxLength: 500 },
    },
    additionalProperties: false,
  },
};

export const listOrdersSchema = {
  querystring: {
    type: 'object',
    properties: {
      ...paginationQuery,
      status: { type: 'string', enum: ['pending','confirmed','processing','shipped','delivered','cancelled','refunded'] },
    },
    additionalProperties: false,
  },
};

export const cancelOrderSchema = {
  body: {
    type: 'object',
    properties: {
      reason: { type: 'string', maxLength: 300 },
    },
    additionalProperties: false,
  },
};
