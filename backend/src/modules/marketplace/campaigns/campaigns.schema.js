// src/modules/marketplace/campaigns/campaigns.schema.js

export const createCampaignSchema = {
  body: {
    type: 'object',
    required: ['title'],
    properties: {
      type:        { type: 'string', enum: ['custom', 'ai'], default: 'custom' },
      motive:      { type: 'string', maxLength: 300 },
      title:       { type: 'string', minLength: 2, maxLength: 120 },
      description: { type: 'string', maxLength: 2000 },

      // Cover: accept either an already-uploaded storage path or a URL.
      // (Mobile currently uploads images elsewhere; keep flexible.)
      cover_image_path: { type: 'string', maxLength: 500 },
      cover_image_url:  { type: 'string', maxLength: 2000 },

      // Targeting v1 (optional)
      target_gender: { type: 'string', enum: ['male', 'female', 'non_binary', 'prefer_not_to_say'] },
      min_age:       { type: 'integer', minimum: 13, maximum: 99 },
      max_age:       { type: 'integer', minimum: 13, maximum: 99 },

      start_at: { type: 'string', format: 'date-time' },
      end_at:   { type: 'string', format: 'date-time' },

      // Selected products
      product_ids: {
        type: 'array',
        items: { type: 'string', format: 'uuid' },
        maxItems: 200,
      },

      // Draft/active status
      status: { type: 'string', enum: ['draft', 'active', 'paused', 'ended'], default: 'draft' },
    },
    additionalProperties: false,
  },
};

export const updateCampaignSchema = {
  body: {
    type: 'object',
    properties: {
      motive:      { type: 'string', maxLength: 300 },
      title:       { type: 'string', minLength: 2, maxLength: 120 },
      description: { type: 'string', maxLength: 2000 },
      cover_image_path: { type: 'string', maxLength: 500 },
      cover_image_url:  { type: 'string', maxLength: 2000 },

      target_gender: { type: 'string', enum: ['male', 'female', 'non_binary', 'prefer_not_to_say'] },
      min_age:       { type: 'integer', minimum: 13, maximum: 99 },
      max_age:       { type: 'integer', minimum: 13, maximum: 99 },

      start_at: { type: 'string', format: 'date-time' },
      end_at:   { type: 'string', format: 'date-time' },

      status: { type: 'string', enum: ['draft', 'active', 'paused', 'ended'] },

      // Replace product set if provided
      product_ids: {
        type: 'array',
        items: { type: 'string', format: 'uuid' },
        maxItems: 200,
      },
    },
    additionalProperties: false,
  },
};

export const listMyCampaignsSchema = {
  querystring: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['draft', 'active', 'paused', 'ended'] },
      type:   { type: 'string', enum: ['custom', 'ai'] },
    },
    additionalProperties: false,
  },
};

export const trackCampaignEventSchema = {
  body: {
    type: 'object',
    required: ['event_type'],
    properties: {
      event_type: { type: 'string', enum: ['impression','open','swipe','product_click','add_to_cart','checkout','purchase'] },
      product_id: { type: 'string', format: 'uuid' },
      post_id:    { type: 'string', format: 'uuid' },
      session_id: { type: 'string', maxLength: 100 },
      meta:       { type: 'object' },
    },
    additionalProperties: false,
  },
};

