export const createOutfitSchema = {
    body: {
        type: 'object',
        required: ['item_ids'],
        properties: {
            name: { type: 'string', maxLength: 100 },
            occasion: {
                type: 'string', enum: [
                    'casual', 'business_casual', 'formal', 'athletic',
                    'outdoor', 'beach', 'evening', 'date_night',
                ]
            },
            status: { type: 'string', enum: ['draft', 'saved', 'published'] },
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
            occasion: {
                type: 'string', enum: [
                    'casual', 'business_casual', 'formal', 'athletic',
                    'outdoor', 'beach', 'evening', 'date_night',
                ]
            },
            status: { type: 'string', enum: ['draft', 'saved', 'published'] },
            item_ids: { type: 'array', items: { type: 'string', format: 'uuid' }, minItems: 1, maxItems: 20 },
        },
        additionalProperties: false,
    },
};

export const listOutfitsSchema = {
    querystring: {
        type: 'object',
        properties: {
            occasion: { type: 'string' },
            status: { type: 'string' },
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
        },
        additionalProperties: false,
    },
};
