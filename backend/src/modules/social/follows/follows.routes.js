// src/modules/social/follows/follows.routes.js
import { followsController } from './follows.controller.js';
import { authenticate } from '../../../middleware/authenticate.js';
import { validateUUID } from '../../../middleware/validateUUID.js';

const paginationSchema = {
    querystring: {
        type: 'object',
        properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
        },
    },
};

export async function followsRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);

    fastify.post('/:userId', {
        schema: { tags: ['Social'], summary: 'Follow a user' },
        preHandler: [authenticate, validateUUID],
        config: { rateLimit: { max: 30, timeWindow: '1 hour' } },
    }, followsController.follow);

    fastify.delete('/:userId', {
        schema: { tags: ['Social'], summary: 'Unfollow a user' },
        preHandler: [authenticate, validateUUID],
    }, followsController.unfollow);

    fastify.get('/:userId/followers', {
        schema: { ...paginationSchema, tags: ['Social'], summary: 'List followers of a user' },
        preHandler: [authenticate, validateUUID],
    }, followsController.listFollowers);

    fastify.get('/:userId/following', {
        schema: { ...paginationSchema, tags: ['Social'], summary: 'List accounts a user is following' },
        preHandler: [authenticate, validateUUID],
    }, followsController.listFollowing);

    fastify.get('/:userId/relationship', {
        schema: { tags: ['Social'], summary: 'Get follow relationship between viewer and target' },
        preHandler: [authenticate, validateUUID],
    }, followsController.getRelationship);
}
