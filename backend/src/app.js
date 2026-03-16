import Fastify from 'fastify';
import fastifyEnv from '@fastify/env';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';

import { envSchema } from './config/env.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { userRoutes } from './modules/user/user.routes.js';
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
import { refreshTrendingCache } from './services/trendingScore.js';
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
    await app.register(wardrobeRoutes, { prefix: '/wardrobe' });
    await app.register(outfitRoutes, { prefix: '/wardrobe/outfits' });
    await app.register(recommendationsRoutes, { prefix: '/recommendations' });

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

    // Trending score refresh job — every 15 minutes (skipped in test)
    if (process.env.NODE_ENV !== 'test') {
        refreshTrendingCache(); // warm cache on startup
        setInterval(refreshTrendingCache, 15 * 60 * 1000);
    }

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
