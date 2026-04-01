import { userService } from './user.service.js';
import { supabase } from '../../config/supabase.js';

export const userController = {
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
                .select('id, image_url, created_at')
                .eq('user_id', userId)
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .limit(9),
        ]);

        console.log('[Profile] Recent posts:', JSON.stringify(recentPosts, null, 2));

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
                recent_posts: recentPosts ?? [],
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
        const file = await request.file();

        if (!file) {
            return reply.status(400).send({ success: false, error: 'No file uploaded.' });
        }

        // Read file into buffer with 5MB size limit
        const MAX_SIZE = 5 * 1024 * 1024;
        const chunks = [];
        let totalSize = 0;

        for await (const chunk of file.file) {
            totalSize += chunk.length;
            if (totalSize > MAX_SIZE) {
                return reply.status(413).send({
                    success: false,
                    error: 'Image must be under 5MB.',
                });
            }
            chunks.push(chunk);
        }

        const buffer = Buffer.concat(chunks);

        const avatarUrl = await userService.uploadAvatar(
            request.user.sub,
            buffer,
            file.mimetype
        );

        return reply.send({
            success: true,
            message: 'Avatar uploaded successfully.',
            avatar_url: avatarUrl,
        });
    },
};
