import { authService } from './auth.service.js';

export const authController = {
    // POST /auth/signup
    async signup(request, reply) {
        const { email, password, full_name, gdpr_consent } = request.body;

        const data = await authService.signup({ email, password, full_name, gdpr_consent });

        return reply.status(201).send({
            success: true,
            message: 'Account created. Please verify your email.',
            user: {
                id: data.user?.id,
                email: data.user?.email,
            },
            // Return session only if email confirmation is disabled (dev only)
            session: data.session
                ? {
                    access_token: data.session.access_token,
                    refresh_token: data.session.refresh_token,
                    expires_in: data.session.expires_in,
                }
                : null,
        });
    },

    // POST /auth/login
    async login(request, reply) {
        const { email, password } = request.body;

        const data = await authService.login({ email, password });

        return reply.send({
            success: true,
            user: {
                id: data.user.id,
                email: data.user.email,
            },
            session: {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
                expires_in: data.session.expires_in,
            },
        });
    },

    // GET /auth/google
    async googleOAuth(request, reply) {
        const url = await authService.getGoogleOAuthURL();
        return reply.redirect(url);
    },

    // POST /auth/refresh
    async refresh(request, reply) {
        const { refresh_token } = request.body;

        const data = await authService.refreshSession(refresh_token);

        return reply.send({
            success: true,
            session: {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
                expires_in: data.session.expires_in,
            },
        });
    },

    // POST /auth/logout
    async logout(request, reply) {
        await authService.logout(request.headers.authorization?.split(' ')[1]);
        return reply.send({ success: true, message: 'Logged out successfully.' });
    },

    // POST /auth/forgot-password
    async forgotPassword(request, reply) {
        const { email } = request.body;

        await authService.forgotPassword(email);

        // Always return same message — don't leak if email exists (security)
        return reply.send({
            success: true,
            message: 'If that email exists, a reset link has been sent.',
        });
    },

    // DELETE /auth/account (GDPR Right to Erasure)
    async deleteAccount(request, reply) {
        await authService.deleteAccount(request.user.sub);

        return reply.send({
            success: true,
            message: 'Your account and all associated data have been deleted.',
        });
    },

    // GET /auth/me/data (GDPR Right to Access)
    async getMyData(request, reply) {
        const data = await authService.getUserData(request.user.sub);
        return reply.send({ success: true, data });
    },
};
