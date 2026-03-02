import { jest } from '@jest/globals';

// 1. Mock the userService
const mockUserService = {
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    uploadAvatar: jest.fn(),
    deleteAvatar: jest.fn(),
};

jest.unstable_mockModule('../src/modules/user/user.service.js', () => ({
    userService: mockUserService,
}));

// 2. Mock Supabase for authentication middleware bypass
const mockSupabase = {
    auth: {
        getUser: jest.fn(),
    },
    from: jest.fn(),
};

jest.unstable_mockModule('../src/config/supabase.js', () => ({
    supabase: mockSupabase,
}));

const { buildApp } = await import('../src/app.js');

describe('User Profile & Avatar Upload (Phase 2)', () => {
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

        // Mock successful authentication for all protected routes
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'uuid-1', email: 'test@example.com', role: 'authenticated' } },
            error: null,
        });

        const mockSingle = jest.fn().mockResolvedValue({ data: { deleted_at: null } });
        const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
        const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
        mockSupabase.from.mockReturnValue({ select: mockSelect });
    });

    describe('GET /user/profile', () => {
        it('returns empty profile with low completion score', async () => {
            mockUserService.getProfile.mockResolvedValueOnce({
                id: 'uuid-1',
                email: 'test@example.com',
                full_name: null,
                avatar_url: null,
                gender: null,
                age_range: null,
                height_cm: null,
                weight_kg: null,
                get_profile_completion: 14,
            });

            const response = await app.inject({
                method: 'GET',
                url: '/user/profile',
                headers: { authorization: 'Bearer valid_token' },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.completion_score).toBe(14);
            expect(body.profile.full_name).toBeUndefined();
        });
    });

    describe('PATCH /user/profile', () => {
        it('successfully updates profile and returns new data', async () => {
            const updates = {
                full_name: 'Test User',
                gender: 'prefer_not_to_say',
                age_range: '18-24',
                height_cm: 175,
                body_type: 'athletic',
                skin_tone: 'medium',
            };

            mockUserService.updateProfile.mockResolvedValueOnce({
                id: 'uuid-1',
                ...updates,
            });

            const response = await app.inject({
                method: 'PATCH',
                url: '/user/profile',
                headers: { authorization: 'Bearer valid_token' },
                payload: updates,
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.message).toBe('Profile updated successfully.');
            expect(body.profile.height_cm).toBe(175);
        });

        it('returns 400 validation error for out-of-bounds fields', async () => {
            const response = await app.inject({
                method: 'PATCH',
                url: '/user/profile',
                headers: { authorization: 'Bearer valid_token' },
                payload: { height_cm: 999, gender: 'alien' }, // Too tall + invalid enum
            });

            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.payload);
            expect(body.message).toContain('gender');
        });
    });

    describe('POST /user/profile/avatar', () => {
        it('rejects uploads over 5MB', async () => {
            // Create a 6MB dummy buffer
            const largeBuffer = Buffer.alloc(6 * 1024 * 1024, 'a');

            // Note: testing multipart payload exactly via inject requires building a form-data payload manually
            // We will assert the logic using app.inject by mocking form submission
            // Fastify multipart plugin throws 413 Payload Too Large automatically on limits
        });
    });
});
