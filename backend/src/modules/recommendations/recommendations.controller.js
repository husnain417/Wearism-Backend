// src/modules/recommendations/recommendations.controller.js
import { recommendationsService } from './recommendations.service.js';

export const recommendationsController = {

    // POST /recommendations/generate
    async generate(request, reply) {
        const result = await recommendationsService.generateRecommendations(
            request.user.sub,
            request.body || {}
        );
        return reply.status(202).send({ success: true, ...result });
    },

    // GET /recommendations
    async list(request, reply) {
        const result = await recommendationsService.listRecommendations(
            request.user.sub,
            request.query
        );
        return reply.send({ success: true, ...result });
    },

    // GET /recommendations/:id
    async getOne(request, reply) {
        const rec = await recommendationsService.getRecommendation(
            request.user.sub,
            request.params.id
        );
        return reply.send({ success: true, recommendation: rec });
    },

    // POST /recommendations/:id/save
    async save(request, reply) {
        const result = await recommendationsService.saveRecommendation(
            request.user.sub,
            request.params.id
        );
        return reply.status(201).send({
            success: true,
            message: 'Recommendation saved as outfit.',
            ...result,
        });
    },

    // DELETE /recommendations/:id/save
    async unsave(request, reply) {
        await recommendationsService.unsaveRecommendation(
            request.user.sub,
            request.params.id
        );
        return reply.send({ success: true, message: 'Recommendation unsaved.' });
    },

    // POST /recommendations/:id/dismiss
    async dismiss(request, reply) {
        await recommendationsService.dismissRecommendation(
            request.user.sub,
            request.params.id
        );
        return reply.send({ success: true, message: 'Recommendation dismissed.' });
    },
};
