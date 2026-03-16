// src/modules/marketplace/products/products.schema.js

export const createProductSchema = {
  body: {
    type: 'object',
    required: ['name', 'category', 'price'],
    properties: {
      name:           { type: 'string', minLength: 2, maxLength: 150 },
      description:    { type: 'string', maxLength: 2000 },
      category:       { type: 'string', enum: ['tops','bottoms','outerwear','footwear','accessories','dresses','bags','jewelry','activewear','swimwear','other'] },
      brand:          { type: 'string', maxLength: 100 },
      condition:      { type: 'string', enum: ['new','like_new','good','fair','poor'] },
      price:          { type: 'number', minimum: 0.01 },
      original_price: { type: 'number', minimum: 0 },
      stock_quantity: { type: 'integer', minimum: 0 },
      tags:           { type: 'array', items: { type: 'string' }, maxItems: 20 },
    },
    additionalProperties: false,
  },
};

export const updateProductSchema = {
  body: {
    type: 'object',
    properties: {
      name:           { type: 'string', minLength: 2, maxLength: 150 },
      description:    { type: 'string', maxLength: 2000 },
      category:       { type: 'string', enum: ['tops','bottoms','outerwear','footwear','accessories','dresses','bags','jewelry','activewear','swimwear','other'] },
      brand:          { type: 'string', maxLength: 100 },
      condition:      { type: 'string', enum: ['new','like_new','good','fair','poor'] },
      price:          { type: 'number', minimum: 0.01 },
      original_price: { type: 'number', minimum: 0 },
      stock_quantity: { type: 'integer', minimum: 0 },
      tags:           { type: 'array', items: { type: 'string' }, maxItems: 20 },
      status:         { type: 'string', enum: ['draft','active','archived'] },
    },
    additionalProperties: false,
  },
};

export const browseProductsSchema = {
  querystring: {
    type: 'object',
    properties: {
      page:       { type: 'integer', minimum: 1, default: 1 },
      limit:      { type: 'integer', minimum: 1, maximum: 50, default: 20 },
      category:   { type: 'string' },
      condition:  { type: 'string' },
      min_price:  { type: 'number' },
      max_price:  { type: 'number' },
      vendor_id:  { type: 'string' },
      is_resale:  { type: 'boolean' },
      search:     { type: 'string' },
      sort:       { type: 'string', enum: ['newest','price_asc','price_desc'], default: 'newest' },
    },
  },
};

export const addImageSchema = {
  body: {
    type: 'object',
    required: ['image_path'],
    properties: {
      image_path: { type: 'string' },
      is_primary: { type: 'boolean', default: false },
    },
    additionalProperties: false,
  },
};

export const resaleSchema = {
  body: {
    type: 'object',
    required: ['wardrobe_item_id', 'price'],
    properties: {
      wardrobe_item_id: { type: 'string', format: 'uuid' },
      price:            { type: 'number', minimum: 0.01 },
      description:      { type: 'string', maxLength: 2000 },
    },
    additionalProperties: false,
  },
};
