// Pushes AI jobs to the Python FastAPI service via HTTP.
// FastAPI acts as a lightweight proxy, seamlessly enqueuing the job into Celery natively.
// This completely bypasses the BullMQ-to-Celery Redis protocol incompatibility.
// Fastify never receives results — Celery writes directly to Supabase.

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';
const INTERNAL_SECRET = process.env.AI_SHARED_SECRET || 'wearism_internal_secret_dev';

// FastAPI QueueRateRecommendationRequest.items uses OutfitItem: item_id, category, colors[], optional pattern/fit
const BASIC_COLOR_WORDS = new Set([
    'black', 'white', 'red', 'blue', 'green', 'yellow', 'orange', 'pink', 'purple',
    'brown', 'grey', 'gray', 'beige', 'navy', 'cream', 'khaki', 'olive', 'burgundy',
    'maroon', 'tan', 'gold', 'silver', 'cyan', 'magenta', 'lavender', 'coral',
    'teal', 'mint', 'ivory', 'charcoal', 'denim', 'multicolor', 'neutral',
]);

function outfitColorsFromWardrobeRow(row) {
    if (Array.isArray(row.colors) && row.colors.length > 0) {
        return row.colors.map((c) => String(c));
    }
    const attrs = row.fashionclip_attributes;
    if (Array.isArray(attrs)) {
        const picked = attrs
            .map((a) => String(a).toLowerCase())
            .filter((a) => BASIC_COLOR_WORDS.has(a));
        if (picked.length > 0) return [...new Set(picked)];
    }
    if (Array.isArray(row.color_dominant_rgb) && row.color_dominant_rgb.length > 0) {
        return row.color_dominant_rgb.slice(0, 3).map(
            ([r, g, b]) => `rgb(${Math.round(Number(r))},${Math.round(Number(g))},${Math.round(Number(b))})`
        );
    }
    return ['unknown'];
}

function wardrobeRowToOutfitItem(row) {
    if (!row?.id) throw new Error('Invalid wardrobe row: missing id');
    const item = {
        item_id: row.id,
        category: row.fashionclip_main_category || row.tag || 'unknown',
        colors: outfitColorsFromWardrobeRow(row),
    };
    if (row.pattern != null && String(row.pattern).trim() !== '') {
        item.pattern = String(row.pattern);
    }
    if (row.fit != null && String(row.fit).trim() !== '') {
        item.fit = String(row.fit);
    }
    return item;
}

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
        const outfitItems = (items || []).map(wardrobeRowToOutfitItem);
        await dispatchToPythonBroker('/rate/recommendation', {
            recommendation_id: recommendationId,
            items: outfitItems,
            ai_result_id: aiResultId,
            user_id: userId,
            season: season || null,
            occasion: occasion || null,
            weather: weather || null,
        });
    },
};
