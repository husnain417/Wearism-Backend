import { wardrobeController } from './wardrobe.controller.js';
import { createItemSchema, updateItemSchema, listItemsSchema } from './wardrobe.schema.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validateUUID } from '../../middleware/validateUUID.js';

export async function wardrobeRoutes(fastify) {
    // All wardrobe routes are protected
    fastify.addHook('preHandler', authenticate);

    // CRUD for items
    fastify.post('/items', {
        schema: createItemSchema,
        config: {
            rateLimit: {
                max: 30,              // 30 items per 10 minutes
                timeWindow: '10 minutes',
            },
        },
    }, wardrobeController.createItem);

    fastify.get('/items', { schema: listItemsSchema }, wardrobeController.listItems);

    fastify.get('/items/:id', {
        preHandler: [authenticate, validateUUID],
    }, wardrobeController.getItem);

    fastify.patch('/items/:id', {
        schema: updateItemSchema,
        preHandler: [authenticate, validateUUID],
    }, wardrobeController.updateItem);

    fastify.delete('/items/:id', {
        preHandler: [authenticate, validateUUID],
    }, wardrobeController.deleteItem);

    // Extra actions
    fastify.post('/items/:id/worn', {
        preHandler: [authenticate, validateUUID],
    }, wardrobeController.markWorn);

    fastify.get('/items/:id/ai-status', {
        preHandler: [authenticate, validateUUID],
    }, wardrobeController.getAiStatus);
}
