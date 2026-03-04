// src/modules/recommendations/recommendations.routes.js
import { recommendationsController } from './recommendations.controller.js';
import { generateRecommendationsSchema, listRecommendationsSchema } from './recommendations.schema.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validateUUID } from '../../middleware/validateUUID.js';

export async function recommendationsRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);

    // Generate a fresh batch of recommendations
    fastify.post('/generate',
        {
            schema: generateRecommendationsSchema,
            config: { rateLimit: { max: 5, timeWindow: '1 hour' } }, // expensive operation
        },
        recommendationsController.generate
    );

    // List current recommendations
    fastify.get('/', { schema: listRecommendationsSchema }, recommendationsController.list);

    // Get single recommendation with full item details
    fastify.get('/:id', { preHandler: [authenticate, validateUUID] }, recommendationsController.getOne);

    // Save a recommendation as an outfit
    fastify.post('/:id/save', { preHandler: [authenticate, validateUUID] }, recommendationsController.save);

    // Unsave (remove saved outfit)
    fastify.delete('/:id/save', { preHandler: [authenticate, validateUUID] }, recommendationsController.unsave);

    // Dismiss (hide from list)
    fastify.post('/:id/dismiss', { preHandler: [authenticate, validateUUID] }, recommendationsController.dismiss);
}
