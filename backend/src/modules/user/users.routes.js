import { userController } from './user.controller.js';
import { authenticate } from '../../middleware/authenticate.js';

export async function usersRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);

    fastify.get('/:id/profile', {
        config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    }, userController.getPublicProfile);
}
