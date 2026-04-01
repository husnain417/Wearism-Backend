import { buildApp } from '../src/app.js';
import { supabase } from '../src/config/supabase.js';
import { jest } from '@jest/jest';

describe('GET /auth/verify', () => {
    let app;

    beforeAll(async () => {
        app = await buildApp();
    });

    afterAll(async () => {
        await app.close();
    });

    test('returns 200 and session on valid token_hash', async () => {
        // Mock supabase.auth.verifyOtp
        const mockVerifyOtp = jest.spyOn(supabase.auth, 'verifyOtp').mockResolvedValue({
            data: {
                session: { access_token: 'fake_access', refresh_token: 'fake_refresh' },
                user: { id: 'user123', email: 'test@example.com' }
            },
            error: null
        });

        const response = await app.inject({
            method: 'GET',
            url: '/auth/verify',
            query: {
                token_hash: 'valid_hash',
                type: 'signup'
            }
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload);
        expect(body.success).toBe(true);
        expect(body.session.access_token).toBe('fake_access');
        expect(body.user.id).toBe('user123');

        mockVerifyOtp.mockRestore();
    });

    test('returns error on invalid token_hash', async () => {
        // Mock supabase.auth.verifyOtp error
        const mockVerifyOtp = jest.spyOn(supabase.auth, 'verifyOtp').mockResolvedValue({
            data: { session: null, user: null },
            error: { message: 'Invalid token' }
        });

        const response = await app.inject({
            method: 'GET',
            url: '/auth/verify',
            query: {
                token_hash: 'invalid_hash',
                type: 'signup'
            }
        });

        // Current implementation throws Error(error.message) which results in 500 in app.js
        expect(response.statusCode).toBe(500);
        const body = JSON.parse(response.payload);
        expect(body.success).toBe(false);
        expect(body.error).toBe('Internal server error');

        mockVerifyOtp.mockRestore();
    });
});
