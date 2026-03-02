import { authController } from './auth.controller.js';
import {
    signupSchema,
    loginSchema,
    refreshSchema,
    forgotPasswordSchema,
} from './auth.schema.js';
import { authenticate } from '../../middleware/authenticate.js';

export async function authRoutes(fastify) {
    // Public routes — no auth required
    fastify.post(
        '/signup',
        {
            schema: signupSchema,
            config: {
                rateLimit: {
                    max: 3, // 3 signups per IP per 15 min
                    timeWindow: '15 minutes',
                },
            },
        },
        authController.signup
    );

    fastify.post(
        '/login',
        {
            schema: loginSchema,
            config: {
                rateLimit: {
                    max: 5, // only 5 login attempts
                    timeWindow: '15 minutes',
                },
            },
        },
        authController.login
    );

    fastify.get('/google', authController.googleOAuth);

    fastify.post('/refresh', { schema: refreshSchema }, authController.refresh);

    fastify.post(
        '/forgot-password',
        {
            schema: forgotPasswordSchema,
            config: {
                rateLimit: {
                    max: 3,
                    timeWindow: '1 hour',
                },
            },
        },
        authController.forgotPassword
    );

    // Protected routes — require valid JWT
    fastify.post('/logout', { preHandler: authenticate }, authController.logout);
    fastify.delete('/account', { preHandler: authenticate }, authController.deleteAccount);
    fastify.get('/me/data', { preHandler: authenticate }, authController.getMyData);
}
