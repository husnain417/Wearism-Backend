import { supabase } from '../../../config/supabase.js';
import { signedUrlForPostImage } from '../../../services/postImageUrl.js';

const STORY_TTL_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay() {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

export const storiesService = {
    async getStoryStatus(userId) {
        const since = startOfUtcDay().toISOString();
        const { count, error } = await supabase
            .from('stories')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .is('deleted_at', null)
            .gte('created_at', since);

        if (error) throw error;
        return { can_post: (count ?? 0) < 1 };
    },

    async listFeedStories(viewerId) {
        const since = new Date(Date.now() - STORY_TTL_MS).toISOString();

        const { data: follows, error: fErr } = await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', viewerId)
            .is('deleted_at', null);

        if (fErr) throw fErr;

        const authorIds = [viewerId, ...((follows || []).map((r) => r.following_id))];

        const { data: rows, error } = await supabase
            .from('stories')
            .select(`
        id,
        user_id,
        image_path,
        created_at,
        profiles!user_id(id, full_name, avatar_url)
      `)
            .in('user_id', authorIds)
            .is('deleted_at', null)
            .gte('created_at', since)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const seenUser = new Set();
        const deduped = [];
        for (const row of rows || []) {
            if (seenUser.has(row.user_id)) continue;
            seenUser.add(row.user_id);
            deduped.push(row);
        }

        deduped.sort((a, b) => {
            if (a.user_id === viewerId) return -1;
            if (b.user_id === viewerId) return 1;
            return new Date(b.created_at) - new Date(a.created_at);
        });

        return deduped.map((row) => {
            const profile = row.profiles;
            return {
                id: row.id,
                user_id: row.user_id,
                image_url: signedUrlForPostImage(row.image_path),
                avatar_url: profile?.avatar_url ?? null,
                full_name: profile?.full_name ?? 'User',
                created_at: row.created_at,
            };
        });
    },

    async assertViewerCanSeeStory(viewerId, storyRow) {
        if (storyRow.user_id === viewerId) return;
        const { count, error } = await supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('follower_id', viewerId)
            .eq('following_id', storyRow.user_id)
            .is('deleted_at', null);

        if (error) throw error;
        if (!count) {
            const err = new Error('Story not available.');
            err.statusCode = 403;
            throw err;
        }
    },

    async getStory(storyId, viewerId) {
        const { data: row, error } = await supabase
            .from('stories')
            .select(`
        id,
        user_id,
        image_path,
        created_at,
        profiles!user_id(id, full_name, avatar_url)
      `)
            .eq('id', storyId)
            .is('deleted_at', null)
            .single();

        if (error || !row) {
            const err = new Error('Story not found.');
            err.statusCode = 404;
            throw err;
        }

        const age = Date.now() - new Date(row.created_at).getTime();
        if (age > STORY_TTL_MS) {
            const err = new Error('Story has expired.');
            err.statusCode = 404;
            throw err;
        }

        await this.assertViewerCanSeeStory(viewerId, row);

        const profile = row.profiles;
        return {
            id: row.id,
            user_id: row.user_id,
            image_url: signedUrlForPostImage(row.image_path),
            avatar_url: profile?.avatar_url ?? null,
            full_name: profile?.full_name ?? 'User',
            created_at: row.created_at,
        };
    },

    async createStory(userId, { story_id, image_path }, file) {
        const since = startOfUtcDay().toISOString();
        const { count, error: cErr } = await supabase
            .from('stories')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .is('deleted_at', null)
            .gte('created_at', since);

        if (cErr) throw cErr;
        if ((count ?? 0) >= 1) {
            const err = new Error('You can only post one story per day.');
            err.statusCode = 400;
            throw err;
        }

        if (!image_path?.startsWith(`${userId}/stories/`)) {
            const err = new Error('Invalid image path.');
            err.statusCode = 403;
            throw err;
        }

        if (!file || !image_path) {
            const err = new Error('Image file is required.');
            err.statusCode = 400;
            throw err;
        }

        const buffer = Buffer.isBuffer(file) ? file : Buffer.from(file);
        const { error: uploadError } = await supabase.storage
            .from('posts')
            .upload(image_path, buffer, {
                contentType: 'image/jpeg',
                upsert: true,
            });
        if (uploadError) throw uploadError;

        const { data: story, error } = await supabase
            .from('stories')
            .insert({
                id: story_id || undefined,
                user_id: userId,
                image_path,
            })
            .select('id, user_id, image_path, created_at')
            .single();

        if (error) throw error;

        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', userId)
            .single();

        return {
            id: story.id,
            user_id: story.user_id,
            image_url: signedUrlForPostImage(story.image_path),
            avatar_url: profile?.avatar_url ?? null,
            full_name: profile?.full_name ?? 'User',
            created_at: story.created_at,
        };
    },

    async deleteStory(userId, storyId) {
        const { data: row, error: gErr } = await supabase
            .from('stories')
            .select('id, user_id')
            .eq('id', storyId)
            .is('deleted_at', null)
            .single();

        if (gErr || !row) {
            const err = new Error('Story not found.');
            err.statusCode = 404;
            throw err;
        }
        if (row.user_id !== userId) {
            const err = new Error('Story not found.');
            err.statusCode = 404;
            throw err;
        }

        const { error } = await supabase
            .from('stories')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', storyId)
            .eq('user_id', userId);

        if (error) throw error;
    },
};
