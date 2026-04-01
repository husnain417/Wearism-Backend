// src/modules/social/posts/posts.routes.js
import { postsController } from './posts.controller.js';
import { authenticate } from '../../../middleware/authenticate.js';
import { validateUUID } from '../../../middleware/validateUUID.js';
import { createPostSchema, listPostsSchema, reportPostSchema } from './posts.schema.js';

export async function postsRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);

    fastify.post('/', {
        schema: { ...createPostSchema, tags: ['Social'], summary: 'Create a new post' },
        config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
    }, postsController.createPost);

    fastify.get('/:id', {
        schema: { tags: ['Social'], summary: 'Get a single post' },
        preHandler: [authenticate, validateUUID],
    }, postsController.getPost);

    fastify.delete('/:id', {
        schema: { tags: ['Social'], summary: 'Delete own post' },
        preHandler: [authenticate, validateUUID],
    }, postsController.deletePost);

    fastify.get('/user/:userId', {
        schema: { ...listPostsSchema, tags: ['Social'], summary: 'List posts by user' },
        preHandler: [authenticate, validateUUID],
    }, postsController.listUserPosts);

    fastify.post('/:id/like', {
        schema: { tags: ['Social'], summary: 'Toggle like on a post' },
        preHandler: [authenticate, validateUUID],
        config: { rateLimit: { max: 100, timeWindow: '1 hour' } },
    }, postsController.toggleLike);

    fastify.post('/:id/report', {
        schema: { ...reportPostSchema, tags: ['Social'], summary: 'Report a post' },
        preHandler: [authenticate, validateUUID],
        config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
    }, postsController.reportPost);
}
