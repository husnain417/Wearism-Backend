import { outfitController } from './outfit.controller.js';
import { createOutfitSchema, updateOutfitSchema, listOutfitsSchema } from './outfit.schema.js';
import { authenticate } from '../../middleware/authenticate.js';

export async function outfitRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);

    fastify.post('/', {
        schema: createOutfitSchema,
        config: {
            rateLimit: {
                max: 20,
                timeWindow: '10 minutes',
            },
        },
    }, outfitController.createOutfit);

    fastify.get('/', { schema: listOutfitsSchema }, outfitController.listOutfits);
    fastify.get('/:id', outfitController.getOutfit);
    fastify.patch('/:id', { schema: updateOutfitSchema }, outfitController.updateOutfit);
    fastify.delete('/:id', outfitController.deleteOutfit);
}
