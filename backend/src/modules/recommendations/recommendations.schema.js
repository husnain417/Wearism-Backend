// src/modules/recommendations/recommendations.schema.js
import { occasionEnum, seasonEnum, weatherEnum, paginationQuery } from '../../utils/validate.js';

export const generateRecommendationsSchema = {
    body: {
        type: 'object',
        properties: {
            occasion: occasionEnum,
            season: seasonEnum,
            weather: weatherEnum,
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
            occasion: occasionEnum,
            status: { type: 'string', enum: ['all', 'scored', 'pending'], default: 'scored' },
            ...paginationQuery,
        },
        additionalProperties: false,
    },
};
