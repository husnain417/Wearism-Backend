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

    // Follow a user
    fastify.post('/:userId', { preHandler: [authenticate, validateUUID] },
        followsController.follow,
    );

    // Unfollow a user
    fastify.delete('/:userId', { preHandler: [authenticate, validateUUID] },
        followsController.unfollow,
    );

    // List followers of a user
    fastify.get('/:userId/followers', {
        schema: paginationSchema,
        preHandler: [authenticate, validateUUID],
    }, followsController.listFollowers);

    // List accounts a user is following
    fastify.get('/:userId/following', {
        schema: paginationSchema,
        preHandler: [authenticate, validateUUID],
    }, followsController.listFollowing);

    // Viewer ↔ target relationship
    fastify.get('/:userId/relationship', { preHandler: [authenticate, validateUUID] },
        followsController.getRelationship,
    );
}
