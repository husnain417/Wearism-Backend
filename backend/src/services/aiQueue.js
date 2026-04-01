// Pushes AI jobs to the Python FastAPI service via HTTP.
// FastAPI acts as a lightweight proxy, seamlessly enqueuing the job into Celery natively.
// This completely bypasses the BullMQ-to-Celery Redis protocol incompatibility.
// Fastify never receives results — Celery writes directly to Supabase.

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';
const INTERNAL_SECRET = process.env.AI_SHARED_SECRET || 'wearism_internal_secret_dev';

async function dispatchToPythonBroker(endpoint, payload) {
    if (process.env.NODE_ENV === 'test') return;
    
    try {
        const response = await fetch(`${AI_SERVICE_URL}/queue${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Secret': INTERNAL_SECRET,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`FastAPI returned ${response.status}: ${err}`);
        }
    } catch (err) {
        console.error(`[AI Queue] Connection to AI Service failed: ${err.message}`);
        throw err; // Re-throw so the caller can implement retry logic
    }
}

export const aiQueue = {

    async queueClothingClassification({ itemId, imageUrl, aiResultId }) {
        await dispatchToPythonBroker('/classify/clothing', {
            item_id: itemId,
            image_url: imageUrl,
            ai_result_id: aiResultId,
        });
    },

    async queueOutfitRating({ outfitId, aiResultId, season, occasion, weather }) {
        await dispatchToPythonBroker('/rate/outfit', {
            outfit_id: outfitId,
            ai_result_id: aiResultId,
            season: season || null,
            occasion: occasion || null,
            weather: weather || null,
        });
    },

    async queueUserAnalysis({ userId, imageUrl, aiResultId }) {
        await dispatchToPythonBroker('/analyse/user', {
            user_id: userId,
            image_url: imageUrl,
            ai_result_id: aiResultId,
        });
    },

    async queueRecommendationRating({
        recommendationId, items, aiResultId, userId,
        season, occasion, weather
    }) {
        await dispatchToPythonBroker('/rate/recommendation', {
            recommendation_id: recommendationId,
            items: items || [],
            ai_result_id: aiResultId,
            user_id: userId,
            season: season || null,
            occasion: occasion || null,
            weather: weather || null,
        });
    },
};
