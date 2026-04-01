// src/services/trendingScore.js
import { supabase } from '../config/supabase.js';
import { getRedisClient } from '../config/redis.js';

const TRENDING_CACHE_KEY = 'trending:posts';
const TRENDING_TTL = 15 * 60;        // 15 minutes in seconds
export const TRENDING_POST_LIMIT = 50;             // top 50 in cache

// Hacker News-style time decay formula
// score = (likes*1.5 + comments*2 - reports*3) / (age_hours + 2)^1.5
function computeScore({ likes_count, comments_count, report_count, created_at }) {
    if (!created_at) return 0;
    const ageHours = (Date.now() - new Date(created_at).getTime()) / 3600000;
    const raw = ((likes_count || 0) * 1.5) + ((comments_count || 0) * 2) - ((report_count || 0) * 3);
    return Math.max(0, raw / Math.pow(Math.max(0, ageHours) + 2, 1.5));
}

export async function refreshTrendingCache() {
    try {
        // Fetch recent posts (last 7 days) with engagement data
        const since = new Date(Date.now() - 7 * 24 * 3600000).toISOString();

        const { data: posts, error } = await supabase
            .from('posts')
            .select(`
        id, user_id, caption, image_url, outfit_id,
        likes_count, comments_count, report_count,
        occasion, season, tags, created_at,
        profiles!user_id(id, full_name, avatar_url)`,
            )
            .eq('visibility', 'public')
            .eq('is_hidden', false)
            .is('deleted_at', null)
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(500);

        if (error) throw error;

        // Score and sort
        const scored = posts
            .map(p => ({ ...p, _score: computeScore(p) }))
            .sort((a, b) => b._score - a._score)
            .slice(0, TRENDING_POST_LIMIT);

        // Update trending_score column in DB for the top posts
        for (const post of scored.slice(0, 20)) {
            await supabase
                .from('posts')
                .update({ trending_score: post._score })
                .eq('id', post.id);
        }

        // Cache the full scored list in Redis
        const redis = getRedisClient();
        await redis.setex(
            TRENDING_CACHE_KEY,
            TRENDING_TTL,
            JSON.stringify(scored),
        );

        console.log(`[Trending] Refreshed — top score: ${scored[0]?._score?.toFixed(2)}`);
    } catch (err) {
        console.error('[Trending] Refresh failed:', err.message);
    }
}

export async function getTrendingPosts(limit = 20, offset = 0) {
    const redis = getRedisClient();
    const cached = await redis.get(TRENDING_CACHE_KEY);

    if (cached) {
        const posts = JSON.parse(cached);
        return posts.slice(offset, offset + limit);
    }

    // Cache miss — regenerate and return
    await refreshTrendingCache();
    const fresh = await redis.get(TRENDING_CACHE_KEY);
    const posts = fresh ? JSON.parse(fresh) : [];
    return posts.slice(offset, offset + limit);
}
