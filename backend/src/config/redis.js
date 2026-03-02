import { Redis } from 'ioredis';

let _redis;

export function getRedisClient() {
    if (!_redis) {
        const url = process.env.REDIS_URL;
        if (!url) {
            throw new Error('[Redis] Missing REDIS_URL in process.env. Ensure dotenv is loaded before calling getRedisClient().');
        }

        console.log('[Redis] Initializing client');
        _redis = new Redis(url, {
            maxRetriesPerRequest: null, // required by BullMQ
            enableReadyCheck: false,
            lazyConnect: true,
        });

        _redis.on('error', (err) => {
            console.error('[Redis] connection error:', err.message);
        });
        _redis.on('connect', () => {
            console.log('[Redis] connected');
        });
    }
    return _redis;
}
