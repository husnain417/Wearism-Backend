import { supabase } from '../../config/supabase.js';
import { userService } from '../user/user.service.js';
import { wardrobeService } from '../wardrobe/wardrobe.service.js';

export const authService = {
    // ── SIGNUP ──────────────────────────────────────────
    async signup({ email, password, full_name, gdpr_consent }) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name,
                    gdpr_consent, // passed to trigger → stored in profiles
                    gdpr_consent_version: '1.0',
                },
                // GDPR: require email verification before account is active
                emailRedirectTo: process.env.EMAIL_REDIRECT_URL,
            },
        });

        if (error) throw error;
        return data;
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

    // ── GET USER BY TOKEN ─────────────────────────────────
    async getUserFromToken(accessToken) {
        const { data, error } = await supabase.auth.getUser(accessToken);

        if (error) throw error;
        return data.user;
    },

    // ── GET USER DATA (GDPR Right to Access) ──────────────
    async getUserData(userId) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) throw error;
        return data;
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

        // Hard delete from auth (cascades to profiles via FK)
        const { error } = await supabase.auth.admin.deleteUser(userId);

        if (error) throw error;
    },
};
