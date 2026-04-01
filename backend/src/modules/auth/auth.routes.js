import { authController } from './auth.controller.js';
import {
    signupSchema,
    loginSchema,
    refreshSchema,
    forgotPasswordSchema,
    updatePasswordSchema,
} from './auth.schema.js';
import { authenticate } from '../../middleware/authenticate.js';

export async function authRoutes(fastify) {
    // Public routes — no auth required
    fastify.post(
        '/signup',
        {
            schema: { ...signupSchema, tags: ['Auth'], summary: 'Register a new account' },
            config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
        },
        authController.signup
    );

    fastify.get('/callback', {
        schema: { tags: ['Auth'], summary: 'Handle Supabase email callback and redirect to app' },
    }, authController.callback);

    fastify.get('/verify', {
        schema: { tags: ['Auth'], summary: 'Verify email with token hash' },
    }, authController.verifyEmail);

    fastify.post(
        '/login',
        {
            schema: { ...loginSchema, tags: ['Auth'], summary: 'Login with email and password' },
            config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
        },
        authController.login
    );

    fastify.get('/google', {
        schema: { tags: ['Auth'], summary: 'Redirect to Google OAuth' },
    }, authController.googleOAuth);

    fastify.post('/refresh', {
        schema: { ...refreshSchema, tags: ['Auth'], summary: 'Refresh access token' },
    }, authController.refresh);

    fastify.post(
        '/forgot-password',
        {
            schema: { ...forgotPasswordSchema, tags: ['Auth'], summary: 'Send password reset email' },
            config: { rateLimit: { max: 3, timeWindow: '1 hour' } },
        },
        authController.forgotPassword
    );

    // Protected routes — require valid JWT
    fastify.post(
        '/update-password',
        {
            schema: { ...updatePasswordSchema, tags: ['Auth'], summary: 'Update your password' },
            preHandler: authenticate,
            config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
        },
        authController.updatePassword
    );
    fastify.post('/logout', {
        schema: { tags: ['Auth'], summary: 'Logout and invalidate token' },
        preHandler: authenticate,
    }, authController.logout);

    fastify.delete('/account', {
        schema: { tags: ['Auth'], summary: 'Delete account (GDPR Article 17)' },
        preHandler: authenticate,
    }, authController.deleteAccount);

    fastify.get('/me/data', {
        schema: { tags: ['Auth'], summary: 'Export all my data (GDPR Article 15)' },
        preHandler: authenticate,
    }, authController.getMyData);
}
