// src/modules/marketplace/vendors/vendors.schema.js

export const registerVendorSchema = {
  body: {
    type: 'object',
    required: ['shop_name', 'contact_email'],
    properties: {
      shop_name:        { type: 'string', minLength: 2, maxLength: 100 },
      shop_description: { type: 'string', maxLength: 1000 },
      contact_email:    { type: 'string', format: 'email' },
      contact_phone:    { type: 'string', maxLength: 30 },
      business_address: { type: 'string', maxLength: 300 },
    },
    additionalProperties: false,
  },
};

export const updateVendorSchema = {
  body: {
    type: 'object',
    properties: {
      shop_name:        { type: 'string', minLength: 2, maxLength: 100 },
      shop_description: { type: 'string', maxLength: 1000 },
      contact_email:    { type: 'string', format: 'email' },
      contact_phone:    { type: 'string', maxLength: 30 },
      business_address: { type: 'string', maxLength: 300 },
    },
    additionalProperties: false,
  },
};
