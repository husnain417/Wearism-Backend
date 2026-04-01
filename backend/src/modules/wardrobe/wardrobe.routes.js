import { wardrobeController } from './wardrobe.controller.js';
import { createItemSchema, updateItemSchema, listItemsSchema } from './wardrobe.schema.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validateUUID } from '../../middleware/validateUUID.js';

export async function wardrobeRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);

    fastify.post('/items', {
        schema: { ...createItemSchema, tags: ['Wardrobe'], summary: 'Create a wardrobe item after image upload' },
        config: { rateLimit: { max: 30, timeWindow: '1 hour' } },
    }, wardrobeController.createItem);

    fastify.get('/items', {
        schema: { ...listItemsSchema, tags: ['Wardrobe'], summary: 'List wardrobe items with filters' },
    }, wardrobeController.listItems);

    fastify.get('/items/:id', {
        schema: { tags: ['Wardrobe'], summary: 'Get a single wardrobe item' },
        preHandler: [authenticate, validateUUID],
    }, wardrobeController.getItem);

    fastify.patch('/items/:id', {
        schema: { ...updateItemSchema, tags: ['Wardrobe'], summary: 'Update a wardrobe item' },
        preHandler: [authenticate, validateUUID],
    }, wardrobeController.updateItem);

    fastify.delete('/items/:id', {
        schema: { tags: ['Wardrobe'], summary: 'Delete a wardrobe item' },
        preHandler: [authenticate, validateUUID],
    }, wardrobeController.deleteItem);

    fastify.post('/items/:id/worn', {
        schema: { tags: ['Wardrobe'], summary: 'Mark item as worn today' },
        preHandler: [authenticate, validateUUID],
    }, wardrobeController.markWorn);

    fastify.get('/items/:id/ai-status', {
        schema: { tags: ['AI'], summary: 'Get AI classification status for item' },
        preHandler: [authenticate, validateUUID],
    }, wardrobeController.getAiStatus);
}
