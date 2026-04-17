import { supabase } from '../../config/supabase.js';
import { userService } from '../user/user.service.js';
import { wardrobeService } from '../wardrobe/wardrobe.service.js';
import { getRedisClient } from '../../config/redis.js';

// ── GDPR helper — deletes all objects under posts/{userId}/ in Storage
async function deleteAllUserPostImages(userId) {
    const { data: files } = await supabase.storage
        .from('posts')
        .list(userId);

    if (!files || files.length === 0) return;

    const paths = files.map(f => `${userId}/${f.name}`);
    await supabase.storage.from('posts').remove(paths);
}

// ── GDPR helper — deletes all objects under products/{userId}/ in Storage
async function deleteAllUserProductImages(userId) {
    const { data: files } = await supabase.storage
        .from('products')
        .list(userId);

    if (!files || files.length === 0) return;

    const paths = files.map(f => `${userId}/${f.name}`);
    await supabase.storage.from('products').remove(paths);
}

export const authService = {
    // ── SIGNUP ──────────────────────────────────────────
    async signup({ email, password, full_name, gdpr_consent }) {
        const { data, error } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                full_name,
                gdpr_consent,
                gdpr_consent_version: '1.0',
            },
        });

        if (error) throw error;
        return { user: data.user, session: null };
    },

    // ── VERIFY EMAIL ─────────────────────────────────────
    async verifyEmail(query) {
        const { token, token_hash, type = 'email' } = query;
        const verifyToken = token_hash || token;

        // 1. Log params for debugging Supabase redirect
        console.log('[AuthService] verifyEmail params:', query);

        // 4. Validation
        if (!verifyToken) {
            const error = new Error('token_hash is required');
            error.statusCode = 400;
            throw error;
        }

        const { data, error } = await supabase.auth.verifyOtp({ token_hash: verifyToken, type });
        if (error) throw new Error(error.message);

        return {
            success: true,
            session: data.session,
            user: data.user,
        };
    },

    // ── LOGIN ────────────────────────────────────────────
    async login({ email, password }) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;
        return data;
    },

    // ── GOOGLE OAUTH ─────────────────────────────────────
    async getGoogleOAuthURL() {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: process.env.OAUTH_REDIRECT_URL,
                scopes: 'email profile', // minimum required — no extra scopes
            },
        });

        if (error) throw error;
        return data.url;
    },

    // ── REFRESH TOKEN ─────────────────────────────────────
    async refreshSession(refresh_token) {
        const { data, error } = await supabase.auth.refreshSession({ refresh_token });

        if (error) throw error;
        return data;
    },

    // ── LOGOUT ───────────────────────────────────────────
    async logout(accessToken) {
        // Set session so Supabase knows which session to invalidate
        const { error } = await supabase.auth.admin.signOut(accessToken);

        if (error) throw error;
    },

    // ── FORGOT PASSWORD ───────────────────────────────────
    async forgotPassword(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: process.env.PASSWORD_RESET_REDIRECT_URL,
        });

        if (error) throw error;
    },

    // ── UPDATE PASSWORD ───────────────────────────────────
    async updatePassword(userId, newPassword) {
        const { error } = await supabase.auth.admin.updateUserById(userId, {
            password: newPassword,
        });

        if (error) throw error;
    },

    // ── GET USER BY TOKEN ─────────────────────────────────
    async getUserFromToken(accessToken) {
        const { data, error } = await supabase.auth.getUser(accessToken);

        if (error) throw error;
        return data.user;
    },

    // ── GET USER DATA (GDPR Right to Access) ──────────────
    async getUserData(userId) {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) throw error;

        // GDPR Right to Access — include all personal data held
        const [{ data: orders }, { data: cart }, { data: vendor }] = await Promise.all([
            supabase.from('orders').select('*').eq('buyer_id', userId),
            supabase.from('cart_items').select('*').eq('user_id', userId),
            supabase.from('vendor_profiles').select('*').eq('user_id', userId),
        ]);

        return { profile, orders: orders || [], cart: cart || [], vendor: vendor || null };
    },

    // ── DELETE ACCOUNT (GDPR Right to Erasure) ────────────
    async deleteAccount(userId) {
        // Soft delete profile first
        await supabase
            .from('profiles')
            .update({ deleted_at: new Date().toISOString(), data_deletion_requested: true })
            .eq('id', userId);

        // Delete Avatar from storage
        await userService.deleteAvatar(userId);

        // Delete all wardrobe images from storage
        await wardrobeService.deleteAllUserItems(userId);

        // GDPR: delete all post images from Supabase Storage
        await deleteAllUserPostImages(userId);

        // GDPR: delete all product images from Supabase Storage
        await deleteAllUserProductImages(userId);

        // GDPR: clear Redis feed cache for this user
        const redis = getRedisClient();
        await redis.del(`feed:${userId}`);

        // Hard delete from auth (cascades to profiles via FK)
        const { error } = await supabase.auth.admin.deleteUser(userId);

        if (error) throw error;
    },
};
