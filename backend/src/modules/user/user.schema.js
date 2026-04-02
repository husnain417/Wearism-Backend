import { successResponse } from '../../utils/validate.js';

export const updateProfileSchema = {
    body: {
        type: 'object',
        // No 'required' array — all fields optional (GDPR data minimisation)
        properties: {
            full_name: { type: 'string', minLength: 1, maxLength: 100 },
            gender: {
                type: 'string',
                enum: ['male', 'female', 'non_binary', 'prefer_not_to_say'],
            },
            // Age range — NOT date of birth (data minimisation)
            age_range: {
                type: 'string',
                enum: ['13-17', '18-24', '25-34', '35-44', '45-54', '55+'],
            },
            height_cm: { type: 'integer', minimum: 100, maximum: 250 },
            weight_kg: { type: 'number', minimum: 30, maximum: 300 },
            body_type: {
                type: 'string',
                enum: ['slim', 'athletic', 'average', 'curvy', 'plus_size'],
            },
            skin_tone: {
                type: 'string',
                enum: ['fair', 'light', 'medium', 'olive', 'brown', 'dark'],
            },
        },
        additionalProperties: false,
    },
};

export const getProfileSchema = {
    response: {
        200: successResponse({
            profile: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    email: { type: 'string', format: 'email' },
                    full_name: { type: 'string', nullable: true },
                    avatar_url: { type: 'string', nullable: true },
                    gender: { type: 'string', nullable: true },
                    age_range: { type: 'string', nullable: true },
                    height_cm: { type: 'integer', nullable: true },
                    weight_kg: { type: 'number', nullable: true },
                    body_type: { type: 'string', nullable: true },
                    skin_tone: { type: 'string', nullable: true },
                    recent_posts: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                id: { type: 'string', format: 'uuid' },
                                image_url: { type: 'string', nullable: true },
                                created_at: { type: 'string', format: 'date-time' },
                            },
                            additionalProperties: true,
                        },
                    },
                    created_at: { type: 'string', format: 'date-time' },
                    followers_count: { type: 'integer' },
                    following_count: { type: 'integer' },
                    posts_count: { type: 'integer' },
                },
            },
            completion_score: { type: 'integer' },
        }),
    },
};
