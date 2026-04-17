import { storiesController } from './stories.controller.js';
import { authenticate } from '../../../middleware/authenticate.js';
import { validateUUID } from '../../../middleware/validateUUID.js';
import { createStorySchema } from './stories.schema.js';

export async function storiesRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);

    fastify.get('/feed', {
        schema: { tags: ['Social'], summary: 'Stories from you and people you follow (last 24h)' },
    }, storiesController.listFeed);

    fastify.get('/status', {
        schema: { tags: ['Social'], summary: 'Whether the current user can post a story today' },
    }, storiesController.getStatus);

    fastify.post('/', {
        schema: { ...createStorySchema, tags: ['Social'], summary: 'Upload a story (max one per UTC day)' },
        config: { rateLimit: { max: 30, timeWindow: '1 hour' } },
    }, storiesController.createStory);

    fastify.get('/:id', {
        schema: { tags: ['Social'], summary: 'Get one story if visible to viewer' },
        preHandler: [validateUUID],
    }, storiesController.getStory);

    fastify.delete('/:id', {
        schema: { tags: ['Social'], summary: 'Soft-delete own story' },
        preHandler: [validateUUID],
    }, storiesController.deleteStory);
}
