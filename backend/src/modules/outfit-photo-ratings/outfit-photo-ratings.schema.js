import { paginationQuery } from '../../utils/validate.js';

export const photoRatingGenderEnum = {
    type: 'string',
    enum: ['male', 'female', 'non_binary', 'unspecified'],
};

export const photoRatingOccasionEnum = {
    type: 'string',
    enum: ['casual', 'smart_casual', 'business_casual', 'business_formal', 'black_tie', 'athletic', 'party', 'old_money', 'streetwear', 'outdoor'],
};

export const photoRatingWeatherEnum = {
    type: 'string',
    enum: ['hot', 'warm', 'mild', 'cool', 'cold'],
};

export const photoRatingSeasonEnum = {
    type: 'string',
    enum: ['spring', 'summer', 'autumn', 'winter'],
};

export const photoRatingStylePreferenceEnum = {
    type: 'string',
    enum: ['any', 'minimal', 'classic', 'streetwear', 'boho', 'edgy', 'preppy', 'old_money', 'sporty', 'feminine', 'masculine', 'business'],
};

export const photoRatingModeEnum = {
    type: 'string',
    enum: ['heavyweight', 'lightweight'],
};

export const createOutfitPhotoRatingSchema = {
    body: {
        type: 'object',
        properties: {
            gender: photoRatingGenderEnum,
            occasion: photoRatingOccasionEnum,
            weather: photoRatingWeatherEnum,
            season: photoRatingSeasonEnum,
            style_preference: photoRatingStylePreferenceEnum,
            mode: photoRatingModeEnum,
            file: { type: 'object' },
        },
        additionalProperties: false,
    },
};

export const listRecentOutfitPhotoRatingsSchema = {
    querystring: {
        type: 'object',
        properties: {
            limit: paginationQuery.limit,
        },
        additionalProperties: false,
    },
};
