// Pushes AI jobs to Redis queues consumed by Celery workers.
// Fastify never receives results — Celery writes directly to Supabase.
// Mobile app polls Supabase via Fastify for status updates.
import { Queue } from 'bullmq';
import { getRedisClient } from '../config/redis.js';

let _queues;

function getQueues() {
    if (!_queues) {
        const connection = { client: getRedisClient() };
        _queues = {
            clothing: new Queue('clothing', { connection }),
            outfit: new Queue('outfits', { connection }),
            user: new Queue('users', { connection }),
        };

        // ── 9.5 Dead Letter Queue Monitoring ─────────────────────
        Object.values(_queues).forEach((queue) => {
            queue.on('failed', (job, err) => {
                if (job.attemptsMade >= job.opts.attempts) {
                    console.error({
                        msg: `[BullMQ] Job ${job.id} permanently failed in queue ${queue.name}`,
                        jobId: job.id,
                        data: job.data,
                        error: err.message,
                    });
                }
            });
        });
    }
    return _queues;
}

export const aiQueue = {

    async queueClothingClassification({ itemId, imageUrl, aiResultId }) {
        const { clothing } = getQueues();
        await clothing.add('classify_clothing', {
            item_id: itemId,
            image_url: imageUrl,
            ai_result_id: aiResultId,
        }, {
            jobId: `classify-${itemId}`,   // idempotent — prevents duplicate jobs
            attempts: 3,
            backoff: { type: 'exponential', delay: 10000 },
        });
    },

    async queueOutfitRating({ outfitId, aiResultId }) {
        const { outfit } = getQueues();
        await outfit.add('rate_outfit', {
            outfit_id: outfitId,
            ai_result_id: aiResultId,
        }, {
            jobId: `rate-${outfitId}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 15000 },
        });
    },

    async queueUserAnalysis({ userId, imageUrl, aiResultId }) {
        const { user } = getQueues();
        await user.add('analyse_user', {
            user_id: userId,
            image_url: imageUrl,
            ai_result_id: aiResultId,
        }, {
            jobId: `analyse-${userId}-${Date.now()}`,
            attempts: 2,
            backoff: { type: 'fixed', delay: 10000 },
        });
    },
};
