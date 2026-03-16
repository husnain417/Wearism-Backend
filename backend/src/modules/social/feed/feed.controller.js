// src/modules/social/feed/feed.controller.js
import { feedService } from './feed.service.js';

export const feedController = {

    // GET /feed/home
    async getHomeFeed(request, reply) {
        const result = await feedService.getHomeFeed(request.user.sub, request.query);
        return reply.send({ success: true, ...result });
    },

    // GET /feed/trending
    async getTrendingFeed(request, reply) {
        const result = await feedService.getTrendingFeed(request.query);
        return reply.send({ success: true, ...result });
    },
};
