// src/modules/recommendations/recommendations.schema.js

export const generateRecommendationsSchema = {
    body: {
        type: 'object',
        properties: {
            occasion: {
                type: 'string',
                enum: ['casual', 'formal', 'business', 'smart_casual',
                    'streetwear', 'athleisure', 'old_money', 'party', 'black_tie', 'wedding'],
            },
            season: {
                type: 'string',
                enum: ['spring', 'summer', 'fall', 'winter', 'all_season'],
            },
            weather: { type: 'string', enum: ['hot', 'warm', 'mild', 'cool', 'cold'] },
            num_outfits: { type: 'integer', minimum: 1, maximum: 10, default: 3 },
            sample_size: { type: 'integer', minimum: 5, maximum: 50, default: 25 },
            force_refresh: { type: 'boolean', default: false },
        },
        additionalProperties: false,
    },
};

export const listRecommendationsSchema = {
    querystring: {
        type: 'object',
        properties: {
            occasion: { type: 'string' },
            status: { type: 'string', enum: ['all', 'scored', 'pending'], default: 'scored' },
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 20, default: 10 },
        },
        additionalProperties: false,
    },
};
