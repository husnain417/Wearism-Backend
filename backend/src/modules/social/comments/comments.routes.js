// src/modules/social/comments/comments.routes.js
import { commentsController } from './comments.controller.js';
import { authenticate } from '../../../middleware/authenticate.js';
import { validateUUID } from '../../../middleware/validateUUID.js';
import { createCommentSchema, listCommentsSchema } from './comments.schema.js';

export async function commentsRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);

    // List comments on a post (with nested replies)
    fastify.get('/', { schema: listCommentsSchema }, commentsController.listComments);

    // Create comment / reply
    fastify.post('/', {
        schema: createCommentSchema,
        config: { rateLimit: { max: 60, timeWindow: '1 hour' } },
    }, commentsController.createComment);

    // Delete own comment
    fastify.delete('/:commentId', { preHandler: [authenticate, validateUUID] },
        commentsController.deleteComment,
    );
}
