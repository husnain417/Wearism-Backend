// src/modules/social/posts/posts.controller.js
import { postsService } from './posts.service.js';

export const postsController = {

    // POST /posts
    async createPost(request, reply) {
        console.log('BODY KEYS:', Object.keys(request.body || {}));
        console.log('FILE FIELD:', request.body?.file);
        
        const file = request.body?.file;
        const post = await postsService.createPost(request.user.sub, request.body, file);
        return reply.status(201).send({ success: true, post });
    },

    // GET /posts/:id
    async getPost(request, reply) {
        const post = await postsService.getPost(request.params.id, request.user.sub);
        return reply.send({ success: true, post });
    },

    // DELETE /posts/:id
    async deletePost(request, reply) {
        await postsService.deletePost(request.user.sub, request.params.id);
        return reply.send({ success: true, message: 'Post deleted.' });
    },

    // GET /posts/user/:userId
    async listUserPosts(request, reply) {
        const result = await postsService.listUserPosts(
            request.params.userId,
            request.user.sub,
            request.query,
        );
        return reply.send(result);
    },

    // POST /posts/:id/like
    async toggleLike(request, reply) {
        const result = await postsService.toggleLike(request.user.sub, request.params.id);
        return reply.send({ success: true, ...result });
    },

    // POST /posts/:id/report
    async reportPost(request, reply) {
        const result = await postsService.reportPost(
            request.user.sub,
            request.params.id,
            request.body,
        );
        return reply.send({ success: true, ...result });
    },
};
