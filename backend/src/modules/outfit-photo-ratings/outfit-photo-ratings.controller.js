import { outfitPhotoRatingsService } from './outfit-photo-ratings.service.js';

export const outfitPhotoRatingsController = {
    async create(request, reply) {
        const rating = await outfitPhotoRatingsService.create(
            request.user.sub,
            request.body,
            request.body?.file
        );

        return reply.status(201).send({
            success: true,
            message: 'Outfit photo rating queued.',
            rating,
            ai_status: 'pending',
        });
    },

    async listRecent(request, reply) {
        const limit = Number(request.query?.limit || 5);
        const data = await outfitPhotoRatingsService.listRecent(request.user.sub, limit);
        return reply.send({ success: true, data });
    },

    async getOne(request, reply) {
        const rating = await outfitPhotoRatingsService.getOne(request.user.sub, request.params.id);
        return reply.send({ success: true, rating });
    },
};
