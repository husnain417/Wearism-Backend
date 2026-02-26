import Fastify from 'fastify';
import fastifyEnv from '@fastify/env';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';

import { envSchema } from './config/env.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { userRoutes } from './modules/user/user.routes.js';
import fastifyMultipart from '@fastify/multipart';

export async function buildApp() {
    const app = Fastify({
        logger: {
            level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
            transport:
                process.env.NODE_ENV !== 'production'
                    ? { target: 'pino-pretty', options: { colorize: true } }
                    : undefined,
            // Redact sensitive personal data from ALL log output
            redact: [
                'req.body.password',
                'req.body.weight_kg',
                'req.body.height_cm',
                'req.body.skin_tone',
                'req.body.body_type',
                'req.headers.authorization',
            ],
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

    // Multipart uploads (for avatars)
    await app.register(fastifyMultipart, {
        limits: {
            fileSize: 5 * 1024 * 1024, // 5MB hard limit
            files: 1, // one file per request
        },
    });

    // Register feature modules
    await app.register(authRoutes, { prefix: '/auth' });
    await app.register(userRoutes, { prefix: '/user' });

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
