// src/modules/social/comments/comments.routes.js
import { commentsController } from './comments.controller.js';
import { authenticate } from '../../../middleware/authenticate.js';
import { validateUUID } from '../../../middleware/validateUUID.js';
import { createCommentSchema, listCommentsSchema } from './comments.schema.js';

export async function commentsRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);

    fastify.get('/', {
        schema: { ...listCommentsSchema, tags: ['Social'], summary: 'List comments on a post (nested replies)' },
    }, commentsController.listComments);

    fastify.post('/', {
        schema: { ...createCommentSchema, tags: ['Social'], summary: 'Create a comment or reply' },
        config: { rateLimit: { max: 30, timeWindow: '1 hour' } },
    }, commentsController.createComment);

    fastify.delete('/:commentId', {
        schema: { tags: ['Social'], summary: 'Delete own comment' },
        preHandler: [authenticate, validateUUID],
    }, commentsController.deleteComment);
}
