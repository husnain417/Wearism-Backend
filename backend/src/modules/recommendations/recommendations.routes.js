// src/modules/recommendations/recommendations.routes.js
import { recommendationsController } from './recommendations.controller.js';
import { generateRecommendationsSchema, listRecommendationsSchema } from './recommendations.schema.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validateUUID } from '../../middleware/validateUUID.js';

export async function recommendationsRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);

    fastify.post('/generate', {
        schema: { ...generateRecommendationsSchema, tags: ['AI'], summary: 'Generate a fresh batch of outfit recommendations' },
        config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
    }, recommendationsController.generate);

    fastify.get('/', {
        schema: { ...listRecommendationsSchema, tags: ['AI'], summary: 'List current recommendations' },
    }, recommendationsController.list);

    fastify.get('/:id', {
        schema: { tags: ['AI'], summary: 'Get a single recommendation with full item details' },
        preHandler: [authenticate, validateUUID],
    }, recommendationsController.getOne);

    fastify.post('/:id/save', {
        schema: { tags: ['AI'], summary: 'Save a recommendation as an outfit' },
        preHandler: [authenticate, validateUUID],
    }, recommendationsController.save);

    fastify.delete('/:id/save', {
        schema: { tags: ['AI'], summary: 'Unsave a recommendation' },
        preHandler: [authenticate, validateUUID],
    }, recommendationsController.unsave);

    fastify.post('/:id/dismiss', {
        schema: { tags: ['AI'], summary: 'Dismiss a recommendation' },
        preHandler: [authenticate, validateUUID],
    }, recommendationsController.dismiss);
}
