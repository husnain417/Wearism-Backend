import Fastify from 'fastify';
import fastifyEnv from '@fastify/env';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';

import { envSchema } from './config/env.js';
import { authRoutes } from './modules/auth/auth.routes.js';

export async function buildApp() {
    const app = Fastify({
        logger: {
            level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
            transport:
                process.env.NODE_ENV !== 'production'
                    ? { target: 'pino-pretty', options: { colorize: true } }
                    : undefined,
        },
    });

    // Register env validation first
    await app.register(fastifyEnv, { schema: envSchema, dotenv: true });

    // Security + CORS + Rate Limiting
    await app.register(fastifyHelmet);
    await app.register(fastifyCors, { origin: true });
    await app.register(fastifyRateLimit, {
        max: 100,           // 100 requests per timeWindow
        timeWindow: '1 minute',
    });

    // JWT
    await app.register(fastifyJwt, { secret: process.env.JWT_SECRET });

    // Register feature modules
    await app.register(authRoutes, { prefix: '/auth' });

    // Global error handler
    app.setErrorHandler((error, request, reply) => {
        app.log.error(error);
        reply.status(error.statusCode || 500).send({
            success: false,
            error: error.message || 'Internal Server Error',
        });
    });

    // Health check route
    app.get('/health', async () => ({ status: 'ok' }));

    return app;
}
