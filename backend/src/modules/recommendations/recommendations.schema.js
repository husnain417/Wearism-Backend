// src/modules/recommendations/recommendations.schema.js

export const generateRecommendationsSchema = {
    body: {
        type: 'object',
        properties: {
            occasion: {
                type: 'string',
                enum: ['casual', 'business_casual', 'formal', 'athletic',
                    'outdoor', 'beach', 'evening', 'date_night'],
            },
            season: {
                type: 'string',
                enum: ['spring', 'summer', 'autumn', 'winter', 'all_season'],
            },
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
