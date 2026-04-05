// src/services/feedCache.js
import { getRedisClient } from '../config/redis.js';
import { supabase } from '../config/supabase.js';
import { signedUrlForPostImage } from './postImageUrl.js';

const FEED_KEY = (userId) => `feed:${userId}`;
const FEED_TTL = 30 * 60;   // 30 minutes
const MAX_FEED_SIZE = 200;        // max posts stored per user feed in Redis

// ── BUILD: compute feed from DB and cache it ────────────────
export async function buildUserFeed(userId) {
    // Get list of users this person follows
    const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId)
        .is('deleted_at', null);

    const followingIds = [userId, ...(follows?.map(f => f.following_id) ?? [])];

    if (followingIds.length === 0) {
        const redis = getRedisClient();
        await redis.setex(FEED_KEY(userId), FEED_TTL, JSON.stringify([]));
        return [];
    }

    // Fetch recent posts from followed users (last 30 days)
    const since = new Date(Date.now() - 30 * 24 * 3600000).toISOString();

    const { data: posts } = await supabase
        .from('posts')
        .select(`
      id, user_id, caption, image_url, image_path, outfit_id,
      likes_count, comments_count, occasion, season,
      tags, visibility, created_at,
      profiles!user_id(id, full_name, avatar_url)`,
        )
        .in('user_id', followingIds)
        .in('visibility', ['public', 'followers_only'])  // followers_only visible to followers
        .eq('is_hidden', false)
        .is('deleted_at', null)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(MAX_FEED_SIZE);

    const feed = (posts || []).map((post) => {
        if (!post.image_url && post.image_path) {
            const image_url = signedUrlForPostImage(post.image_path);
            return { ...post, image_url };
        }
        return post;
    });

    // Cache as JSON string (sorted set would need score per item — JSON is simpler here)
    const redis = getRedisClient();
    await redis.setex(FEED_KEY(userId), FEED_TTL, JSON.stringify(feed));

    return feed;
}

// ── READ: get paginated feed from cache ──────────────────────
export async function getUserFeed(userId, { page = 1, limit = 20 } = {}) {
    const redis = getRedisClient();
    const cached = await redis.get(FEED_KEY(userId));

    let feed;
    if (cached) {
        feed = JSON.parse(cached);
    } else {
        feed = await buildUserFeed(userId);
    }

    const from = (page - 1) * limit;
    const pagePosts = feed.slice(from, from + limit);

    // Enrich with per-user like status
    const postIds = pagePosts.map(p => p.id);
    const { data: likes } = postIds.length === 0
        ? { data: [] }
        : await supabase
            .from('post_likes')
            .select('post_id')
            .eq('user_id', userId)
            .in('post_id', postIds);

    const likedSet = new Set((likes || []).map(l => l.post_id));

    // Fetch fresh counts from DB
    const { data: freshCounts } = postIds.length === 0
        ? { data: [] }
        : await supabase
            .from('posts')
            .select('id, likes_count, comments_count')
            .in('id', postIds);

    const countsMap = new Map((freshCounts || []).map(p => [p.id, p]));

    const enriched = pagePosts.map(p => ({
        ...p,
        viewer_has_liked: likedSet.has(p.id),
        likes_count: countsMap.get(p.id)?.likes_count ?? p.likes_count,
        comments_count: countsMap.get(p.id)?.comments_count ?? p.comments_count,
    }));

    return {
        posts: enriched,
        total: feed.length,
        from_cache: cached !== null,
    };
}

// ── INVALIDATE: called when someone the user follows posts ───
export async function invalidateUserFeed(userId) {
    const redis = getRedisClient();
    await redis.del(FEED_KEY(userId));
}

// ── INVALIDATE FOLLOWERS: when user X posts, invalidate all followers' feeds
export async function invalidateFollowerFeeds(postingUserId) {
    // Get all followers of this user
    const { data: followers } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', postingUserId)
        .is('deleted_at', null);

    if (!followers || followers.length === 0) return;

    const redis = getRedisClient();
    const keys = followers.map(f => FEED_KEY(f.follower_id));

    // Delete all follower feed caches in one pipeline call
    if (keys.length > 0) {
        await redis.del(...keys);
    }

    console.log(`[Feed] Invalidated ${keys.length} follower feeds for user ${postingUserId}`);
}
