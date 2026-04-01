// src/modules/social/follows/follows.controller.js
import { followsService } from './follows.service.js';

export const followsController = {

    // POST /follows/:userId
    async follow(request, reply) {
        const result = await followsService.follow(request.user.sub, request.params.userId);
        return reply.send({ success: true, ...result });
    },

    // DELETE /follows/:userId
    async unfollow(request, reply) {
        const result = await followsService.unfollow(request.user.sub, request.params.userId);
        return reply.send({ success: true, ...result });
    },

    // GET /follows/:userId/followers
    async listFollowers(request, reply) {
        const result = await followsService.listFollowers(request.params.userId, request.query);
        return reply.send(result);
    },

    // GET /follows/:userId/following
    async listFollowing(request, reply) {
        const result = await followsService.listFollowing(request.params.userId, request.query);
        return reply.send(result);
    },

    // GET /follows/:userId/relationship
    async getRelationship(request, reply) {
        const result = await followsService.getRelationship(request.user.sub, request.params.userId);
        return reply.send({ success: true, ...result });
    },
};
