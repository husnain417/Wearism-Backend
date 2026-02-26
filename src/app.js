import Fastify from 'fastify';
import fastifyEnv from '@fastify/env';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyJwt from '@fastify/jwt';

import { envSchema } from './config/env.js';

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

    // Security + CORS
    await app.register(fastifyHelmet);
    await app.register(fastifyCors, { origin: true });

    // JWT
    await app.register(fastifyJwt, { secret: process.env.JWT_SECRET });

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
