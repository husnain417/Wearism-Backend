import { supabase } from '../../../config/supabase.js';
import { parsePagination, paginatedResult } from '../../../utils/pagination.js';
import { checkContent } from '../../../services/nsfwFilter.js';
import { sendToUser } from '../../../services/notifications.js';

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

        // Notification logic (fire-and-forget)
        if (parent_id) {
            // Reply to a comment -> Notify parent comment author
            supabase.from('post_comments').select('user_id').eq('id', parent_id).single()
                .then(({ data: parent }) => {
                    if (parent && parent.user_id !== userId) {
                        supabase.from('profiles').select('full_name').eq('id', userId).single()
                            .then(({ data: profile }) => {
                                const commenterName = profile?.full_name || 'Someone';
                                sendToUser(parent.user_id, {
                                    title: 'New Reply',
                                    body: `@${commenterName} replied to your comment`,
                                    data: { type: 'comment_reply', postId, commentId: data.id },
                                }).catch(() => {});
                            }).catch(() => {});
                    }
                }).catch(() => {});
        } else {
            // Top-level comment -> Notify post author
            supabase.from('posts').select('user_id').eq('id', postId).single()
                .then(({ data: post }) => {
                    if (post && post.user_id !== userId) {
                        supabase.from('profiles').select('full_name').eq('id', userId).single()
                            .then(({ data: profile }) => {
                                const commenterName = profile?.full_name || 'Someone';
                                sendToUser(post.user_id, {
                                    title: 'New Comment',
                                    body: `@${commenterName} commented on your post`,
                                    data: { type: 'comment', postId, commentId: data.id },
                                }).catch(() => {});
                            }).catch(() => {});
                    }
                }).catch(() => {});
        }

        return data;
    },


    // ── LIST COMMENTS (with replies nested) ──────────────────
    async listComments(postId, query) {
        const { page, limit, from } = parsePagination(query);

        // Fetch top-level comments
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
            return paginatedResult([], 0, page, limit);
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

        const combined = topLevel.map(c => ({
            ...c,
            replies: replyMap[c.id] || [],
        }));

        return paginatedResult(combined, count || 0, page, limit);
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
