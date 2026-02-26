import { supabase } from '../../config/supabase.js';
import { imageProcessor } from '../../utils/imageProcessor.js';

export const userService = {
    // ── GET PROFILE ──────────────────────────────────────
    async getProfile(userId) {
        const { data, error } = await supabase
            .from('profiles')
            .select(`
        id, email, full_name, avatar_url,
        gender, age_range, height_cm, weight_kg,
        body_type, skin_tone,
        gdpr_consent, gdpr_consent_date,
        created_at, updated_at,
        get_profile_completion(profiles)
      `)
            .eq('id', userId)
            .is('deleted_at', null) // never return soft-deleted profiles
            .single();

        if (error) throw error;
        return data;
    },

    // ── UPDATE PROFILE ───────────────────────────────────
    async updateProfile(userId, updates) {
        // Strip undefined values — allows clean partial updates
        const cleanUpdates = Object.fromEntries(
            Object.entries(updates).filter(([_, v]) => v !== undefined)
        );

        if (Object.keys(cleanUpdates).length === 0) {
            throw { statusCode: 400, message: 'No valid fields provided for update.' };
        }

        const { data, error } = await supabase
            .from('profiles')
            .update(cleanUpdates)
            .eq('id', userId)
            .is('deleted_at', null)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // ── UPLOAD AVATAR ────────────────────────────────────
    async uploadAvatar(userId, fileBuffer, mimetype) {
        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
        if (!allowedTypes.includes(mimetype)) {
            throw { statusCode: 400, message: 'Avatar must be JPEG, PNG, WebP, or HEIC.' };
        }

        // Compress and convert to WebP using Sharp
        const compressedBuffer = await imageProcessor.processAvatar(fileBuffer);

        // File path: avatars/{userId}/avatar.webp
        // Same path every time = overwrites old avatar automatically
        const filePath = `${userId}/avatar.webp`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, compressedBuffer, {
                contentType: 'image/webp',
                upsert: true, // overwrite if exists
            });

        if (uploadError) throw uploadError;

        // Get a signed URL valid for 1 year
        // Signed URL = private access, not publicly guessable
        const { data: signedData, error: signedError } = await supabase.storage
            .from('avatars')
            .createSignedUrl(filePath, 60 * 60 * 24 * 365);

        if (signedError) throw signedError;

        // Save signed URL in profiles table
        const { data, error: dbError } = await supabase
            .from('profiles')
            .update({ avatar_url: signedData.signedUrl })
            .eq('id', userId)
            .select('avatar_url')
            .single();

        if (dbError) throw dbError;

        return data.avatar_url;
    },

    // ── DELETE AVATAR (GDPR cleanup) ─────────────────────
    async deleteAvatar(userId) {
        try {
            await supabase.storage
                .from('avatars')
                .remove([`${userId}/avatar.webp`]);
        } catch (err) {
            // Log but do not block account deletion
            console.error('Avatar deletion failed:', err.message);
        }
    },
};
