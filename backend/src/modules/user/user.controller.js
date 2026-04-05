import { userService } from './user.service.js';
import { supabase } from '../../config/supabase.js';

export const userController = {
    // GET /users/:id/profile — public summary for another user
    async getPublicProfile(request, reply) {
        const targetId = request.params.id;
        const profile = await userService.getPublicProfileById(targetId);
        return reply.send({ success: true, profile });
    },

    // GET /user/profile
    async getProfile(request, reply) {
        const userId = request.user.sub;
        const profile = await userService.getProfile(userId);

        // Fetch social counts and recent posts in parallel
        const [
            { count: followersCount },
            { count: followingCount },
            { count: postsCount },
            { data: recentPosts },
        ] = await Promise.all([
            supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
            supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
            supabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
            supabase.from('posts')
                .select('id, image_path, created_at')
                .eq('user_id', userId)
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .limit(9),
        ]);

        // posts.image_url is null in DB (signed at read-time). Sign image_path here
        // so the profile screen grid can show thumbnails immediately.
        const EXPIRES_IN_SECONDS = 60 * 60 * 24 * 365;
        const recentPostsSigned = await Promise.all(
            (recentPosts ?? []).map(async (post) => {
                if (!post?.image_path) {
                    return { id: post.id, image_url: null, created_at: post.created_at };
                }

                try {
                    const { data: signed } = await supabase.storage
                        .from('posts')
                        .createSignedUrl(post.image_path, EXPIRES_IN_SECONDS);
                    return {
                        id: post.id,
                        image_url: signed?.signedUrl ?? null,
                        created_at: post.created_at,
                    };
                } catch {
                    return { id: post.id, image_url: null, created_at: post.created_at };
                }
            })
        );

        console.log('[Profile] Recent posts signed:', JSON.stringify(recentPostsSigned, null, 2));

        return reply.send({
            success: true,
            profile: {
                id: profile.id,
                email: profile.email,
                full_name: profile.full_name,
                avatar_url: profile.avatar_url,
                gender: profile.gender,
                age_range: profile.age_range,
                height_cm: profile.height_cm,
                weight_kg: profile.weight_kg,
                body_type: profile.body_type,
                skin_tone: profile.skin_tone,
                created_at: profile.created_at,
                followers_count: followersCount ?? 0,
                following_count: followingCount ?? 0,
                posts_count: postsCount ?? 0,
                recent_posts: recentPostsSigned ?? [],
            },
            completion_score: profile.profile_completion ?? 0,
        });
    },

    // PATCH /user/profile
    async updateProfile(request, reply) {
        const updated = await userService.updateProfile(request.user.sub, request.body);

        return reply.send({
            success: true,
            message: 'Profile updated successfully.',
            profile: updated,
        });
    },

    // POST /user/profile/avatar
    async uploadAvatar(request, reply) {
        // IMPORTANT: In multipart "keyValues" mode, the multipart plugin may pre-consume the stream.
        // For avatars we need the file buffer, so read from request.body.file instead.
        const file = request.body?.file;

        if (!file) {
            return reply.status(400).send({ success: false, error: 'No file uploaded.' });
        }

        const buffer = Buffer.isBuffer(file) ? file : Buffer.from(file);

        const MAX_SIZE = 5 * 1024 * 1024;
        if (buffer.length > MAX_SIZE) {
            return reply.status(413).send({ success: false, error: 'Image must be under 5MB.' });
        }

        const avatarUrl = await userService.uploadAvatar(
            request.user.sub,
            buffer,
            'image/jpeg'
        );

        return reply.send({
            success: true,
            message: 'Avatar uploaded successfully.',
            avatar_url: avatarUrl,
        });
    },
};
