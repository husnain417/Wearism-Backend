// src/modules/social/comments/comments.service.js
import { supabase } from '../../../config/supabase.js';
import { checkContent } from '../../../services/nsfwFilter.js';

export const commentsService = {

    // ── CREATE COMMENT ────────────────────────────────────────
    async createComment(userId, postId, { body, parent_id }) {
        // NSFW check
        const nsfw = checkContent(body);
        if (nsfw.blocked) {
            throw { statusCode: 400, message: `Comment blocked: ${nsfw.reason}` };
        }

        // If reply, verify parent comment belongs to same post
        if (parent_id) {
            const { data: parent } = await supabase
                .from('post_comments')
                .select('post_id, parent_id')
                .eq('id', parent_id)
                .single();

            if (!parent || parent.post_id !== postId) {
                throw { statusCode: 400, message: 'Invalid parent comment.' };
            }
            // Only 1 level of threading allowed
            if (parent.parent_id) {
                throw { statusCode: 400, message: 'Cannot reply to a reply.' };
            }
        }

        const { data, error } = await supabase
            .from('post_comments')
            .insert({
                post_id: postId,
                user_id: userId,
                body,
                parent_id: parent_id || null,
                is_hidden: nsfw.flagged,
            })
            .select(`*, profiles!user_id(id, full_name, avatar_url)`)
            .single();

        if (error) throw error;
        return data;
    },


    // ── LIST COMMENTS (with replies nested) ──────────────────
    async listComments(postId, { page, limit }) {
        // Fetch top-level comments
        const from = (page - 1) * limit;
        const { data: topLevel, error, count } = await supabase
            .from('post_comments')
            .select(`*, profiles!user_id(id, full_name, avatar_url)`, { count: 'exact' })
            .eq('post_id', postId)
            .is('parent_id', null)
            .is('deleted_at', null)
            .eq('is_hidden', false)
            .order('created_at', { ascending: true })
            .range(from, from + limit - 1);

        if (error) throw error;
        if (!topLevel || topLevel.length === 0) {
            return { comments: [], pagination: { total: 0, page, limit, total_pages: 0 } };
        }

        // Fetch replies for these comments in one query
        const topIds = topLevel.map(c => c.id);
        const { data: replies } = await supabase
            .from('post_comments')
            .select(`*, profiles!user_id(id, full_name, avatar_url)`)
            .in('parent_id', topIds)
            .is('deleted_at', null)
            .eq('is_hidden', false)
            .order('created_at', { ascending: true });

        // Nest replies under parents
        const replyMap = (replies || []).reduce((acc, r) => {
            if (!acc[r.parent_id]) acc[r.parent_id] = [];
            acc[r.parent_id].push(r);
            return acc;
        }, {});

        const comments = topLevel.map(c => ({
            ...c,
            replies: replyMap[c.id] || [],
        }));

        return { comments, pagination: { total: count, page, limit, total_pages: Math.ceil(count / limit) } };
    },


    // ── DELETE COMMENT (own only) ─────────────────────────────
    async deleteComment(userId, commentId) {
        const { error } = await supabase
            .from('post_comments')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', commentId)
            .eq('user_id', userId);

        if (error) throw { statusCode: 404, message: 'Comment not found.' };
    },
};
