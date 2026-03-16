// src/modules/social/posts/posts.service.js
import { supabase } from '../../../config/supabase.js';
import { checkPost } from '../../../services/nsfwFilter.js';
import { invalidateFollowerFeeds } from '../../../services/feedCache.js';

const MAX_CAPTION_LENGTH = 500;
const MAX_TAGS = 10;

export const postsService = {

    // ── CREATE POST ───────────────────────────────────────────
    async createPost(userId, { caption, image_path, outfit_id, occasion,
        season, weather, tags, visibility }) {

        // NSFW check on caption + tags
        const nsfw = checkPost({ caption, tags });
        if (nsfw.blocked) {
            throw { statusCode: 400, message: `Post blocked: ${nsfw.reason}` };
        }

        // Generate signed image URL if image_path provided
        let image_url = null;
        if (image_path) {
            // Validate path ownership
            if (!image_path.startsWith(`${userId}/`)) {
                throw { statusCode: 403, message: 'Invalid image path.' };
            }
            const { data: signed } = await supabase.storage
                .from('posts')
                .createSignedUrl(image_path, 60 * 60 * 24 * 365); // 1-year signed URL
            image_url = signed?.signedUrl || null;
        }

        const { data: post, error } = await supabase
            .from('posts')
            .insert({
                user_id: userId,
                caption: caption || null,
                image_url,
                image_path: image_path || null,
                outfit_id: outfit_id || null,
                occasion: occasion || null,
                season: season || null,
                weather: weather || null,
                tags: tags || [],
                visibility: visibility || 'public',
                is_nsfw_flagged: nsfw.flagged,
            })
            .select(`*, profiles!user_id(id, full_name, avatar_url)`)
            .single();

        if (error) throw error;

        // Invalidate all followers' feed caches asynchronously
        // Don't await — user gets their post response immediately
        invalidateFollowerFeeds(userId).catch(err =>
            console.error('[Feed] Invalidation failed:', err.message)
        );

        return post;
    },


    // ── GET SINGLE POST ───────────────────────────────────────
    async getPost(postId, requestingUserId) {
        const { data, error } = await supabase
            .from('posts')
            .select(`
        *, profiles!user_id(id, full_name, avatar_url, followers_count)`,
            )
            .eq('id', postId)
            .is('deleted_at', null)
            .eq('is_hidden', false)
            .single();

        if (error) throw { statusCode: 404, message: 'Post not found.' };

        // Check visibility
        if (data.visibility === 'followers_only' && data.user_id !== requestingUserId) {
            const { count } = await supabase
                .from('follows')
                .select('*', { count: 'exact', head: true })
                .eq('follower_id', requestingUserId)
                .eq('following_id', data.user_id)
                .is('deleted_at', null);
            if (!count) throw { statusCode: 403, message: 'This post is for followers only.' };
        }

        if (data.visibility === 'private' && data.user_id !== requestingUserId) {
            throw { statusCode: 404, message: 'Post not found.' };
        }

        // Check if requesting user has liked this post
        const { count: liked } = await supabase
            .from('post_likes')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', postId)
            .eq('user_id', requestingUserId);

        return { ...data, viewer_has_liked: liked > 0 };
    },


    // ── DELETE POST (soft) ────────────────────────────────────
    async deletePost(userId, postId) {
        const { error } = await supabase
            .from('posts')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', postId)
            .eq('user_id', userId);

        if (error) throw { statusCode: 404, message: 'Post not found.' };

        // Remove from follower feeds
        invalidateFollowerFeeds(userId).catch(() => { });
    },


    // ── LIST USER POSTS ───────────────────────────────────────
    async listUserPosts(targetUserId, requestingUserId, { page, limit }) {
        const isSelf = targetUserId === requestingUserId;

        let query = supabase
            .from('posts')
            .select('*, profiles!user_id(id, full_name, avatar_url)', { count: 'exact' })
            .eq('user_id', targetUserId)
            .is('deleted_at', null)
            .eq('is_hidden', false)
            .order('created_at', { ascending: false });

        if (!isSelf) {
            query = query.in('visibility', ['public']);
        }

        const from = (page - 1) * limit;
        query = query.range(from, from + limit - 1);

        const { data, error, count } = await query;
        if (error) throw error;

        return {
            posts: data || [],
            pagination: { total: count, page, limit, total_pages: Math.ceil(count / limit) },
        };
    },


    // ── TOGGLE LIKE ───────────────────────────────────────────
    async toggleLike(userId, postId) {
        // Check if already liked
        const { data: existing } = await supabase
            .from('post_likes')
            .select('id')
            .eq('post_id', postId)
            .eq('user_id', userId)
            .single();

        if (existing) {
            // Unlike
            await supabase.from('post_likes').delete()
                .eq('post_id', postId).eq('user_id', userId);
            return { liked: false };
        } else {
            // Like
            await supabase.from('post_likes').insert({ post_id: postId, user_id: userId });
            return { liked: true };
        }
    },


    // ── REPORT POST ───────────────────────────────────────────
    async reportPost(userId, postId, { reason, detail }) {
        const { error } = await supabase
            .from('post_reports')
            .insert({ post_id: postId, user_id: userId, reason, detail: detail || null });

        // Unique constraint handles duplicate reports gracefully
        if (error && error.code !== '23505') throw error;

        return { reported: true };
    },
};
