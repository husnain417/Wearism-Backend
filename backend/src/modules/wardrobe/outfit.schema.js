import { occasionEnum, weatherEnum, paginationQuery } from '../../utils/validate.js';

export const createOutfitSchema = {
    body: {
        type: 'object',
        required: ['item_ids'],
        properties: {
            name: { type: 'string', maxLength: 100 },
            occasion: occasionEnum,
            status: { type: 'string', enum: ['draft', 'saved', 'published'] },
            weather: weatherEnum,
            item_ids: { type: 'array', items: { type: 'string', format: 'uuid' }, minItems: 1, maxItems: 20 },
        },
        additionalProperties: false,
    },
};

export const updateOutfitSchema = {
    body: {
        type: 'object',
        properties: {
            name: { type: 'string', maxLength: 100 },
            occasion: occasionEnum,
            status: { type: 'string', enum: ['draft', 'saved', 'published'] },
            weather: weatherEnum,
            item_ids: { type: 'array', items: { type: 'string', format: 'uuid' }, minItems: 1, maxItems: 20 },
        },
        additionalProperties: false,
    },
};

export const listOutfitsSchema = {
    querystring: {
        type: 'object',
        properties: {
            occasion: occasionEnum,
            status: { type: 'string', enum: ['draft', 'saved', 'published'] },
            ...paginationQuery,
        },
        additionalProperties: false,
    },
};
