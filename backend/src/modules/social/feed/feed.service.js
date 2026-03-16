// src/modules/social/feed/feed.service.js
import { getUserFeed } from '../../../services/feedCache.js';
import { getTrendingPosts } from '../../../services/trendingScore.js';

export const feedService = {

    async getHomeFeed(userId, { page, limit }) {
        return getUserFeed(userId, { page, limit });
    },

    async getTrendingFeed({ page, limit }) {
        const offset = (page - 1) * limit;
        const posts = await getTrendingPosts(limit, offset);
        return { posts, pagination: { page, limit } };
    },
};
