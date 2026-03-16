// src/modules/social/comments/comments.schema.js

export const createCommentSchema = {
    body: {
        type: 'object',
        required: ['body'],
        properties: {
            body: { type: 'string', minLength: 1, maxLength: 500 },
            parent_id: { type: 'string', format: 'uuid' },
        },
        additionalProperties: false,
    },
};

export const listCommentsSchema = {
    querystring: {
        type: 'object',
        properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
        },
    },
};
