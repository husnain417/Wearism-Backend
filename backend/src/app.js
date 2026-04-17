import Fastify from 'fastify';
import fastifyEnv from '@fastify/env';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyCompress from '@fastify/compress';
import fastifySwagger from '@fastify/swagger';
import fastifyApiReference from '@scalar/fastify-api-reference';
import addFormats from 'ajv-formats';
import zlib from 'node:zlib';

import { envSchema } from './config/env.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { userRoutes } from './modules/user/user.routes.js';
import { usersRoutes } from './modules/user/users.routes.js';
import { wardrobeRoutes } from './modules/wardrobe/wardrobe.routes.js';
import { outfitRoutes } from './modules/wardrobe/outfit.routes.js';
import { recommendationsRoutes } from './modules/recommendations/recommendations.routes.js';
import { postsRoutes } from './modules/social/posts/posts.routes.js';
import { commentsRoutes } from './modules/social/comments/comments.routes.js';
import { followsRoutes } from './modules/social/follows/follows.routes.js';
import { feedRoutes } from './modules/social/feed/feed.routes.js';
import { vendorsRoutes }  from './modules/marketplace/vendors/vendors.routes.js';
import { productsRoutes } from './modules/marketplace/products/products.routes.js';
import { cartRoutes }     from './modules/marketplace/cart/cart.routes.js';
import { ordersRoutes }   from './modules/marketplace/orders/orders.routes.js';
import { campaignsRoutes } from './modules/marketplace/campaigns/campaigns.routes.js';
import { notificationsRoutes } from './modules/notifications/notifications.routes.js';
import { outfitPhotoRatingsRoutes } from './modules/outfit-photo-ratings/outfit-photo-ratings.routes.js';
import { refreshTrendingCache } from './services/trendingScore.js';
import { getRedisClient } from './config/redis.js';
import { startWardrobeMaterializationWorker } from './workers/wardrobeMaterializationWorker.js';
import { startOutfitPhotoRatingsWorker } from './workers/outfitPhotoRatingsWorker.js';
import fastifyMultipart from '@fastify/multipart';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

export async function buildApp() {
    const app = Fastify({
        logger: {
            level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
            transport:
                process.env.NODE_ENV !== 'production'
                    ? { target: 'pino-pretty', options: { colorize: true } }
                    : undefined,
            redact: [
                'req.body.password',
                'req.body.weight_kg',
                'req.body.height_cm',
                'req.body.skin_tone',
                'req.body.body_type',
                'req.headers.authorization',
            ],
        },
        ajv: {
            customOptions: {
                removeAdditional: 'all',  // Strip unknown fields from ALL request bodies
                useDefaults: true,        // Apply default values from schema
                coerceTypes: true,        // Coerce query string integers automatically
                allErrors: true,          // Return ALL validation errors, not just first
            },
            plugins: [addFormats],        // Enables: email, uuid, date, date-time, uri
        },
    });

    // Register env validation first using absolute path
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    await app.register(fastifyEnv, {
        schema: envSchema,
        dotenv: {
            path: resolve(__dirname, '../.env'),
        },
    });

    // Security + CORS + Rate Limiting
    await app.register(fastifyHelmet);
    await app.register(fastifyCors, { origin: true });
    
    // Response Compression — Register BEFORE routes
    await app.register(fastifyCompress, {
        encodings: ['br', 'gzip', 'deflate'],
        threshold: 1024,
        brotliOptions: { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 6 } },
        zlibOptions: { level: 6 },
        customTypes: /^application\/json/,
    });

    // API Documentation (Swagger + Scalar) — Register BEFORE routes so schemas are captured
    await app.register(fastifySwagger, {
        openapi: {
            info: {
                title:       'Wearism API',
                description: 'Backend API for the Wearism fashion platform',
                version:     '1.0.0',
            },
            servers: [
                { url: 'http://localhost:3000', description: 'Development' },
            ],
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type:         'http',
                        scheme:       'bearer',
                        bearerFormat: 'JWT',
                        description:  'Supabase JWT token from /auth/login',
                    },
                },
            },
            security: [{ bearerAuth: [] }],
            tags: [
                { name: 'System',        description: 'Health and status checks' },
                { name: 'Auth',          description: 'Authentication and account management' },
                { name: 'Profile',       description: 'User profile management' },
                { name: 'Wardrobe',      description: 'Wardrobe items and outfits' },
                { name: 'AI',            description: 'AI classification and recommendations' },
                { name: 'Social',        description: 'Posts, comments, likes, follows' },
                { name: 'Feed',          description: 'Home feed and trending' },
                { name: 'Marketplace',   description: 'Vendors, products, cart, orders' },
                { name: 'Notifications', description: 'Push notification token management' },
            ],
        },
    });

    await app.register(fastifyApiReference, {
        routePrefix: '/docs',
        configuration: {
            title: 'Wearism API Reference',
            theme: 'purple',
            spec: { content: () => app.swagger() },
        },
        // Disable in production — docs should be internal only
        ...(process.env.NODE_ENV === 'production' ? { enabled: false } : {}),
    });
    
    // Global Rate Limiting — Use Redis to survive restarts and scale, except in tests
    if (process.env.NODE_ENV !== 'test') {
        await app.register(fastifyRateLimit, {
            redis: getRedisClient(),
            nameSpace: 'rl:',
            
            // Global defaults — every endpoint gets these unless overridden
            max: 100,
            timeWindow: '1 minute',
            
            // Key by user ID if authenticated, else by IP
            keyGenerator: (request) => {
                return request.user?.sub || request.ip;
            },
            
            // Must return an Error with statusCode — plain objects become unhandled 500s
            errorResponseBuilder: (request, context) => {
                const err = new Error('Too many requests');
                err.statusCode = context.statusCode ?? 429;
                err.rateLimitPayload = {
                    success: false,
                    error: 'Too many requests',
                    retryAfter: context.after,
                    limit: context.max,
                    remaining: 0,
                };
                return err;
            },
            
            // Add rate limit headers to every response
            addHeaders: {
                'x-ratelimit-limit':     true,
                'x-ratelimit-remaining': true,
                'x-ratelimit-reset':     true,
                'retry-after':           true,
            },
            
            // Skip rate limiting for health check
            skip: (request) => request.url === '/health',
        });
    } else {
        // Fastify requires rate limit plugin to be registered if routes use it
        await app.register(fastifyRateLimit, {
            max: 1000,
            timeWindow: '1 minute',
        });
    }

    // JWT
    await app.register(fastifyJwt, { secret: process.env.JWT_SECRET });

    // Multipart uploads (for avatars, posts, and batch wardrobe uploads)
    await app.register(fastifyMultipart, {
        attachFieldsToBody: 'keyValues', // Standardize: provides plain strings to AJV
        limits: {
            fileSize: 5 * 1024 * 1024, // 5MB per file
            files: 20,                  // up to 20 files per request (batch wardrobe upload)
        },
    });

    // Health check — exempt from rate limiting, always first route
    app.get('/health', {
        schema: {
            tags: ['System'],
            summary: 'Health check',
            description: 'Returns server status, timestamp, and version.',
            security: [],
            response: { 200: {
                type: 'object',
                properties: {
                    status:    { type: 'string' },
                    timestamp: { type: 'string' },
                    version:   { type: 'string' },
                },
            }},
        },
        config: { rateLimit: false },
    }, async () => ({
        status:    'ok',
        timestamp: new Date().toISOString(),
        version:   process.env.npm_package_version || '1.0.0',
    }));

    // Global error handler
    app.setErrorHandler((error, request, reply) => {
        // Validation error from AJV
        if (error.validation) {
            return reply.status(400).send({
                success: false,
                error: 'Validation failed',
                details: error.validation.map((e) => ({
                    field: e.instancePath.replace('/', '') || e.params?.missingProperty,
                    message: e.message,
                })),
            });
        }

        // Rate limit (@fastify/rate-limit throws Error with statusCode 429)
        if (error.statusCode === 429) {
            const body = error.rateLimitPayload ?? {
                success: false,
                error: error.message || 'Too many requests',
            };
            return reply.status(429).send(body);
        }

        // Known application error (thrown from service layer or Supabase AuthApiError)
        const statusCode = error.statusCode || error.status;
        if (statusCode) {
            return reply.status(statusCode).send({
                success: false,
                error: error.message,
            });
        }

        // Unexpected error — log it, return generic 500
        app.log.error(error);
        return reply.status(500).send({
            success: false,
            error: 'Internal server error',
        });
    });

    // 404 handler
    app.setNotFoundHandler((request, reply) => {
        reply.status(404).send({
            success: false,
            error: `Route ${request.method} ${request.url} not found`,
        });
    });

    // Register feature modules
    await app.register(authRoutes, { prefix: '/auth' });
    await app.register(userRoutes, { prefix: '/user' });
    await app.register(usersRoutes, { prefix: '/users' });
    await app.register(wardrobeRoutes, { prefix: '/wardrobe' });
    await app.register(outfitRoutes, { prefix: '/wardrobe/outfits' });
    await app.register(recommendationsRoutes, { prefix: '/recommendations' });
    await app.register(outfitPhotoRatingsRoutes, { prefix: '/outfit-photo-ratings' });

    // Social Hub
    await app.register(postsRoutes, { prefix: '/posts' });
    await app.register(commentsRoutes, { prefix: '/posts/:postId/comments' });
    await app.register(followsRoutes, { prefix: '/follows' });
    await app.register(feedRoutes, { prefix: '/feed' });

    // Marketplace
    await app.register(vendorsRoutes,  { prefix: '/vendors'  });
    await app.register(productsRoutes, { prefix: '/products' });
    await app.register(cartRoutes,     { prefix: '/cart'     });
    await app.register(ordersRoutes,   { prefix: '/orders'   });
    await app.register(campaignsRoutes, { prefix: '/campaigns' });

    // Notifications
    await app.register(notificationsRoutes, { prefix: '/notifications' });

    // Trending score refresh job — every 15 minutes (skipped in test)
    if (process.env.NODE_ENV !== 'test') {
        refreshTrendingCache(); // warm cache on startup
        setInterval(refreshTrendingCache, 15 * 60 * 1000);
        startWardrobeMaterializationWorker(app.log);
        startOutfitPhotoRatingsWorker(app.log);
    }

    return app;
}
