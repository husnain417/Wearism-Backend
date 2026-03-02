// src/services/aiService.js
// HTTP client for all FastAPI AI service calls
// Used by Phase 3 (clothing), Phase 4 (age/height), Phase 5 (outfit rating)

const AI_BASE_URL = process.env.AI_SERVICE_URL; // http://localhost:8000
const AI_TIMEOUT = 30000; // 30 seconds — AI can be slow

async function callAI(endpoint, payload) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT);

    try {
        const response = await fetch(`${AI_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(`AI service error ${response.status}: ${err.detail || 'Unknown error'}`);
        }

        return await response.json();
    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error('AI service timed out after 30 seconds');
        }
        throw err;
    } finally {
        clearTimeout(timeout);
    }
}

export const aiService = {
    // Classify a clothing item from its image URL
    // Returns: { category, subcategory, colors, pattern, fit, fabric, season, embedding, confidence }
    async classifyClothing(imageUrl) {
        return await callAI('/classify/clothing', { image_url: imageUrl });
    },

    // Rate an outfit based on its items and user profile
    // Returns: { rating, color_score, proportion_score, style_score, feedback }
    async rateOutfit(itemIds, userProfile) {
        return await callAI('/rate/outfit', { item_ids: itemIds, user_profile: userProfile });
    },

    // Estimate age and height from user photo (Phase 4)
    async analyseUserPhoto(imageUrl) {
        return await callAI('/analyse/user', { image_url: imageUrl });
    },
};
