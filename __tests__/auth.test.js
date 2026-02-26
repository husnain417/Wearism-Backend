import { jest } from '@jest/globals';

// 1. Mock the authService
const mockAuthService = {
    signup: jest.fn(),
    login: jest.fn(),
    getGoogleOAuthURL: jest.fn(),
    refreshSession: jest.fn(),
    logout: jest.fn(),
    forgotPassword: jest.fn(),
    getUserFromToken: jest.fn(),
    deleteAccount: jest.fn(),
    getUserData: jest.fn(),
};

jest.unstable_mockModule('../src/modules/auth/auth.service.js', () => ({
    authService: mockAuthService,
}));

// 2. Mock supabase client for the authenticate middleware
const mockSupabase = {
    auth: {
        getUser: jest.fn(),
    },
    from: jest.fn(),
};

jest.unstable_mockModule('../src/config/supabase.js', () => ({
    supabase: mockSupabase,
}));

// 3. Dynamic imports AFTER mocking
const { buildApp } = await import('../src/app.js');

describe('Auth Endpoints & GDPR Compliance', () => {
    let app;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /auth/signup', () => {
        it('returns 201 on valid signup', async () => {
            mockAuthService.signup.mockResolvedValueOnce({
                user: { id: 'uuid-1', email: 'test@example.com' },
                session: { access_token: 'access123', refresh_token: 'refresh123', expires_in: 3600 },
            });

            const response = await app.inject({
                method: 'POST',
                url: '/auth/signup',
                payload: {
                    email: 'test@example.com',
                    password: 'SecurePass123!',
                    full_name: 'Test User',
                    gdpr_consent: true,
                },
            });

            expect(response.statusCode).toBe(201);
            const body = JSON.parse(response.payload);
            expect(body.success).toBe(true);
            expect(body.user.email).toBe('test@example.com');
        });

        it('returns 400 validation error if gdpr_consent is false (GDPR Requirement)', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/auth/signup',
                payload: {
                    email: 'test2@example.com',
                    password: 'SecurePass123!',
                    full_name: 'Test User',
                    gdpr_consent: false,
                },
            });

            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.payload);
            expect(body.message).toContain('gdpr_consent');
        });

        it('returns 400 validation error if password is too short', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/auth/signup',
                payload: {
                    email: 'test3@example.com',
                    password: 'short',
                    full_name: 'Test User',
                    gdpr_consent: true,
                },
            });

            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.payload);
            expect(body.message).toContain('password');
        });
    });

    describe('POST /auth/login', () => {
        it('returns 200 with tokens on successful login', async () => {
            mockAuthService.login.mockResolvedValueOnce({
                user: { id: 'uuid-1', email: 'test@example.com' },
                session: { access_token: 'access123', refresh_token: 'refresh123', expires_in: 3600 },
            });

            const response = await app.inject({
                method: 'POST',
                url: '/auth/login',
                payload: {
                    email: 'test@example.com',
                    password: 'SecurePass123!',
                },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.success).toBe(true);
            expect(body.session.access_token).toBe('access123');
        });

        it('enforces rate limiting on login (Test 6)', async () => {
            // The limit is 5 per 15 mins. Let's fire 6 requests.
            mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'));

            for (let i = 0; i < 5; i++) {
                await app.inject({
                    method: 'POST',
                    url: '/auth/login',
                    payload: { email: 'rate@limit.com', password: 'wrong' },
                });
            }

            const response = await app.inject({
                method: 'POST',
                url: '/auth/login',
                payload: { email: 'rate@limit.com', password: 'wrong' },
            });

            // 6th request should hit rate limit
            expect(response.statusCode).toBe(429);
            const body = JSON.parse(response.payload);
            expect(body.statusCode).toBe(429);
            expect(body.error).toBe('Too Many Requests');
        });
    });

    describe('JWT Middleware & Right to Access (Article 15)', () => {
        it('returns 200 with profile data on valid token', async () => {
            mockSupabase.auth.getUser.mockResolvedValueOnce({
                data: { user: { id: 'uuid-1', email: 'test@example.com', role: 'authenticated' } },
                error: null,
            });

            // Mock from('profiles').select().eq().single() passing soft-delete check
            const mockSingle = jest.fn().mockResolvedValueOnce({ data: { deleted_at: null } });
            const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
            const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
            mockSupabase.from.mockReturnValue({ select: mockSelect });

            // Mock the actual getUserData call
            mockAuthService.getUserData.mockResolvedValueOnce({
                id: 'uuid-1',
                email: 'test@example.com',
                full_name: 'Test User',
            });

            const response = await app.inject({
                method: 'GET',
                url: '/auth/me/data',
                headers: {
                    authorization: 'Bearer valid_token_123',
                },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.success).toBe(true);
            expect(body.data.full_name).toBe('Test User');
        });

        it('returns 401 on invalid token', async () => {
            mockSupabase.auth.getUser.mockResolvedValueOnce({
                data: { user: null },
                error: { message: 'jwt expired' },
            });

            const response = await app.inject({
                method: 'GET',
                url: '/auth/me/data',
                headers: {
                    authorization: 'Bearer invalid_token',
                },
            });

            expect(response.statusCode).toBe(401);
            const body = JSON.parse(response.payload);
            expect(body.error).toBe('Token is invalid or has expired.');
        });

        it('returns 403 if user account is soft-deleted (GDPR)', async () => {
            mockSupabase.auth.getUser.mockResolvedValueOnce({
                data: { user: { id: 'uuid-1', email: 'test@example.com', role: 'authenticated' } },
                error: null,
            });

            // Mock from('profiles').select().eq().single() failing soft-delete check
            const mockSingle = jest.fn().mockResolvedValueOnce({ data: { deleted_at: '2023-10-01T12:00:00Z' } });
            const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
            const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
            mockSupabase.from.mockReturnValue({ select: mockSelect });

            const response = await app.inject({
                method: 'GET',
                url: '/auth/me/data',
                headers: {
                    authorization: 'Bearer valid_token_123',
                },
            });

            expect(response.statusCode).toBe(403);
            const body = JSON.parse(response.payload);
            expect(body.error).toBe('This account has been deleted.');
        });
    });

    describe('POST /auth/refresh', () => {
        it('returns 200 with new tokens', async () => {
            mockAuthService.refreshSession.mockResolvedValueOnce({
                session: { access_token: 'new_access', refresh_token: 'new_refresh', expires_in: 3600 },
            });

            const response = await app.inject({
                method: 'POST',
                url: '/auth/refresh',
                payload: {
                    refresh_token: 'old_refresh',
                },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.success).toBe(true);
            expect(body.session.access_token).toBe('new_access');
        });
    });

    describe('POST /auth/forgot-password', () => {
        it('returns success message regardless of email existence', async () => {
            mockAuthService.forgotPassword.mockResolvedValueOnce();

            const response = await app.inject({
                method: 'POST',
                url: '/auth/forgot-password',
                payload: {
                    email: 'random@example.com',
                },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.message).toBe('If that email exists, a reset link has been sent.');
        });
    });
});
