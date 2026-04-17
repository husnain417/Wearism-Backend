import { supabase } from '../../config/supabase.js';
import { imageProcessor } from '../../utils/imageProcessor.js';
import { signedUrlForPostImage } from '../../services/postImageUrl.js';

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
        created_at, updated_at
      `)
            .eq('id', userId)
            .is('deleted_at', null) // never return soft-deleted profiles
            .single();

        if (error) throw error;

        // Calculate profile completion score (same logic as SQL function)
        const fields = [
            data.full_name,
            data.avatar_url,
            data.gender,
            data.age_range,
            data.height_cm,
            data.body_type,
            data.skin_tone,
        ];
        const filled = fields.filter((f) => f !== null && f !== '').length;
        const completion = Math.round((filled / fields.length) * 100);

        return { ...data, profile_completion: completion };
    },

    // ── DIRECTORY SEARCH (users + approved vendors) ─────
    async searchDirectory(rawQuery, limit = 25) {
        const query = String(rawQuery ?? '').trim().slice(0, 64);
        if (query.length < 1) return { query: '', results: [] };

        const max = Math.min(Math.max(Number(limit) || 25, 1), 50);
        const vendorCap = Math.min(max, 25);
        const userCap = Math.min(max, 25);

        const escaped = query.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
        const pattern = `%${escaped}%`;

        const vendorSelect = `
          id, shop_name, brand_name, shop_logo_url, user_id,
          profiles!user_id(full_name, avatar_url)
        `;

        const [byShop, byBrand, profilesRes] = await Promise.all([
            supabase
                .from('vendor_profiles')
                .select(vendorSelect)
                .eq('status', 'approved')
                .ilike('shop_name', pattern)
                .limit(vendorCap),
            supabase
                .from('vendor_profiles')
                .select(vendorSelect)
                .eq('status', 'approved')
                .ilike('brand_name', pattern)
                .limit(vendorCap),
            supabase
                .from('profiles')
                .select('id, full_name, avatar_url')
                .is('deleted_at', null)
                .ilike('full_name', pattern)
                .limit(userCap),
        ]);

        const vendorMap = new Map();
        for (const v of [...(byShop.data || []), ...(byBrand.data || [])]) {
            if (v?.id) vendorMap.set(v.id, v);
        }

        const vendorUserIds = new Set(
            [...vendorMap.values()].map((v) => v.user_id).filter(Boolean),
        );

        const vendorRows = [...vendorMap.values()].map((v) => ({
            kind: 'vendor',
            id: v.id,
            name: (v.shop_name || v.brand_name || 'Shop').trim(),
            subtitle:
                v.brand_name && v.shop_name && v.brand_name !== v.shop_name
                    ? String(v.brand_name).trim()
                    : null,
            image_url: v.shop_logo_url || v.profiles?.avatar_url || null,
            user_id: v.user_id,
        }));

        const userRows = (profilesRes.data || [])
            .filter((p) => p?.id && !vendorUserIds.has(p.id))
            .map((p) => ({
                kind: 'user',
                id: p.id,
                name: (p.full_name || 'Member').trim(),
                subtitle: null,
                image_url: p.avatar_url || null,
                user_id: p.id,
            }));

        const merged = [...vendorRows, ...userRows]
            .sort((a, b) =>
                a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
            )
            .slice(0, max);

        return { query, results: merged };
    },

    // ── PUBLIC PROFILE (other users) ─────────────────────
    async getPublicProfileById(targetUserId) {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .eq('id', targetUserId)
            .is('deleted_at', null)
            .single();

        if (error || !profile) {
            throw { statusCode: 404, message: 'User not found.' };
        }

        const [
            { count: followersCount },
            { count: followingCount },
            { count: postsCount },
            { data: recentPosts },
        ] = await Promise.all([
            supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', targetUserId),
            supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', targetUserId),
            supabase
                .from('posts')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', targetUserId)
                .eq('visibility', 'public')
                .eq('is_hidden', false)
                .is('deleted_at', null),
            supabase
                .from('posts')
                .select('id, image_path, created_at')
                .eq('user_id', targetUserId)
                .eq('visibility', 'public')
                .eq('is_hidden', false)
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .limit(9),
        ]);

        const recent_posts = (recentPosts ?? []).map((post) => ({
            id: post.id,
            image_url: signedUrlForPostImage(post.image_path),
            created_at: post.created_at,
        }));

        return {
            id: profile.id,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
            followers_count: followersCount ?? 0,
            following_count: followingCount ?? 0,
            posts_count: postsCount ?? 0,
            recent_posts,
        };
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
