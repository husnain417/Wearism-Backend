// src/utils/validate.js
// Reusable schema fragments — spread into route schemas

export const paginationQuery = {
    page:  { type: 'integer', minimum: 1, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
};

export const uuidParam = {
    id: { type: 'string', format: 'uuid' },
};

export const uuidParams = (keys) =>
    Object.fromEntries(keys.map(k => [k, { type: 'string', format: 'uuid' }]));

export const seasonEnum = {
    type: 'string',
    enum: ['spring','summer','fall','winter','all_season'],
};

export const occasionEnum = {
    type: 'string',
    enum: ['casual','formal','business','smart_casual','streetwear',
           'athleisure','old_money','party','black_tie','wedding'],
};

export const weatherEnum = {
    type: 'string',
    enum: ['hot','warm','mild','cool','cold'],
};

export const visibilityEnum = {
    type: 'string',
    enum: ['public','followers_only','private'],
};

// Standard success response wrapper
export const successResponse = (dataSchema) => ({
    type: 'object',
    properties: {
        success: { type: 'boolean' },
        ...dataSchema,
    },
});

// Standard paginated response wrapper
export const paginatedResponse = (itemSchema) => ({
    type: 'object',
    properties: {
        success: { type: 'boolean' },
        data: { type: 'array', items: itemSchema },
        pagination: {
            type: 'object',
            properties: {
                total:       { type: 'integer' },
                page:        { type: 'integer' },
                limit:       { type: 'integer' },
                total_pages: { type: 'integer' },
                has_next:    { type: 'boolean' },
                has_prev:    { type: 'boolean' },
            },
        },
    },
});
