import { outfitPhotoRatingsController } from './outfit-photo-ratings.controller.js';
import { createOutfitPhotoRatingSchema, listRecentOutfitPhotoRatingsSchema } from './outfit-photo-ratings.schema.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validateUUID } from '../../middleware/validateUUID.js';

export async function outfitPhotoRatingsRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);

    fastify.post('/', {
        schema: { ...createOutfitPhotoRatingSchema, tags: ['AI'], summary: 'Upload and rate an outfit photo' },
        config: { rateLimit: { max: 30, timeWindow: '1 hour' } },
    }, outfitPhotoRatingsController.create);

    fastify.get('/recent', {
        schema: { ...listRecentOutfitPhotoRatingsSchema, tags: ['AI'], summary: 'Get recent outfit photo ratings' },
    }, outfitPhotoRatingsController.listRecent);

    fastify.get('/:id', {
        schema: { tags: ['AI'], summary: 'Get a single outfit photo rating' },
        preHandler: [authenticate, validateUUID],
    }, outfitPhotoRatingsController.getOne);
}
