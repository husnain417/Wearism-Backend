import { userController } from './user.controller.js';
import { updateProfileSchema, getProfileSchema } from './user.schema.js';
import { authenticate } from '../../middleware/authenticate.js';

export async function userRoutes(fastify) {
    // Apply authenticate to ALL routes in this module at once
    fastify.addHook('preHandler', authenticate);

    // GET /user/profile
    fastify.get('/profile', { schema: getProfileSchema }, userController.getProfile);

    // PATCH /user/profile — partial update, all fields optional
    fastify.patch('/profile', { schema: updateProfileSchema }, userController.updateProfile);

    // POST /user/profile/avatar — multipart image upload
    fastify.post('/profile/avatar', userController.uploadAvatar);
}
