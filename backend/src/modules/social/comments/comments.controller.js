// src/modules/social/comments/comments.controller.js
import { commentsService } from './comments.service.js';

export const commentsController = {

    // GET /posts/:postId/comments
    async listComments(request, reply) {
        const result = await commentsService.listComments(
            request.params.postId,
            request.query,
        );
        return reply.send({ success: true, ...result });
    },

    // POST /posts/:postId/comments
    async createComment(request, reply) {
        const comment = await commentsService.createComment(
            request.user.sub,
            request.params.postId,
            request.body,
        );
        return reply.status(201).send({ success: true, comment });
    },

    // DELETE /posts/:postId/comments/:commentId
    async deleteComment(request, reply) {
        await commentsService.deleteComment(request.user.sub, request.params.commentId);
        return reply.send({ success: true, message: 'Comment deleted.' });
    },
};
