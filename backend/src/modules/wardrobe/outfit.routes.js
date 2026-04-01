import { outfitController } from './outfit.controller.js';
import { createOutfitSchema, updateOutfitSchema, listOutfitsSchema } from './outfit.schema.js';
import { authenticate } from '../../middleware/authenticate.js';

export async function outfitRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);

    fastify.post('/', {
        schema: { ...createOutfitSchema, tags: ['Wardrobe'], summary: 'Create an outfit' },
        config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
    }, outfitController.createOutfit);

    fastify.get('/', {
        schema: { ...listOutfitsSchema, tags: ['Wardrobe'], summary: 'List outfits' },
    }, outfitController.listOutfits);

    fastify.get('/:id', {
        schema: { tags: ['Wardrobe'], summary: 'Get a single outfit' },
    }, outfitController.getOutfit);

    fastify.patch('/:id', {
        schema: { ...updateOutfitSchema, tags: ['Wardrobe'], summary: 'Update an outfit' },
    }, outfitController.updateOutfit);

    fastify.delete('/:id', {
        schema: { tags: ['Wardrobe'], summary: 'Delete an outfit' },
    }, outfitController.deleteOutfit);
}
