// src/modules/social/posts/posts.routes.js
import { postsController } from './posts.controller.js';
import { authenticate } from '../../../middleware/authenticate.js';
import { validateUUID } from '../../../middleware/validateUUID.js';
import { createPostSchema, listPostsSchema, reportPostSchema } from './posts.schema.js';

export async function postsRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);

    // Create post
    fastify.post('/', {
        schema: createPostSchema,
        config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
    }, postsController.createPost);

    // Get single post
    fastify.get('/:id', { preHandler: [authenticate, validateUUID] },
        postsController.getPost,
    );

    // Delete own post
    fastify.delete('/:id', { preHandler: [authenticate, validateUUID] },
        postsController.deletePost,
    );

    // List posts by user
    fastify.get('/user/:userId', {
        schema: listPostsSchema,
        preHandler: [authenticate, validateUUID],
    }, postsController.listUserPosts);

    // Toggle like
    fastify.post('/:id/like', {
        preHandler: [authenticate, validateUUID],
        config: { rateLimit: { max: 100, timeWindow: '1 hour' } },
    }, postsController.toggleLike);

    // Report post
    fastify.post('/:id/report', {
        schema: reportPostSchema,
        preHandler: [authenticate, validateUUID],
        config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
    }, postsController.reportPost);
}
