// src/modules/social/posts/posts.schema.js

export const createPostSchema = {
    body: {
        type: 'object',
        anyOf: [{ required: ['caption'] }, { required: ['image_path'] }, { required: ['outfit_id'] }],
        properties: {
            caption: { type: 'string', maxLength: 500 },
            image_path: { type: 'string' },
            outfit_id: { type: 'string', format: 'uuid' },
            occasion: { type: 'string' },
            season: { type: 'string', enum: ['spring', 'summer', 'fall', 'winter', 'all_season'] },
            weather: { type: 'string', enum: ['hot', 'warm', 'mild', 'cool', 'cold'] },
            tags: { type: 'array', items: { type: 'string', maxLength: 30 }, maxItems: 10 },
            visibility: { type: 'string', enum: ['public', 'followers_only', 'private'], default: 'public' },
        },
        additionalProperties: false,
    },
};

export const listPostsSchema = {
    querystring: {
        type: 'object',
        properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
        },
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
