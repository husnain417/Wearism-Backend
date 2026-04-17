import { userController } from './user.controller.js';
import { authenticate } from '../../middleware/authenticate.js';

export async function usersRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);

    fastify.get('/search', {
        schema: {
            tags: ['Profile'],
            summary: 'Search directory: users and approved vendors by name',
            querystring: {
                type: 'object',
                properties: {
                    q: { type: 'string', minLength: 1, maxLength: 64 },
                    limit: { type: 'integer', minimum: 1, maximum: 50, default: 25 },
                },
                required: ['q'],
            },
        },
        config: { rateLimit: { max: 90, timeWindow: '1 minute' } },
    }, userController.searchDirectory);

    fastify.get('/:id/profile', {
        config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    }, userController.getPublicProfile);
}
