import { getUserFeed, enrichPostsForViewer } from '../../../services/feedCache.js';
import { getTrendingPosts, getExploreGridPosts, TRENDING_POST_LIMIT } from '../../../services/trendingScore.js';
import { parsePagination, paginatedResult } from '../../../utils/pagination.js';

export const feedService = {

    async getHomeFeed(userId, query) {
        const { page, limit } = parsePagination(query);
        const { posts, total } = await getUserFeed(userId, { page, limit });
        return paginatedResult(posts, total, page, limit);
    },

    async getTrendingFeed(userId, query) {
        const { page, limit, from } = parsePagination(query);
        const pool = await getTrendingPosts(TRENDING_POST_LIMIT, 0);
        const ranked = pool.filter((p) => p?.user_id && p.user_id !== userId);
        const pageSlice = ranked.slice(from, from + limit);
        const enriched = await enrichPostsForViewer(userId, pageSlice);
        return paginatedResult(enriched, ranked.length, page, limit);
    },

    /** Search tab masonry — separate from Redis trending cache. */
    async getExploreFeed(userId, query) {
        const { page, limit, from } = parsePagination(query);
        const posts = await getExploreGridPosts(limit, from);
        const enriched = await enrichPostsForViewer(userId, posts);
        return paginatedResult(enriched, TRENDING_POST_LIMIT, page, limit);
    },
};
