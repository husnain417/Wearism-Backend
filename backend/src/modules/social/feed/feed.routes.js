// src/modules/social/feed/feed.routes.js
import { feedController } from './feed.controller.js';
import { authenticate } from '../../../middleware/authenticate.js';

const paginationSchema = {
    querystring: {
        type: 'object',
        properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
        },
    },
};

export async function feedRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);

    // Personalised home feed (from followed users, Redis-cached)
    fastify.get('/home', { schema: paginationSchema }, feedController.getHomeFeed);

    // Trending feed (score-ranked, Redis-cached)
    fastify.get('/trending', { schema: paginationSchema }, feedController.getTrendingFeed);
}
