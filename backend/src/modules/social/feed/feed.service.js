import { getUserFeed } from '../../../services/feedCache.js';
import { getTrendingPosts, TRENDING_POST_LIMIT } from '../../../services/trendingScore.js';
import { parsePagination, paginatedResult } from '../../../utils/pagination.js';

export const feedService = {

    async getHomeFeed(userId, query) {
        const { page, limit } = parsePagination(query);
        const { posts, total } = await getUserFeed(userId, { page, limit });
        return paginatedResult(posts, total, page, limit);
    },

    async getTrendingFeed(query) {
        const { page, limit, from } = parsePagination(query);
        const posts = await getTrendingPosts(limit, from);
        // trending is capped at TRENDING_POST_LIMIT (50)
        return paginatedResult(posts, TRENDING_POST_LIMIT, page, limit);
    },
};
