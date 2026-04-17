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

    fastify.get('/home', {
        schema: { ...paginationSchema, tags: ['Feed'], summary: 'Personalised home feed (Redis-cached)' },
        config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    }, feedController.getHomeFeed);

    fastify.get('/trending', {
        schema: { ...paginationSchema, tags: ['Feed'], summary: 'Trending feed (score-ranked, Redis-cached)' },
        config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    }, feedController.getTrendingFeed);

    fastify.get('/explore', {
        schema: { ...paginationSchema, tags: ['Feed'], summary: 'Explore grid for search (DB-scored public posts)' },
        config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    }, feedController.getExploreFeed);
}
