// src/modules/social/follows/follows.service.js
import { supabase } from '../../../config/supabase.js';
import { invalidateUserFeed } from '../../../services/feedCache.js';

export const followsService = {

    // ── FOLLOW ────────────────────────────────────────────────
    async follow(followerId, followingId) {
        if (followerId === followingId) {
            throw { statusCode: 400, message: 'Cannot follow yourself.' };
        }

        // Check if already following (may be soft-deleted)
        const { data: existing } = await supabase
            .from('follows')
            .select('id, deleted_at')
            .eq('follower_id', followerId)
            .eq('following_id', followingId)
            .single();

        if (existing && existing.deleted_at === null) {
            throw { statusCode: 400, message: 'Already following.' };
        }

        if (existing && existing.deleted_at !== null) {
            // Re-follow: restore soft-deleted follow
            await supabase
                .from('follows')
                .update({ deleted_at: null })
                .eq('id', existing.id);
        } else {
            // New follow
            await supabase.from('follows').insert({
                follower_id: followerId,
                following_id: followingId,
            });
        }

        // Invalidate follower's feed — they now see this user's posts
        await invalidateUserFeed(followerId);

        return { following: true };
    },


    // ── UNFOLLOW ──────────────────────────────────────────────
    async unfollow(followerId, followingId) {
        const { error } = await supabase
            .from('follows')
            .update({ deleted_at: new Date().toISOString() })
            .eq('follower_id', followerId)
            .eq('following_id', followingId)
            .is('deleted_at', null);

        if (error) throw { statusCode: 404, message: 'Follow not found.' };

        // Invalidate follower's feed — they no longer see this user's posts
        await invalidateUserFeed(followerId);

        return { following: false };
    },


    // ── LIST FOLLOWERS ────────────────────────────────────────
    async listFollowers(userId, { page, limit }) {
        const from = (page - 1) * limit;
        const { data, error, count } = await supabase
            .from('follows')
            .select(`follower_id, created_at, profiles!follower_id(id, full_name, avatar_url)`, { count: 'exact' })
            .eq('following_id', userId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .range(from, from + limit - 1);

        if (error) throw error;
        return { followers: data || [], pagination: { total: count, page, limit, total_pages: Math.ceil(count / limit) } };
    },


    // ── LIST FOLLOWING ────────────────────────────────────────
    async listFollowing(userId, { page, limit }) {
        const from = (page - 1) * limit;
        const { data, error, count } = await supabase
            .from('follows')
            .select(`following_id, created_at, profiles!following_id(id, full_name, avatar_url)`, { count: 'exact' })
            .eq('follower_id', userId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .range(from, from + limit - 1);

        if (error) throw error;
        return { following: data || [], pagination: { total: count, page, limit, total_pages: Math.ceil(count / limit) } };
    },


    // ── CHECK RELATIONSHIP ────────────────────────────────────
    async getRelationship(viewerId, targetId) {
        const [fwd, rev] = await Promise.all([
            supabase.from('follows').select('id').eq('follower_id', viewerId).eq('following_id', targetId).is('deleted_at', null).single(),
            supabase.from('follows').select('id').eq('follower_id', targetId).eq('following_id', viewerId).is('deleted_at', null).single(),
        ]);
        return {
            you_follow_them: !!fwd.data,
            they_follow_you: !!rev.data,
            mutual: !!fwd.data && !!rev.data,
        };
    },
};
