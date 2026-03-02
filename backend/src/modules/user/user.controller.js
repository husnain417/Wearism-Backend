import { userService } from './user.service.js';

export const userController = {
    // GET /user/profile
    async getProfile(request, reply) {
        const profile = await userService.getProfile(request.user.sub);

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
            },
            completion_score: profile.get_profile_completion,
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
