// src/modules/social/posts/posts.schema.js
import { occasionEnum, seasonEnum, weatherEnum, visibilityEnum, paginationQuery } from '../../../utils/validate.js';

export const createPostSchema = {
    body: {
        type: 'object',
        anyOf: [{ required: ['caption'] }, { required: ['image_path'] }, { required: ['outfit_id'] }],
        properties: {
            post_id: { type: 'string', format: 'uuid' },
            caption: { type: 'string', maxLength: 500 },
            image_path: { type: 'string', maxLength: 500 },
            outfit_id: { type: 'string', format: 'uuid' },
            occasion: occasionEnum,
            season: seasonEnum,
            weather: weatherEnum,
            tags: { type: 'array', items: { type: 'string', maxLength: 30 }, maxItems: 10 },
            visibility: visibilityEnum,
            file: { type: 'object' },
        },
        additionalProperties: false,
    },
};

export const listPostsSchema = {
    querystring: {
        type: 'object',
        properties: { ...paginationQuery },
        additionalProperties: false,
    },
};

export const reportPostSchema = {
    body: {
        type: 'object',
        required: ['reason'],
        properties: {
            reason: { type: 'string', enum: ['nsfw', 'spam', 'harassment', 'misinformation', 'other'] },
            detail: { type: 'string', maxLength: 300 },
        },
        additionalProperties: false,
    },
};
