// src/modules/social/comments/comments.schema.js
import { paginationQuery } from '../../../utils/validate.js';

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
        properties: { ...paginationQuery },
        additionalProperties: false,
    },
};
